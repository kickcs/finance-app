import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import type { Transaction } from '@/shared/api/database.types';

interface SmartDefaults {
  defaultCategoryId: string | null;
  defaultAccountId: string | null;
}

const EMPTY: SmartDefaults = { defaultCategoryId: null, defaultAccountId: null };

function topByFrequency<T>(items: T[], key: (item: T) => string): string | null {
  const freq = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function useSmartDefaults(
  transactions: MaybeRefOrGetter<Transaction[] | undefined>,
  type: MaybeRefOrGetter<'expense' | 'income' | 'transfer'>,
  currentAccountId?: MaybeRefOrGetter<string | null>,
) {
  const defaults = computed<SmartDefaults>(() => {
    const cached = toValue(transactions);
    const txType = toValue(type);
    const accountId = currentAccountId ? toValue(currentAccountId) : null;

    if (!cached || cached.length < 5) return EMPTY;

    const relevant = cached.filter((tx) => tx.type === txType).slice(0, 20);
    if (relevant.length === 0) return EMPTY;

    if (txType === 'transfer') {
      return {
        defaultCategoryId: null,
        defaultAccountId: topByFrequency(relevant, (tx) => tx.account_id),
      };
    }

    // If account is already selected, find most frequent category for THAT account
    if (accountId) {
      const forAccount = relevant.filter((tx) => tx.account_id === accountId);
      if (forAccount.length > 0) {
        return {
          defaultCategoryId: topByFrequency(forAccount, (tx) => tx.category_id),
          defaultAccountId: null, // account was externally provided, not a default
        };
      }
    }

    // No account pre-selected — find most frequent (category, account) pair
    const topPairKey = topByFrequency(relevant, (tx) => `${tx.category_id}:${tx.account_id}`);
    if (!topPairKey) return EMPTY;

    const [categoryId, pairAccountId] = topPairKey.split(':');
    return {
      defaultCategoryId: categoryId,
      defaultAccountId: pairAccountId,
    };
  });

  return { defaults };
}
