import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useInfiniteQuery } from '@tanstack/vue-query';
import { transactionQueryKeys } from './queryKeys';
import { transactionsApi, type PaginatedResult, type PaginatedCursor } from './transactionsApi';
import type { Transaction } from '@/shared/api/database.types';

const PAGE_SIZE = 20;

export function useInfiniteAccountTransactions(accountId: MaybeRefOrGetter<string | null>) {
  const queryKey = computed(() => {
    const id = toValue(accountId);
    return id ? transactionQueryKeys.infiniteByAccount(id) : transactionQueryKeys.all;
  });

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useInfiniteQuery({
      queryKey: queryKey,
      queryFn: async ({ pageParam }): Promise<PaginatedResult<Transaction>> => {
        const id = toValue(accountId);
        if (!id) return { data: [], nextCursor: null, hasMore: false };

        return transactionsApi.getByAccountPaginated(id, PAGE_SIZE, pageParam);
      },
      initialPageParam: undefined as PaginatedCursor | undefined,
      getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
      enabled: computed(() => !!toValue(accountId)),
    });

  // Flatten all pages into single array
  const transactions = computed(() => data.value?.pages.flatMap((page) => page.data) ?? []);

  const totalCount = computed(() => transactions.value.length);

  return {
    transactions,
    totalCount,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage: computed(() => hasNextPage.value ?? false),
    isFetchingNextPage: computed(() => isFetchingNextPage.value),
    refetch,
  };
}
