import type { Debt, Transaction } from '@/shared/api/database.types';

/**
 * Записи, которые снимет отмена закрытия. Зеркалит правило сервера: отменяется
 * расчёт целиком — платёж, на который ссылается `close_transaction_id`, и все
 * записи с тем же `settlement_id` (нога отработки, переплата, прощение остатка).
 * У записи без расчёта (старое закрытие) снимается она одна.
 */
export function findClosingRecords(debt: Debt | null, transactions: Transaction[]): Transaction[] {
  if (!debt) return [];

  const closing = transactions.find((t) => t.id === debt.close_transaction_id);
  if (!closing) return [];
  if (!closing.settlement_id) return [closing];

  return transactions.filter((t) => t.settlement_id === closing.settlement_id);
}

/**
 * Есть ли что снимать по данным самого долга. Нужно, чтобы отличить «записей и
 * правда нет» от «транзакции ещё не загрузились»: в обоих случаях список пуст.
 */
export function debtHasClosingRecords(debt: Debt | null): boolean {
  return !!debt && (!!debt.close_transaction_id || debt.forgiven_amount > 0);
}
