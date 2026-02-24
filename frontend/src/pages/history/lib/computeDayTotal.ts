import type { Transaction } from '@/entities/transaction';
import { DEBT_CATEGORY_IDS } from '@/entities/category';

/**
 * Compute the daily total for a group of transactions.
 *
 * Debt transactions are excluded — they are tracked in the debts section.
 * Handles net_amount for partial returns, currency conversion, and transfer exclusion.
 */
export function computeDayTotal(
  txs: Transaction[],
  userCurrency: string,
  convert: (amount: number, from: string) => number,
): number {
  return txs.reduce((sum, tx) => {
    if (DEBT_CATEGORY_IDS.has(tx.category_id)) return sum;
    if (tx.is_debt_related) return sum;
    if (tx.type === 'transfer') return sum;

    const baseAmount =
      tx.type === 'expense' && tx.net_amount !== undefined ? tx.net_amount : tx.amount;

    const amount = tx.currency !== userCurrency ? convert(baseAmount, tx.currency) : baseAmount;

    return sum + (tx.type === 'income' ? amount : -amount);
  }, 0);
}
