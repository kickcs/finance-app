import { computed } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import type { Transaction, TransactionGroup } from './types';
import { formatDateGroup } from '@/shared/lib/format/date';

/**
 * Options for controlling grouping behaviour.
 *
 * @param transactions - reactive array of transactions to group
 * @param computeTotal - callback that receives the transactions in a group and
 *   the raw date key, and returns the numeric total shown in the group header.
 *   Defaults to summing income minus expense (excluding transfers).
 * @param sortGroups - when true (default) groups are sorted newest-first by the
 *   date of the first transaction in the group.
 * @param sortTransactions - comparator used to order transactions within a group.
 *   Defaults to descending `created_at`.
 */
export interface UseGroupedTransactionsOptions {
  computeTotal?: (txs: Transaction[], dateKey: string) => number;
  sortGroups?: boolean;
  sortTransactions?: (a: Transaction, b: Transaction) => number;
}

/**
 * Groups a flat reactive list of transactions by date and returns a computed
 * `TransactionGroup[]` compatible with `VirtualGroupedTransactionList`.
 *
 * The common logic extracted from HistoryPage and AccountDetailPage:
 * - bucket transactions by `formatDateGroup(tx.date)`
 * - sort transactions within each bucket (caller-controlled comparator)
 * - optionally sort groups newest-first
 * - compute a signed daily total via a caller-supplied callback
 */
export function useGroupedTransactions(
  transactions: Ref<Transaction[]> | ComputedRef<Transaction[]>,
  options: UseGroupedTransactionsOptions = {},
): ComputedRef<TransactionGroup[]> {
  const {
    computeTotal = defaultComputeTotal,
    sortGroups = true,
    sortTransactions = defaultSortTransactions,
  } = options;

  return computed<TransactionGroup[]>(() => {
    const groups: Record<string, Transaction[]> = {};

    for (const tx of transactions.value) {
      const dateKey = formatDateGroup(tx.date);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(tx);
    }

    let entries = Object.entries(groups);

    if (sortGroups) {
      entries = entries.sort((a, b) => {
        const dateA = new Date(a[1][0].date).getTime();
        const dateB = new Date(b[1][0].date).getTime();
        return dateB - dateA;
      });
    }

    return entries.map(([date, txs]) => ({
      date,
      transactions: [...txs].sort(sortTransactions),
      total: computeTotal(txs, date),
    }));
  });
}

// ---------------------------------------------------------------------------
// Default helpers
// ---------------------------------------------------------------------------

/** Sort transactions newest-first by created_at (HistoryPage behaviour). */
function defaultSortTransactions(a: Transaction, b: Transaction): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/**
 * Default total: income – expense, transfers excluded.
 * Does not perform currency conversion; callers that need multi-currency
 * totals should supply their own `computeTotal` callback.
 */
function defaultComputeTotal(txs: Transaction[]): number {
  return txs.reduce((sum, tx) => {
    if (tx.type === 'transfer') return sum;
    return sum + (tx.type === 'income' ? tx.amount : -tx.amount);
  }, 0);
}
