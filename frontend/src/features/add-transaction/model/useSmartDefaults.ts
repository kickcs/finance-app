import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import type { Transaction } from '@/shared/api/database.types';

interface SmartDefaults {
  defaultCategoryId: string | null;
  defaultAccountId: string | null;
}

const EMPTY: SmartDefaults = { defaultCategoryId: null, defaultAccountId: null };

export function useSmartDefaults(
  transactions: MaybeRefOrGetter<Transaction[] | undefined>,
  type: MaybeRefOrGetter<'expense' | 'income' | 'transfer'>,
) {
  const defaults = computed<SmartDefaults>(() => {
    const cached = toValue(transactions);
    const txType = toValue(type);

    if (!cached || cached.length < 5) return EMPTY;

    const relevant = cached.filter((tx) => tx.type === txType).slice(0, 20);
    if (relevant.length === 0) return EMPTY;

    if (txType === 'transfer') {
      const accountFreq = new Map<string, number>();
      for (const tx of relevant) {
        accountFreq.set(tx.account_id, (accountFreq.get(tx.account_id) ?? 0) + 1);
      }
      const topAccount = [...accountFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return { defaultCategoryId: null, defaultAccountId: topAccount };
    }

    const pairFreq = new Map<string, { categoryId: string; accountId: string; count: number }>();
    for (const tx of relevant) {
      const key = `${tx.category_id}:${tx.account_id}`;
      const existing = pairFreq.get(key);
      if (existing) {
        existing.count++;
      } else {
        pairFreq.set(key, { categoryId: tx.category_id, accountId: tx.account_id, count: 1 });
      }
    }

    const topPair = [...pairFreq.values()].sort((a, b) => b.count - a.count)[0];
    return {
      defaultCategoryId: topPair?.categoryId ?? null,
      defaultAccountId: topPair?.accountId ?? null,
    };
  });

  return { defaults };
}
