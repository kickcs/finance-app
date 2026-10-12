import type { Transaction } from '@/shared/api/database.types';
import type { TransactionUpdates } from '../api/transactionsApi';

/** Поля, которые у двух частей оплаты всегда совпадают: правка строки повторяется на паре. */
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

/** Итог операции: сумма строки плюс её пары. */
export function paymentTotal(tx: Pick<Transaction, 'amount' | 'payment_sibling'>): number {
  const sibling = tx.payment_sibling;
  // Суммы с копейками: без округления 0.1 + 0.2 оставит хвост float.
  return sibling ? Math.round((tx.amount + sibling.amount) * 100) / 100 : tx.amount;
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
 * Что оптимистично поменять в кэшах после правки (балансы не трогаем). Новую пару
 * строкой не вставляем — её место в отфильтрованных списках неизвестно.
 */
export function planPaymentGroupEdit(
  tx: Transaction,
  { second_part: secondPart, ...updates }: TransactionUpdates,
): PaymentGroupEditPlan {
  const row: Partial<Transaction> = { ...updates };
  // Строка расхода показывает net_amount; returned_amount — доля возвратов этой части, net не ниже нуля.
  if (updates.amount !== undefined) {
    row.net_amount = Math.max(0, updates.amount - (tx.returned_amount ?? 0));
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
