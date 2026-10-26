import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { Debt } from '../../domain/aggregates/debt';
import { DebtResponseMapper, type DebtResponseDto } from '../mappers/debt-response.mapper';
import type { CloseAllDebtsCommand } from '../commands/close-all-debts/close-all-debts.command';
import type { PreviewCloseAllQuery } from '../queries/preview-close-all/preview-close-all.query';
import {
  planCloseAll,
  planCloseAllMixed,
  planPayment,
  remainingAfterOffset,
  type CloseAllPayment,
  type CloseAllPlan,
  type CloseAllPlanOptions,
  type PaymentPlan,
} from './settlement-plan';
import { lockDebts, type LockedDebts } from './debt-lock';
import type { SettlementDeps } from './settlement-deps';
import {
  loadOpenDebt,
  toSettlementDebt,
  writeDebtPayment,
  writeOffsetParts,
} from './settlement-records';
import { SettlementWriter } from './settlement-writer';

export interface CloseAllResultDto {
  settlementId: string;
  /** Все переданные долги после операции — в порядке запроса. */
  debts: DebtResponseDto[];
  /** Записи платежей в порядке оплаты: без зачёта, переплаты и прощения. */
  paymentTransactionIds: string[];
  offsetAmount: number;
  excess: number;
}

export interface CloseAllPreviewDto {
  offsetAmount: number;
  /** Чья сторона переживёт зачёт; null — зачёта нет. */
  direction: 'given' | 'taken' | null;
  /** Остаток после зачёта: то, что покрывают платежи. */
  net: number;
  offsetParts: { debtId: string; amount: number }[];
  payments: CloseAllPayment[];
  excess: number;
  totalDebt: number;
}

/**
 * Долги расчёта: свои и открытые, без повторов, в порядке запроса. Любая ошибка — до первой записи.
 * `locked` — долги под замком в открытой транзакции; без него (предпросмотр) все читаются одним запросом.
 */
async function loadDebts(
  deps: SettlementDeps,
  userId: string,
  debtIds: string[],
  locked?: { manager: EntityManager; known: LockedDebts },
): Promise<Debt[]> {
  if (debtIds.length === 0) throw new BadRequestException('Не выбраны долги для закрытия');

  const ids = [...new Set(debtIds)];
  const source = locked ?? {
    known: new Map((await deps.debtRepository.findByIds(ids)).map((debt) => [debt.id, debt])),
  };
  const debts: Debt[] = [];
  for (const id of ids) {
    debts.push(await loadOpenDebt(deps.debtRepository, userId, id, source));
  }
  return debts;
}

function buildPlan(debts: Debt[], input: CloseAllPlanOptions): CloseAllPlan {
  const mixed = new Set(debts.map((d) => d.currency)).size > 1;

  // Зачёт между валютами невозможен; одна сторона в нескольких валютах платится
  // или прощается целиком — допустимые входы проверяет сам план.
  if (mixed && new Set(debts.map((d) => d.debtTypeValue)).size > 1) {
    throw new BadRequestException('Встречные долги сводятся только в одной валюте');
  }
  return (mixed ? planCloseAllMixed : planCloseAll)(debts.map(toSettlementDebt), input);
}

export async function previewCloseAll(
  deps: SettlementDeps,
  input: PreviewCloseAllQuery,
): Promise<CloseAllPreviewDto> {
  const debts = await loadDebts(deps, input.userId, input.debtIds);
  const plan = buildPlan(debts, input);

  return {
    offsetAmount: plan.offset?.offsetAmount ?? 0,
    direction: plan.offset?.direction ?? null,
    // Без зачёта вся сумма остаётся на своей стороне.
    net: plan.offset?.net ?? plan.totalDebt,
    offsetParts: plan.offset?.parts ?? [],
    payments: plan.payments,
    excess: plan.excess,
    totalDebt: plan.totalDebt,
  };
}

/**
 * «Закрыть все» одним расчётом: зачёт по переданным долгам (а не по имени человека —
 * что пользователь видел одной строкой, то и сводится), затем платежи старыми первыми.
 * Одна транзакция БД и один писатель: сбой на любом шаге откатывает всё, а долги заперты
 * с самого начала — второй такой же вызов дождётся и получит «уже закрыт».
 */
export async function closeAllDebts(
  deps: SettlementDeps,
  input: CloseAllDebtsCommand,
): Promise<CloseAllResultDto> {
  const { userId, accountId, date, excessCategoryId } = input;

  return deps.dataSource.transaction(async (manager) => {
    const known = await lockDebts(deps.debtRepository, manager, userId, input.debtIds);
    const debts = await loadDebts(deps, userId, input.debtIds, { manager, known });
    const plan = buildPlan(debts, input);
    if (!plan.offset && plan.payments.length === 0) {
      throw new BadRequestException('Некорректная сумма платежа');
    }

    const offsetById = new Map((plan.offset?.parts ?? []).map((p) => [p.debtId, p.amount]));

    // Платежи проверяются до записи: ошибка в последнем не должна оставить зачёт без платежей.
    const payments: { debt: Debt; plan: PaymentPlan }[] = plan.payments.map((payment) => {
      const debt = known.get(payment.debtId)!;
      return {
        debt,
        plan: planPayment({
          remaining: remainingAfterOffset(toSettlementDebt(debt), offsetById),
          amount: payment.amount,
          forgiveRemainder: payment.forgive,
          settleWithWork: false,
          excessCategoryId: payment.withExcess ? excessCategoryId : undefined,
        }),
      };
    });

    const writer = new SettlementWriter(deps.commandBus, deps.debtRepository, manager, userId);
    await writeOffsetParts(writer, known, plan.offset?.parts ?? [], date);

    const paymentTransactionIds: string[] = [];
    for (const payment of payments) {
      const written = await writeDebtPayment(writer, {
        debt: payment.debt,
        plan: payment.plan,
        accountId,
        date,
        excessCategoryId,
      });
      if (written.paymentTransactionId) paymentTransactionIds.push(written.paymentTransactionId);
    }

    return {
      settlementId: writer.settlementId,
      debts: DebtResponseMapper.toResponseList(debts),
      paymentTransactionIds,
      offsetAmount: plan.offset?.offsetAmount ?? 0,
      excess: plan.excess,
    };
  });
}
