import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/vue-query';
import { debtQueryKeys } from './queryKeys';
import { debtsApi } from './debtsApi';
import type { DebtsFilters, DebtsPaginatedCursor, PaginatedDebtsResult } from '../model/types';

const PAGE_SIZE = 10;

export function useInfiniteDebts(
  userId: MaybeRefOrGetter<string | null>,
  filters?: MaybeRefOrGetter<DebtsFilters | undefined>,
) {
  const queryKey = computed(() => {
    const uid = toValue(userId);
    const f = toValue(filters);
    return uid ? debtQueryKeys.infinite(uid, f) : debtQueryKeys.all;
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
    queryFn: async ({ pageParam }): Promise<PaginatedDebtsResult> => {
      const uid = toValue(userId);
      if (!uid)
        return {
          groups: [],
          totalSummary: { totalGiven: {}, totalTaken: {} },
          nextCursor: null,
          hasMore: false,
          totalDebtsCount: 0,
        };

      const f = toValue(filters);
      return debtsApi.getPaginated(uid, PAGE_SIZE, pageParam, f);
    },
    initialPageParam: undefined as DebtsPaginatedCursor | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    enabled: computed(() => !!toValue(userId)),
    placeholderData: keepPreviousData,
  });

  const groups = computed(() => data.value?.pages.flatMap((page) => page.groups) ?? []);

  const totalDebtsCount = computed(() => data.value?.pages[0]?.totalDebtsCount ?? 0);

  const totalSummary = computed(
    () =>
      data.value?.pages[0]?.totalSummary ?? {
        totalGiven: {},
        totalTaken: {},
      },
  );

  return {
    groups,
    totalDebtsCount,
    totalSummary,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage: computed(() => hasNextPage.value ?? false),
    isFetchingNextPage: computed(() => isFetchingNextPage.value),
    isFetching: computed(() => isFetching.value),
    refetch,
  };
}
