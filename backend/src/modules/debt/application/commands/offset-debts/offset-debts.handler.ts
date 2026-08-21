import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { OffsetDebtsCommand } from './offset-debts.command';
import { Debt } from '../../../domain/aggregates/debt';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';
import { DebtResponseMapper, type DebtResponseDto } from '../../mappers/debt-response.mapper';
import { CreateTransactionCommand } from '../../../../accounting/application/commands/create-transaction/create-transaction.command';
import { DEBT_CATEGORY_IDS } from '../../../../accounting/domain/constants/default-categories';

interface ResolvedAccounts {
  /** Счёт долга, если он ещё существует, иначе запасной. */
  pick(accountId: string | null): string;
}

export interface OffsetDebtsResultDto {
  personName: string;
  currency: string;
  offsetAmount: number;
  debts: DebtResponseDto[];
}

/** Деньги хранятся с двумя знаками — остатки округляем так же, иначе копейка зависает. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Взаимозачёт встречных долгов одного человека: то, что он должен вам, гасит
 * ровно столько же из того, что должны вы. Деньги не двигаются, поэтому обе
 * стороны записываются информационными отметками — они видны в ленте, но не
 * трогают баланс и аналитику.
 *
 * Зачёт всегда идёт на максимум (`min` двух сторон): частичный зачёт — это то же
 * самое, что зачесть всё и сразу занять обратно, а лишний выбор здесь только
 * добавляет способов ошибиться.
 */
@CommandHandler(OffsetDebtsCommand)
export class OffsetDebtsHandler implements ICommandHandler<OffsetDebtsCommand> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
    private readonly commandBus: CommandBus,
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: OffsetDebtsCommand): Promise<OffsetDebtsResultDto> {
    const { userId, personName, currency } = command;

    const debts = await this.debtRepository.findActiveByPerson(userId, personName, currency);
    const given = debts.filter((d) => d.debtTypeValue === 'given');
    const taken = debts.filter((d) => d.debtTypeValue === 'taken');

    const sum = (list: Debt[]) => round2(list.reduce((acc, d) => acc + d.remainingAmountValue, 0));
    const offsetAmount = Math.min(sum(given), sum(taken));

    if (offsetAmount <= 0) {
      throw new ConflictException('Нет встречных долгов для зачёта');
    }

    const accounts = await this.resolveAccounts(userId);

    // Одна отметка времени на весь зачёт: по ней отмена находит все его записи.
    const date = new Date();
    const touched = new Map<string, Debt>();

    await this.dataSource.transaction(async (manager) => {
      // Стороны гасятся независимо: суммы обеих равны offsetAmount, поэтому
      // разбивать зачёт на пары долгов не нужно.
      await this.applySide(given, offsetAmount, 'income', {
        userId,
        accounts,
        currency,
        personName,
        date,
        manager,
        touched,
      });
      await this.applySide(taken, offsetAmount, 'expense', {
        userId,
        accounts,
        currency,
        personName,
        date,
        manager,
        touched,
      });
    });

    return {
      personName,
      currency,
      offsetAmount,
      debts: Array.from(touched.values()).map((d) => DebtResponseMapper.toResponse(d)),
    };
  }

  /**
   * Гасит `pool` по долгам одной стороны, начиная с самых старых: у старого
   * долга больше шансов быть забытым, и закрыть его полезнее.
   */
  private async applySide(
    side: Debt[],
    pool: number,
    type: 'income' | 'expense',
    ctx: {
      userId: string;
      accounts: ResolvedAccounts;
      currency: string;
      personName: string;
      date: Date;
      manager: EntityManager;
      touched: Map<string, Debt>;
    },
  ): Promise<void> {
    let left = pool;

    for (const debt of side) {
      if (left <= 0) break;
      const amount = round2(Math.min(left, debt.remainingAmountValue));
      if (amount <= 0) continue;

      const transaction = await this.commandBus.execute<CreateTransactionCommand, { id: string }>(
        new CreateTransactionCommand(
          ctx.userId,
          ctx.accounts.pick(debt.accountId),
          DEBT_CATEGORY_IDS.OFFSET,
          amount,
          ctx.currency,
          type,
          ctx.date,
          `Взаимозачёт: ${ctx.personName}`,
          false,
          undefined,
          undefined,
          undefined,
          debt.id,
          undefined,
          ctx.manager,
          true,
        ),
      );

      const remainingAfter = round2(debt.remainingAmountValue - amount);
      const willClose = remainingAfter <= 0;
      debt.update({
        remainingAmount: remainingAfter,
        ...(willClose ? { isClosed: true, closeTransactionId: transaction.id } : {}),
      });

      await this.debtRepository.save(debt, ctx.manager);
      ctx.touched.set(debt.id, debt);
      left = round2(left - amount);
    }
  }

  /**
   * Информационная запись всё равно должна лежать на существующем счёте.
   * `debts.account_id` живёт без внешнего ключа и может указывать на удалённый
   * счёт, поэтому рядом с проверкой держим запасной счёт пользователя.
   */
  private async resolveAccounts(userId: string): Promise<ResolvedAccounts> {
    const rows: { id: string }[] = await this.dataSource.query(
      'SELECT id FROM accounts WHERE user_id = $1 ORDER BY "order" ASC, created_at ASC',
      [userId],
    );
    if (rows.length === 0) {
      throw new BadRequestException('Нет счёта, к которому можно привязать запись о зачёте');
    }

    const existing = new Set(rows.map((r) => r.id));
    const fallbackId = rows[0].id;
    return {
      pick: (accountId) => (accountId && existing.has(accountId) ? accountId : fallbackId),
    };
  }
}
