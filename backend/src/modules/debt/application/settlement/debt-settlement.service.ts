import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource, EntityManager } from 'typeorm';
import { Debt } from '../../domain/aggregates/debt';
import { IDebtRepository, DEBT_REPOSITORY } from '../../domain/repositories';
import { DebtResponseMapper, type DebtResponseDto } from '../mappers/debt-response.mapper';
import type { PayDebtCommand } from '../commands/pay-debt/pay-debt.command';
import { DEBT_CATEGORY_IDS } from '../../../accounting/domain/constants/default-categories';
import { removeDebtWithRecords } from './debt-removal';
import { displayName, planOffset, planPayment } from './settlement-plan';
import { reopenClosedDebt, reverseSettlement } from './settlement-reversal';
import { SettlementWriter } from './settlement-writer';

export interface PayDebtResultDto {
  debt: DebtResponseDto;
  /** Запись самого платежа. Null, когда остаток только прощён. */
  paymentTransactionId: string | null;
  /** Идентификаторы созданных записей — в порядке создания. */
  transactionIds: string[];
  /** Общий id всех записей этого платежа, включая переплату без `debt_id`. */
  settlementId: string;
}

export interface OffsetDebtsResultDto {
  personName: string;
  currency: string;
  offsetAmount: number;
  debts: DebtResponseDto[];
  settlementId: string;
}

/**
 * Расчёты по долгам: платёж и взаимозачёт. Каждый пишет все свои записи одним
 * `SettlementWriter` в одной транзакции БД, поэтому у записей общий `settlement_id`.
 */
