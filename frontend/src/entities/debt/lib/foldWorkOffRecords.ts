import { CATEGORY_IDS } from '@/shared/config/categoryIds';
import { DEBT_CATEGORY_IDS } from '@/entities/category';
import type { Transaction } from '@/shared/api/database.types';

export interface DebtPaymentRecord {
  transaction: Transaction;
  /** Долг погашен работой, а не деньгами. */
  byWork: boolean;
}

/**
 * Записи гашения долга для ленты: платежи деньгами и отработки, в одном
 * хронологическом ряду.
 *
 * Отработка приезжает в двух видах. Без категории это одна информационная
 * отметка. С категорией сервер пишет пару на ноль по балансу — трату по
 * выбранной категории и обычный возврат долга; в ленте долга такая пара должна
 * читаться одним событием, поэтому возврат прячется за своей тратой (её
 * описание и категория говорят больше). Пара узнаётся по общему `settlement_id`.
 * Записи без `debt_id` (переплата) к платежам долга не относятся.
 */
export function foldWorkOffRecords(
  transactions: Transaction[],
  creationTransactionId: string | null,
): DebtPaymentRecord[] {
  // Недолговая категория при заполненном `debt_id` бывает только у ноги работы
  const isWorkLeg = (t: Transaction) =>
    !!t.debt_id && !t.is_informational && !DEBT_CATEGORY_IDS.has(t.category_id);

  const workSettlementIds = new Set(
    transactions.filter(isWorkLeg).flatMap((t) => (t.settlement_id ? [t.settlement_id] : [])),
  );

  const records = transactions.filter((t) => {
    if (t.id === creationTransactionId) return false;
    if (!t.debt_id) return false;
    if (isWorkLeg(t)) return true;
    // Возврат из пары: своё событие уже показала трата по категории
    if (t.settlement_id && workSettlementIds.has(t.settlement_id) && !t.is_informational) {
      return false;
    }
    return !t.is_informational || t.category_id === CATEGORY_IDS.DEBT_WORKED_OFF;
  });

  return records
    .map((transaction) => ({
      transaction,
      byWork: isWorkLeg(transaction) || transaction.category_id === CATEGORY_IDS.DEBT_WORKED_OFF,
    }))
    .sort(
      (a, b) =>
        new Date(a.transaction.date || a.transaction.created_at).getTime() -
        new Date(b.transaction.date || b.transaction.created_at).getTime(),
    );
}
