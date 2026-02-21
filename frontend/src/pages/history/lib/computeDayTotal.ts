import type { Transaction } from '@/entities/transaction';

/**
 * Compute the daily total for a group of transactions.
 *
 * Handles debt transactions, net_amount for partial returns,
 * currency conversion, and transfer exclusion.
 */
export function computeDayTotal(
  txs: Transaction[],
  userCurrency: string,
  convert: (amount: number, from: string) => number,
): number {
  return txs.reduce((sum, tx) => {
    const isDebtGivenOrTaken =
      tx.category_id === 'debt_given' || tx.category_id === 'debt_taken';
    const isDebtReturn =
      tx.category_id === 'debt_return_to_me' ||
      tx.category_id === 'debt_return_from_me';
    if (tx.is_debt_related && !isDebtGivenOrTaken && !isDebtReturn) return sum;

    const baseAmount =
      tx.type === 'expense' && tx.net_amount !== undefined
        ? tx.net_amount
        : tx.amount;

    const amount =
      tx.currency !== userCurrency ? convert(baseAmount, tx.currency) : baseAmount;

    if (tx.category_id === 'debt_given') return sum - amount;
    if (tx.category_id === 'debt_taken') return sum + amount;
    if (tx.category_id === 'debt_return_to_me' || tx.category_id === 'debt_return_from_me') {
      return sum;
    }

    if (tx.type === 'transfer') return sum;
    return sum + (tx.type === 'income' ? amount : -amount);
  }, 0);
}
