import { computed, type ComputedRef, type Ref } from 'vue';
import type { AccountWithBalances } from '@/entities/account';
import type { Transaction } from '@/entities/transaction';

/**
 * Computes balance_after for each transaction by walking backwards
 * from current account balances.
 *
 * Only meaningful when no filters are active (full transaction set).
 */
export function useBalanceAfter(
  accounts: Ref<AccountWithBalances[]> | ComputedRef<AccountWithBalances[]>,
  displayedTransactions: ComputedRef<Transaction[]>,
  currency: ComputedRef<string>,
  isFilterActive: ComputedRef<boolean>,
) {
  const balanceAfterMap = computed(() => {
    if (isFilterActive.value) return new Map<string, number>();

    const map = new Map<string, number>();
    const running = new Map<string, number>();

    for (const acc of accounts.value) {
      for (const b of acc.balances) {
        running.set(`${acc.id}_${b.currency}`, b.balance);
      }
    }

    for (const tx of displayedTransactions.value) {
      const txCurrency = tx.currency || currency.value;
      const srcKey = `${tx.account_id}_${txCurrency}`;
      const current = running.get(srcKey);
      if (current !== undefined) {
        map.set(tx.id, current);
        if (tx.type === 'income') {
          running.set(srcKey, current - tx.amount);
        } else if (tx.type === 'expense') {
          running.set(srcKey, current + tx.amount);
        } else if (tx.type === 'transfer') {
          running.set(srcKey, current + tx.amount);
          if (tx.to_account_id) {
            const toCurrency = tx.to_currency || txCurrency;
            const destKey = `${tx.to_account_id}_${toCurrency}`;
            const dest = running.get(destKey);
            if (dest !== undefined) {
              running.set(destKey, dest - (tx.to_amount ?? tx.amount));
            }
          }
        }
      }
    }

    return map;
  });

  function getBalanceAfter(txId: string): number | undefined {
    return balanceAfterMap.value.get(txId);
  }

  return { getBalanceAfter };
}
