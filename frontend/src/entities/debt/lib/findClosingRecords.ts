import { CATEGORY_IDS } from '@/shared/config/categoryIds';
import { DEBT_CATEGORY_IDS } from '@/entities/category';
import type { Debt, Transaction } from '@/shared/api/database.types';

/**
 * Записи, которые снимет отмена закрытия. Зеркалит правило сервера: платёж, на
 * который ссылается `close_transaction_id`, плюс все записи прощения по долгу —
 * при «оплатил часть, остальное простил» это две разные транзакции — плюс
 * парная нога отработки: закрытие отработкой с категорией пишет трату по
 * категории и возврат долга одной отметкой времени, и сервер снимает их вместе.
 */
export function findClosingRecords(debt: Debt | null, transactions: Transaction[]): Transaction[] {
  if (!debt) return [];

  const eventDate = (t: Transaction) => t.date || t.created_at;
  const closeTransaction = transactions.find((t) => t.id === debt.close_transaction_id) ?? null;
  const closeDate = closeTransaction ? eventDate(closeTransaction) : null;

  // Недолговая категория при заполненном `debt_id` бывает только у ноги работы
  const isPairedWorkLeg = (t: Transaction) =>
    !!closeDate &&
    !t.is_informational &&
    !DEBT_CATEGORY_IDS.has(t.category_id) &&
    eventDate(t) === closeDate;

  return transactions.filter(
    (t) =>
      t.id === debt.close_transaction_id ||
      t.category_id === CATEGORY_IDS.DEBT_FORGIVEN ||
      isPairedWorkLeg(t),
  );
}

/**
 * Есть ли что снимать по данным самого долга. Нужно, чтобы отличить «записей и
 * правда нет» от «транзакции ещё не загрузились»: в обоих случаях список пуст.
 */
export function debtHasClosingRecords(debt: Debt | null): boolean {
  return !!debt && (!!debt.close_transaction_id || debt.forgiven_amount > 0);
}
