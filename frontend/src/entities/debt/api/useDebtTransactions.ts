import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { debtQueryKeys } from './queryKeys';
import { transactionsApi } from '@/entities/transaction';

export function useDebtTransactions(debtId: MaybeRefOrGetter<string | null>) {
  const id = computed(() => toValue(debtId));

  const { data, isLoading } = useQuery({
    queryKey: computed(() => debtQueryKeys.transactions(id.value ?? '')),
    queryFn: () => {
      if (!id.value) return [];
      return transactionsApi.getByDebtId(id.value);
    },
    enabled: computed(() => !!id.value),
  });

  const transactions = computed(() => {
    const items = data.value ?? [];
    return [...items].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  });

  return { transactions, isLoading };
}
