import { CATEGORY_IDS } from '@/shared/config/categoryIds';
import type { Debt, Transaction } from '@/shared/api/database.types';

/**
 * Записи, которые снимет отмена закрытия. Зеркалит правило сервера: платёж, на
 * который ссылается `close_transaction_id`, плюс все записи прощения по долгу —
 * при «оплатил часть, остальное простил» это две разные транзакции.
 */
export function findClosingRecords(debt: Debt | null, transactions: Transaction[]): Transaction[] {
  if (!debt) return [];
  return transactions.filter(
    (t) => t.id === debt.close_transaction_id || t.category_id === CATEGORY_IDS.DEBT_FORGIVEN,
  );
}

/**
 * Есть ли что снимать по данным самого долга. Нужно, чтобы отличить «записей и
 * правда нет» от «транзакции ещё не загрузились»: в обоих случаях список пуст.
 */
export function debtHasClosingRecords(debt: Debt | null): boolean {
  return !!debt && (!!debt.close_transaction_id || debt.forgiven_amount > 0);
}
