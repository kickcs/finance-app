import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import {
  useInfiniteQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/vue-query';
import { transactionQueryKeys } from './queryKeys';
import {
  transactionsApi,
  type TransactionFilters,
  type PaginatedResult,
  type PaginatedCursor,
} from './transactionsApi';
import type { Transaction } from '@/shared/api/database.types';

const PAGE_SIZE = 20;

export function useInfiniteTransactions(
  userId: MaybeRefOrGetter<string | null>,
  filters?: MaybeRefOrGetter<TransactionFilters | undefined>,
) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const uid = toValue(userId);
    const f = toValue(filters);
    return uid
      ? transactionQueryKeys.infinite(uid, f)
      : transactionQueryKeys.all;
  });

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKey,
    queryFn: async ({ pageParam }): Promise<PaginatedResult<Transaction>> => {
      const uid = toValue(userId);
      if (!uid) return { data: [], nextCursor: null, hasMore: false };

      const f = toValue(filters);
      return transactionsApi.getPaginated(uid, PAGE_SIZE, pageParam, f);
    },
    initialPageParam: undefined as PaginatedCursor | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: computed(() => !!toValue(userId)),
    placeholderData: keepPreviousData,
  });

  // Flatten all pages into single array
  const transactions = computed(
    () => data.value?.pages.flatMap((page) => page.data) ?? [],
  );

  const totalCount = computed(() => transactions.value.length);

  // Prepend new transaction to the first page (for realtime updates)
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

  // Update transaction in cache
  function updateTransaction(updatedTransaction: Transaction) {
    queryClient.setQueryData(queryKey.value, (old: typeof data.value) => {
      if (!old) return old;

      const newPages = old.pages.map((page) => ({
        ...page,
        data: page.data.map((t) =>
          t.id === updatedTransaction.id ? updatedTransaction : t,
        ),
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
    isFetching: computed(() => isFetching.value),
    refetch,
    // Cache manipulation helpers
    prependTransaction,
    removeTransaction,
    updateTransaction,
  };
}
