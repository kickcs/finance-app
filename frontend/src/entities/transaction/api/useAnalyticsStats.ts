import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { transactionsApi, type AnalyticsStats } from './transactionsApi';

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
    return ['transactions', 'analytics-stats', start, end, accounts.join(',')];
  });

  const enabled = computed(() => {
    const start = toValue(options.startDate);
    const end = toValue(options.endDate);
    return !!start && !!end;
  });

  const { data, isLoading, error, refetch } = useQuery({
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
    error,
    refetch,
  };
}