@Injectable()
export class DebtSettlementService {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
    private readonly commandBus: CommandBus,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Платёж по долгу одной командой: остаток и закрытие считает сам агрегат
   * (`makePayment`), записи и долг сохраняются одной транзакцией БД.
   *
   * Отработка (`settleWithWork`) идёт тем же путём, но платёж записывается
   * информационной отметкой — денег на счетах от неё не прибавилось.
   */
  async pay(command: PayDebtCommand): Promise<PayDebtResultDto> {
    const {
      userId,
      debtId,
      amount,
      accountId,
      date,
      forgiveRemainder,
      excessCategoryId,
      settleWithWork,
      workNote,
      workCategoryId,
    } = command;

    const debt = await this.debtRepository.findById(debtId);
    if (!debt) throw new NotFoundException('Debt not found');
    if (debt.userId !== userId) throw new ForbiddenException('Debt belongs to another user');
    if (debt.isClosed) throw new ConflictException('Долг уже закрыт');

    const { actualPayment, excess, forgiven, willClose } = planPayment({
      remaining: debt.remainingAmountValue,
      amount,
      forgiveRemainder,
      settleWithWork,
      excessCategoryId,
      workCategoryId,
    });

    const isGiven = debt.debtTypeValue === 'given';
    const currency = debt.currency;
    const transactionIds: string[] = [];
    let paymentTransactionId: string | null = null;
    // Долг, заведённый без движения денег, возвращается такой же информационной
    // записью: иначе возврат создаст баланс, которого не создавала выдача.
    const hadBalanceEffect = !!debt.transactionId || !!debt.sourceTransactionId;

    const settlementId = await this.dataSource.transaction(async (manager) => {
      const writer = new SettlementWriter(this.commandBus, manager, userId);
      let closeTransactionId: string | undefined;

      if (actualPayment > 0) {
        // Отработка ложится на счёт долга — как и прощение: денег она не
        // двигает (или двигает в ноль), но должна лежать на живом счёте.
        const workAccountId = settleWithWork
          ? await this.markerAccountId(manager, userId, debt.accountId, accountId)
          : accountId;

        /**
         * Отработка с категорией — пара записей, дающая по балансу ноль: трата
         * по выбранной категории (работу вы «купили») и обычный возврат долга.
         * Так работа видна в аналитике тратой, а долг гасится теми же
         * возвратами, что и деньгами: сумма уходит из «Невозвращённых долгов»
         * в выбранную категорию, а не исчезает из отчёта.
         *
         * Обе ноги живут и снимаются только вместе — одна оставила бы на счёте
         * дыру на свою сумму. Связаны они долгом и расчётом: `debt_id` с
         * недолговой категорией бывает только у ноги работы.
         */
        if (settleWithWork && workCategoryId) {
          transactionIds.push(
            await writer.record({
              accountId: workAccountId,
              categoryId: workCategoryId,
              amount: actualPayment,
              currency,
              type: isGiven ? 'expense' : 'income',
              date,
              description: this.workDescription(debt, workNote),
              isDebtRelated: false,
              debtId: debt.id,
            }),
          );
        }

        // Отработка без категории — не движение денег, а отметка: баланс счёта
        // она не трогает и в аналитику не попадает, как взаимозачёт и прощение.
        const asMarker = settleWithWork && !workCategoryId;

        const id = await writer.record({
          accountId: workAccountId,
          categoryId: asMarker
            ? DEBT_CATEGORY_IDS.WORKED_OFF
            : isGiven
              ? DEBT_CATEGORY_IDS.RETURN_TO_ME
              : DEBT_CATEGORY_IDS.RETURN_FROM_ME,
          amount: actualPayment,
          currency,
          type: isGiven ? 'income' : 'expense',
          date,
          description: asMarker
            ? this.workDescription(debt, workNote)
            : this.paymentDescription(debt, willClose),
          isDebtRelated: asMarker ? false : hadBalanceEffect,
          debtId: debt.id,
          isInformational: asMarker,
        });
        closeTransactionId = id;
        paymentTransactionId = id;
        transactionIds.push(id);
      }

      if (excess > 0 && excessCategoryId) {
        transactionIds.push(
          await writer.record({
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
      if (forgiven > 0) {
        const id = await writer.record({
          accountId: await this.markerAccountId(manager, userId, debt.accountId, accountId),
          categoryId: DEBT_CATEGORY_IDS.FORGIVEN,
          amount: forgiven,
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
      if (forgiven > 0) debt.setForgivenAmount(forgiven);
      if (willClose) debt.close();
      if (willClose && closeTransactionId) debt.setCloseTransactionId(closeTransactionId);

      await this.debtRepository.save(debt, manager);
      return writer.settlementId;
    });

    return {
      debt: DebtResponseMapper.toResponse(debt),
      paymentTransactionId,
      transactionIds,
      settlementId,
    };
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
  async offset(input: {
    userId: string;
    personName: string;
    currency: string;
  }): Promise<OffsetDebtsResultDto> {
    const { userId, personName, currency } = input;

    const debts = await this.debtRepository.findActiveByPerson(userId, personName, currency);
    const plan = planOffset(
      debts.map((d) => ({
        id: d.id,
        debtType: d.debtTypeValue,
        remaining: d.remainingAmountValue,
        createdAt: d.createdAt,
      })),
    );

    if (plan.offsetAmount <= 0) {
      throw new ConflictException('Нет встречных долгов для зачёта');
    }

    const accounts = await this.resolveAccounts(userId);
    const debtById = new Map(debts.map((d) => [d.id, d]));
    // Одна отметка времени на весь зачёт: записи расчёта в ленте стоят рядом.
    const date = new Date();
    const touched = new Map<string, Debt>();

    const settlementId = await this.dataSource.transaction(async (manager) => {
      const writer = new SettlementWriter(this.commandBus, manager, userId);

      // Стороны гасятся независимо (суммы обеих равны offsetAmount), долги —
      // старыми первыми: у старого долга больше шансов быть забытым.
      for (const part of plan.parts) {
        const debt = debtById.get(part.debtId)!;
        const id = await writer.record({
          accountId: accounts.pick(debt.accountId),
          categoryId: DEBT_CATEGORY_IDS.OFFSET,
          amount: part.amount,
          currency,
          type: debt.debtTypeValue === 'given' ? 'income' : 'expense',
          date,
          description: `Взаимозачёт: ${personName}`,
          isDebtRelated: false,
          debtId: debt.id,
          isInformational: true,
        });

        // Остаток и закрытие считает агрегат: правило «платёж в ноль закрывает
        // долг» должно быть одним и тем же для зачёта и для обычного платежа.
        debt.makePayment(part.amount);
        if (debt.isClosed) debt.setCloseTransactionId(id);

        await this.debtRepository.save(debt, manager);
        touched.set(debt.id, debt);
      }

      return writer.settlementId;
    });

    return {
      personName,
      currency,
      offsetAmount: plan.offsetAmount,
      debts: Array.from(touched.values()).map((d) => DebtResponseMapper.toResponse(d)),
      settlementId,
    };
  }

  /** Отмена расчёта по его id: затронутые долги возвращаются, записи уходят вместе. */
  reverse(userId: string, settlementId: string, manager?: EntityManager): Promise<Debt[]> {
    return reverseSettlement(this.reversalDeps(), userId, settlementId, manager);
  }

  /** Отмена закрытия долга — отмена расчёта, который его закрыл. */
  reopen(userId: string, debtId: string): Promise<Debt> {
    return reopenClosedDebt(this.reversalDeps(), userId, debtId);
  }

  /** Удаление долга со всеми его записями; общие расчёты с другими долгами отменяются штатно. */
  removeDebt(userId: string, debtId: string): Promise<void> {
    return removeDebtWithRecords(this.reversalDeps(), userId, debtId);
  }

  private reversalDeps() {
    return {
      debtRepository: this.debtRepository,
      commandBus: this.commandBus,
      dataSource: this.dataSource,
    };
  }

  /**
   * Информационную отметку (прощение, отработка) хочется положить на счёт
   * долга, ради точности истории. Но
   * `debts.account_id` живёт без внешнего ключа и может указывать на удалённый
   * счёт, а упавший внутри транзакции запрос уже не повторить — поэтому счёт
   * проверяется заранее, и при промахе запись ложится на счёт платежа.
   */
  private async markerAccountId(
    manager: EntityManager,
    userId: string,
    preferred: string | null,
    fallback: string,
  ): Promise<string> {
    if (!preferred || preferred === fallback) return fallback;
    const rows = await manager.query<{ id: string }[]>(
      'SELECT id FROM accounts WHERE id = $1 AND user_id = $2 LIMIT 1',
      [preferred, userId],
    );
    return rows.length > 0 ? preferred : fallback;
  }

  /** Что именно отработано, если пользователь это написал: «Отработка долга: Тимур — ремонт». */
  private workDescription(debt: Debt, workNote?: string): string {
    const note = workNote?.trim();
    const base = `Отработка долга: ${displayName(debt)}`;
    return note ? `${base} — ${note}` : base;
  }

  private paymentDescription(debt: Debt, willClose: boolean): string {
    if (!willClose) return `Частичный платёж: ${displayName(debt)}`;
    if (debt.sourceTransactionId) return `Возврат от ${displayName(debt)}: доля в общем счёте`;
    return `Закрытие долга: ${displayName(debt)}`;
  }

  /**
   * Информационная запись всё равно должна лежать на существующем счёте.
   * `debts.account_id` живёт без внешнего ключа и может указывать на удалённый
   * счёт, поэтому рядом с проверкой держим запасной счёт пользователя.
   */
  private async resolveAccounts(userId: string): Promise<{
    /** Счёт долга, если он ещё существует, иначе запасной. */
    pick(accountId: string | null): string;
  }> {
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
