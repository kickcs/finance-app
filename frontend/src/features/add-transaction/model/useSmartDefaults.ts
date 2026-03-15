import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { transactionQueryKeys } from '@/entities/transaction';
import type { Transaction } from '@/shared/api/database.types';

interface SmartDefaults {
  defaultCategoryId: string | null;
  defaultAccountId: string | null;
}

export function useSmartDefaults(
  userId: MaybeRefOrGetter<string | null>,
  type: MaybeRefOrGetter<'expense' | 'income' | 'transfer'>,
) {
  const queryClient = useQueryClient();

  const defaults = computed<SmartDefaults>(() => {
    const uid = toValue(userId);
    const txType = toValue(type);

    if (!uid) return { defaultCategoryId: null, defaultAccountId: null };

    const cached = queryClient.getQueryData<Transaction[]>(transactionQueryKeys.list(uid));

    if (!cached || cached.length < 5) {
      return { defaultCategoryId: null, defaultAccountId: null };
    }

    const relevant = cached.filter((tx) => tx.type === txType).slice(0, 20);

    if (relevant.length === 0) {
      return { defaultCategoryId: null, defaultAccountId: null };
    }

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
