import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, keepPreviousData } from '@tanstack/vue-query';
import { transactionsApi, type AnalyticsStats } from './transactionsApi';
import { transactionQueryKeys } from './queryKeys';

export interface UseAnalyticsStatsOptions {
  startDate: MaybeRefOrGetter<string | null>;
  endDate: MaybeRefOrGetter<string | null>;
  accountIds?: MaybeRefOrGetter<string[]>;
}

const emptyStats: AnalyticsStats = {
  totalIncome: 0,
  totalExpense: 0,
  incomeByCurrency: {},
  expenseByCurrency: {},
  categoryBreakdown: [],
};

export function useAnalyticsStats(options: UseAnalyticsStatsOptions) {
  const queryKey = computed(() => {
    const start = toValue(options.startDate);
    const end = toValue(options.endDate);
    const accounts = toValue(options.accountIds) ?? [];
    return transactionQueryKeys.analyticsStats(start, end, accounts);
  });

  const enabled = computed(() => {
    const start = toValue(options.startDate);
    const end = toValue(options.endDate);
    return !!start && !!end;
  });

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: queryKey,
    queryFn: async (): Promise<AnalyticsStats> => {
      const start = toValue(options.startDate);
      const end = toValue(options.endDate);
      const accounts = toValue(options.accountIds);

      if (!start || !end) {
        return emptyStats;
      }

      return transactionsApi.getAnalyticsStats({
        startDate: start,
        endDate: end,
        accountIds: accounts && accounts.length > 0 ? accounts : undefined,
      });
    },
    enabled: enabled,
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    placeholderData: keepPreviousData,
  });

  const stats = computed<AnalyticsStats>(() => data.value ?? emptyStats);

  const totalIncome = computed(() => stats.value.totalIncome);
  const totalExpense = computed(() => stats.value.totalExpense);
  const incomeByCurrency = computed(() => stats.value.incomeByCurrency);
  const expenseByCurrency = computed(() => stats.value.expenseByCurrency);
  const categoryBreakdown = computed(() => stats.value.categoryBreakdown);

  return {
    stats,
    totalIncome,
    totalExpense,
    incomeByCurrency,
    expenseByCurrency,
    categoryBreakdown,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}
