import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import {
  Inject,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PayDebtCommand } from './pay-debt.command';
import { Debt } from '../../../domain/aggregates/debt';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';
import { DebtResponseMapper, type DebtResponseDto } from '../../mappers/debt-response.mapper';
import { CreateTransactionCommand } from '../../../../accounting/application/commands/create-transaction/create-transaction.command';
import { DEBT_CATEGORY_IDS } from '../../../../accounting/domain/constants/default-categories';

export interface PayDebtResultDto {
  debt: DebtResponseDto;
  /** Идентификаторы созданных записей — в порядке создания. */
  transactionIds: string[];
}

/** Деньги хранятся с двумя знаками — остатки округляем так же, иначе копейка зависает. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function displayName(debt: Debt): string {
  return debt.personName?.trim() || debt.name.trim();
}

/**
 * Платёж по долгу одной командой.
 *
 * Раньше это делал клиент: сам считал новый остаток, сам решал, закрылся ли
 * долг, и отправлял результат мешком полей в `PATCH /debts/:id`. Две беды разом
 * — правило долга жило вне домена, и «создать транзакцию» с «обновить долг»
 * были разными запросами: упал второй — в истории висит перевод, а долг цел.
 *
 * Здесь всё в одной транзакции БД, а остаток и закрытие считает сам агрегат
 * (`makePayment`). Форма повторяет взаимозачёт — единственное место, где это
 * уже было сделано правильно.
 */
@CommandHandler(PayDebtCommand)
export class PayDebtHandler implements ICommandHandler<PayDebtCommand> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
    private readonly commandBus: CommandBus,
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: PayDebtCommand): Promise<PayDebtResultDto> {
    const { userId, debtId, amount, accountId, date, forgiveRemainder, excessCategoryId } = command;

    const debt = await this.debtRepository.findById(debtId);
    if (!debt) throw new NotFoundException('Debt not found');
    if (debt.userId !== userId) throw new ForbiddenException('Debt belongs to another user');
    if (debt.isClosed) throw new ConflictException('Долг уже закрыт');

    if (amount < 0) throw new BadRequestException('Некорректная сумма платежа');
    if (amount === 0 && !forgiveRemainder) {
      throw new BadRequestException('Некорректная сумма платежа');
    }

    const remaining = debt.remainingAmountValue;
    const excess = round2(amount - remaining);
    if (excess > 0 && !excessCategoryId) {
      throw new BadRequestException('Выберите категорию для переплаты');
    }

    const actualPayment = round2(Math.min(amount, remaining));
    const remainderAfter = round2(remaining - actualPayment);
    const willClose = excess > 0 || forgiveRemainder || remainderAfter <= 0;

    const isGiven = debt.debtTypeValue === 'given';
    const currency = debt.currency;
    const transactionIds: string[] = [];
    // Долг, заведённый без движения денег, возвращается такой же информационной
    // записью: иначе возврат создаст баланс, которого не создавала выдача.
    const hadBalanceEffect = !!debt.transactionId || !!debt.sourceTransactionId;

    await this.dataSource.transaction(async (manager) => {
      let closeTransactionId: string | undefined;

      if (actualPayment > 0) {
        const id = await this.createTransaction(manager, {
          userId,
          accountId,
          categoryId: isGiven ? DEBT_CATEGORY_IDS.RETURN_TO_ME : DEBT_CATEGORY_IDS.RETURN_FROM_ME,
          amount: actualPayment,
          currency,
          type: isGiven ? 'income' : 'expense',
          date,
          description: this.paymentDescription(debt, willClose),
          isDebtRelated: hadBalanceEffect,
          debtId: debt.id,
        });
        closeTransactionId = id;
        transactionIds.push(id);
      }

      if (excess > 0 && excessCategoryId) {
        transactionIds.push(
          await this.createTransaction(manager, {
            userId,
            accountId,
            categoryId: excessCategoryId,
            amount: excess,
            currency,
            type: isGiven ? 'income' : 'expense',
            date,
            description: `Переплата по долгу: ${displayName(debt)}`,
            isDebtRelated: false,
          }),
        );
      }

      // Прощение видно в ленте всегда, даже если выдача уже двигала деньги:
      // пользователю нужно событие, а не только изменившийся остаток.
      if (forgiveRemainder && remainderAfter > 0) {
        const id = await this.createTransaction(manager, {
          userId,
          // `debts.account_id` живёт без внешнего ключа и может указывать на
          // удалённый счёт — тогда запись ляжет на счёт платежа.
          accountId: debt.accountId ?? accountId,
          categoryId: DEBT_CATEGORY_IDS.FORGIVEN,
          amount: remainderAfter,
          currency,
          type: isGiven ? 'expense' : 'income',
          date,
          description: `Прощение долга: ${displayName(debt)}`,
          isDebtRelated: false,
          debtId: debt.id,
          isInformational: true,
        });
        transactionIds.push(id);
        closeTransactionId ??= id;
      }

      if (actualPayment > 0) debt.makePayment(actualPayment);
      if (forgiveRemainder && remainderAfter > 0) debt.setForgivenAmount(remainderAfter);
      if (willClose) debt.close();
      if (willClose && closeTransactionId) debt.setCloseTransactionId(closeTransactionId);

      await this.debtRepository.save(debt, manager);
    });

    return { debt: DebtResponseMapper.toResponse(debt), transactionIds };
  }

  private paymentDescription(debt: Debt, willClose: boolean): string {
    if (!willClose) return `Частичный платёж: ${displayName(debt)}`;
    if (debt.sourceTransactionId) return `Возврат от ${displayName(debt)}: доля в общем счёте`;
    return `Закрытие долга: ${displayName(debt)}`;
  }

  private async createTransaction(
    manager: EntityManager,
    input: {
      userId: string;
      accountId: string;
      categoryId: string;
      amount: number;
      currency: string;
      type: 'income' | 'expense';
      date: Date;
      description: string;
      isDebtRelated: boolean;
      debtId?: string;
      isInformational?: boolean;
    },
  ): Promise<string> {
    const created = await this.commandBus.execute<CreateTransactionCommand, { id: string }>(
      new CreateTransactionCommand(
        input.userId,
        input.accountId,
        input.categoryId,
        input.amount,
        input.currency,
        input.type,
        input.date,
        input.description,
        input.isDebtRelated,
        undefined,
        undefined,
        undefined,
        input.debtId,
        undefined,
        manager,
        input.isInformational ?? false,
      ),
    );
    return created.id;
  }
}
