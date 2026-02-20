import { ref, computed, watch, toValue, type MaybeRefOrGetter } from 'vue';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/vue-query';
import { useDebounceFn } from '@vueuse/core';
import {
  transactionsApi,
  transactionQueryKeys,
  type PaginatedResult,
  type PaginatedCursor,
} from '@/entities/transaction';
import type { Transaction } from '@/entities/transaction';

const PAGE_SIZE = 20;
const MIN_SEARCH_LENGTH = 2;
const DEBOUNCE_MS = 300;

export function useServerSearch(userId: MaybeRefOrGetter<string | null>) {
  const searchTerm = ref('');
  const debouncedTerm = ref('');

  // Debounce search input to avoid excessive API calls
  const updateDebounced = useDebounceFn((value: string) => {
    debouncedTerm.value = value;
  }, DEBOUNCE_MS);

  watch(searchTerm, (value) => {
    updateDebounced(value.trim());
  });

  const isSearchActive = computed(
    () => debouncedTerm.value.length >= MIN_SEARCH_LENGTH,
  );

  const queryKey = computed(() => {
    const uid = toValue(userId);
    if (!uid || !isSearchActive.value) {
      return ['search', 'disabled'];
    }
    return transactionQueryKeys.search(uid, debouncedTerm.value);
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
      if (!uid || !isSearchActive.value) {
        return { data: [], nextCursor: null, hasMore: false };
      }
      return transactionsApi.searchPaginated(
        uid,
        debouncedTerm.value,
        PAGE_SIZE,
        pageParam,
      );
    },
    initialPageParam: undefined as PaginatedCursor | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: computed(() => !!toValue(userId) && isSearchActive.value),
    placeholderData: keepPreviousData,
  });

  // Flatten all pages into single array
  const results = computed(
    () => data.value?.pages.flatMap((page) => page.data) ?? [],
  );

  const hasResults = computed(() => results.value.length > 0);
  const isEmpty = computed(
    () => isSearchActive.value && !isLoading.value && !hasResults.value,
  );

  function setQuery(newQuery: string) {
    searchTerm.value = newQuery;
  }

  function clearSearch() {
    searchTerm.value = '';
    debouncedTerm.value = '';
  }

  return {
    searchTerm,
    results,
    isLoading,
    isSearchActive,
    hasResults,
    isEmpty,
    error,
    fetchNextPage,
    hasNextPage: computed(() => hasNextPage.value ?? false),
    isFetchingNextPage: computed(() => isFetchingNextPage.value),
    isFetching: computed(() => isFetching.value),
    setQuery,
    clearSearch,
    refetch,
  };
}
