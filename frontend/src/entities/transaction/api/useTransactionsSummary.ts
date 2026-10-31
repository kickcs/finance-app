import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, keepPreviousData } from '@tanstack/vue-query';
import { transactionQueryKeys } from './queryKeys';
import { transactionsApi, type TransactionFilters } from './transactionsApi';

/** Итог выборки по тому же фильтру, что и лента. */
export function useTransactionsSummary(
  userId: MaybeRefOrGetter<string | null>,
  filters: MaybeRefOrGetter<TransactionFilters | undefined>,
) {
  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } = useQuery({
    queryKey: computed(() => {
      const uid = toValue(userId);
      return uid ? transactionQueryKeys.summary(uid, toValue(filters)) : transactionQueryKeys.all;
    }),
    queryFn: () => transactionsApi.getSummary(toValue(filters)),
    enabled: computed(() => !!toValue(userId)),
    // Пока считается новый фильтр, плашка держит прежние числа, а не мигает пустотой.
    placeholderData: keepPreviousData,
  });

  return { summary: data, isLoading, isFetching, isPlaceholderData, error, refetch };
}
