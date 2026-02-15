import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useInfiniteQuery, useQueryClient } from '@tanstack/vue-query';
import { transactionQueryKeys } from './queryKeys';
import {
  transactionsApi,
  type PaginatedResult,
  type PaginatedCursor,
} from './transactionsApi';
import type { Transaction } from '@/shared/api/database.types';

const PAGE_SIZE = 20;

export function useInfiniteAccountTransactions(
  accountId: MaybeRefOrGetter<string | null>,
) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const id = toValue(accountId);
    return id
      ? transactionQueryKeys.infiniteByAccount(id)
      : transactionQueryKeys.all;
  });

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKey,
    queryFn: async ({ pageParam }): Promise<PaginatedResult<Transaction>> => {
      const id = toValue(accountId);
      if (!id) return { data: [], nextCursor: null, hasMore: false };

      return transactionsApi.getByAccountPaginated(id, PAGE_SIZE, pageParam);
    },
    initialPageParam: undefined as PaginatedCursor | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: computed(() => !!toValue(accountId)),
  });

  // Flatten all pages into single array
  const transactions = computed(
    () => data.value?.pages.flatMap((page) => page.data) ?? [],
  );

  const totalCount = computed(() => transactions.value.length);

  // Prepend new transaction to the first page
  function prependTransaction(newTransaction: Transaction) {
    queryClient.setQueryData(queryKey.value, (old: typeof data.value) => {
      if (!old || old.pages.length === 0) return old;

      const newPages = [...old.pages];
      newPages[0] = {
        ...newPages[0],
        data: [newTransaction, ...newPages[0].data],
      };
      return { ...old, pages: newPages };
    });
  }

  // Remove transaction from cache
  function removeTransaction(transactionId: string) {
    queryClient.setQueryData(queryKey.value, (old: typeof data.value) => {
      if (!old) return old;

      const newPages = old.pages.map((page) => ({
        ...page,
        data: page.data.filter((t) => t.id !== transactionId),
      }));
      return { ...old, pages: newPages };
    });
  }

  return {
    transactions,
    totalCount,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage: computed(() => hasNextPage.value ?? false),
    isFetchingNextPage: computed(() => isFetchingNextPage.value),
    refetch,
    prependTransaction,
    removeTransaction,
  };
}
