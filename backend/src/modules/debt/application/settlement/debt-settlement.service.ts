import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource, EntityManager } from 'typeorm';
import { Debt } from '../../domain/aggregates/debt';
import { IDebtRepository, DEBT_REPOSITORY } from '../../domain/repositories';
import { DebtResponseMapper, type DebtResponseDto } from '../mappers/debt-response.mapper';
import type { CloseAllDebtsCommand } from '../commands/close-all-debts/close-all-debts.command';
import type { OffsetDebtsCommand } from '../commands/offset-debts/offset-debts.command';
import type { PayDebtCommand } from '../commands/pay-debt/pay-debt.command';
import type { PreviewCloseAllQuery } from '../queries/preview-close-all/preview-close-all.query';
import {
  closeAllDebts,
  previewCloseAll,
  type CloseAllPreviewDto,
  type CloseAllResultDto,
} from './close-all';
import { lockDebts } from './debt-lock';
import { removeDebtWithRecords } from './debt-removal';
import { planOffset, planPayment } from './settlement-plan';
import type { SettlementDeps } from './settlement-deps';
import {
  loadOpenDebt,
  toSettlementDebt,
  writeDebtPayment,
  writeOffsetParts,
} from './settlement-records';
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
 * Расчёты по долгам: платёж, взаимозачёт и «Закрыть все». Каждый пишет все свои записи
 * одним `SettlementWriter` в одной транзакции БД, поэтому у записей общий `settlement_id`.
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

    const { debt, settlementId, records } = await this.dataSource.transaction(async (manager) => {
      // Остаток читается под замком: параллельный платёж или отмена не оставят его устаревшим.
      const known = await lockDebts(this.debtRepository, manager, userId, [debtId]);
      const debt = await loadOpenDebt(this.debtRepository, userId, debtId, { manager, known });
      const plan = planPayment({
        remaining: debt.remainingAmountValue,
        amount,
        forgiveRemainder,
        settleWithWork,
        excessCategoryId,
        workCategoryId,
      });
      const writer = this.writer(manager, userId);
      const written = await writeDebtPayment(writer, {
        debt,
        plan,
        accountId,
        date,
        excessCategoryId,
        settleWithWork,
        workNote,
        workCategoryId,
      });
      return { debt, settlementId: writer.settlementId, records: written };
    });

    return {
      debt: DebtResponseMapper.toResponse(debt),
      paymentTransactionId: records.paymentTransactionId,
      transactionIds: records.transactionIds,
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
  async offset(command: OffsetDebtsCommand): Promise<OffsetDebtsResultDto> {
    const { userId, personName, currency } = command;

    const { plan, touched, settlementId } = await this.dataSource.transaction(async (manager) => {
      // Состав долгов читается дважды: сперва чтобы знать, что блокировать, затем под замком.
      const candidates = await this.debtRepository.findActiveByPerson(
        userId,
        personName,
        currency,
        manager,
      );
      const locked = await lockDebts(
        this.debtRepository,
        manager,
        userId,
        candidates.map((d) => d.id),
      );
      // Новый долг, появившийся после первого чтения, не заблокирован — в зачёт не берётся.
      // Пока ждали замок, долг могли закрыть или переименовать: берутся только подходящие и сейчас.
      const debts = candidates
        .map((candidate) => locked.get(candidate.id))
        .filter(
          (d): d is Debt =>
            !!d && !d.isClosed && d.personName === personName && d.currency === currency,
        );
      const plan = planOffset(debts.map(toSettlementDebt));

      if (plan.offsetAmount <= 0) {
        throw new ConflictException('Нет встречных долгов для зачёта');
      }

      // Одна отметка времени на весь зачёт: записи расчёта в ленте стоят рядом.
      const writer = this.writer(manager, userId);
      const touched = await writeOffsetParts(writer, locked, plan.parts, new Date());

      return { plan, touched, settlementId: writer.settlementId };
    });

    return {
      personName,
      currency,
      offsetAmount: plan.offsetAmount,
      debts: DebtResponseMapper.toResponseList(touched),
      settlementId,
    };
  }

  /** «Закрыть все»: зачёт встречных долгов и платежи по остальным одним расчётом. */
  closeAll(command: CloseAllDebtsCommand): Promise<CloseAllResultDto> {
    return closeAllDebts(this.deps(), command);
  }

  /** Тот же план, что у `closeAll`, без записи. */
  previewCloseAll(query: PreviewCloseAllQuery): Promise<CloseAllPreviewDto> {
    return previewCloseAll(this.deps(), query);
  }

  /** Отмена расчёта по его id: затронутые долги возвращаются, записи уходят вместе. */
  async reverse(userId: string, settlementId: string, manager?: EntityManager): Promise<void> {
    await reverseSettlement(this.deps(), userId, settlementId, manager);
  }

  /** Отмена закрытия долга — отмена расчёта, который его закрыл. */
  reopen(userId: string, debtId: string): Promise<Debt> {
    return reopenClosedDebt(this.deps(), userId, debtId);
  }

  /** Удаление долга со всеми его записями; общие расчёты с другими долгами отменяются штатно. */
  removeDebt(userId: string, debtId: string): Promise<void> {
    return removeDebtWithRecords(this.deps(), userId, debtId);
  }

  private writer(manager: EntityManager, userId: string): SettlementWriter {
    return new SettlementWriter(this.commandBus, this.debtRepository, manager, userId);
  }

  private deps(): SettlementDeps {
    return {
      debtRepository: this.debtRepository,
      commandBus: this.commandBus,
      dataSource: this.dataSource,
    };
  }
}
