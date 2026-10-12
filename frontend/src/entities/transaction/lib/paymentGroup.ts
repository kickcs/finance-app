import type { Transaction } from '@/shared/api/database.types';
import type { TransactionUpdates } from '../api/transactionsApi';

/** Поля, которые у двух частей оплаты всегда совпадают; сервер переносит их на пару сам. */
const SHARED_FIELDS = ['type', 'category_id', 'description', 'date', 'currency'] as const;

/** Вторая часть оплаты как отдельная строка: общие поля первой, свои id/счёт/сумма. */
export function buildPaymentSiblingRow(tx: Transaction): Transaction | null {
  const sibling = tx.payment_sibling;
  if (!sibling) return null;
  return {
    ...tx,
    id: sibling.id,
    account_id: sibling.account_id,
    amount: sibling.amount,
    net_amount: sibling.amount,
    payment_sibling: { id: tx.id, account_id: tx.account_id, amount: tx.amount },
  };
}

/** id строки и её пары: удаление любой части уносит обе. */
export function paymentGroupIds(tx: Pick<Transaction, 'id' | 'payment_sibling'>): string[] {
  return tx.payment_sibling ? [tx.id, tx.payment_sibling.id] : [tx.id];
}

export interface PaymentGroupEditPlan {
  /** Правка редактируемой строки. */
  row: Partial<Transaction>;
  /** Правка существующей пары; `null`, если пары нет или она удаляется. */
  sibling: Partial<Transaction> | null;
  /** Пару нужно убрать из кэшей. */
  dropSibling: boolean;
}

/**
 * Что оптимистично поменять в кэшах после правки. Баланс счетов не трогаем.
 * Новую пару строкой не вставляем: позиция в отфильтрованных списках неизвестна,
 * она появится с рефетчем после PATCH — строка лишь запоминает ссылку на неё.
 */
export function planPaymentGroupEdit(
  tx: Transaction,
  { second_part: secondPart, ...updates }: TransactionUpdates,
): PaymentGroupEditPlan {
  const row: Partial<Transaction> = { ...updates };
  // Строка расхода показывает net_amount, а не amount — без него правка суммы не видна до рефетча.
  if (updates.amount !== undefined) {
    row.net_amount = updates.amount - (tx.returned_amount ?? 0);
  }

  const existing = tx.payment_sibling;

  if (secondPart === null) {
    row.payment_group_id = null;
    row.payment_sibling = null;
    return { row, sibling: null, dropSibling: !!existing };
  }

  if (secondPart) {
    row.payment_group_id = tx.payment_group_id ?? `temp-group-${tx.id}`;
    row.payment_sibling = {
      id: existing?.id ?? `temp-${tx.id}-second`,
      account_id: secondPart.account_id,
      amount: secondPart.amount,
    };
  }

  if (!existing) return { row, sibling: null, dropSibling: false };

  const sibling: Partial<Transaction> = {
    payment_sibling: {
      id: tx.id,
      account_id: updates.account_id ?? tx.account_id,
      amount: updates.amount ?? tx.amount,
    },
  };
  for (const field of SHARED_FIELDS) {
    if (updates[field] !== undefined) Object.assign(sibling, { [field]: updates[field] });
  }
  if (secondPart) {
    sibling.account_id = secondPart.account_id;
    sibling.amount = secondPart.amount;
    sibling.net_amount = secondPart.amount;
  }
  return { row, sibling, dropSibling: false };
}
