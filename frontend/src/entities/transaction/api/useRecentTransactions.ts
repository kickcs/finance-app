import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { transactionQueryKeys } from './queryKeys';
import { transactionsApi } from './transactionsApi';

export function useRecentTransactions(userId: MaybeRefOrGetter<string | null>, limit: number = 5) {
  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? transactionQueryKeys.recent(uid, limit) : transactionQueryKeys.all;
  });

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const uid = toValue(userId);
      if (!uid) return [];
      return transactionsApi.getAll(uid, limit);
    },
    enabled: computed(() => !!toValue(userId)),
  });

  const transactions = computed(() => data.value ?? []);

  return { transactions, isLoading };
}
