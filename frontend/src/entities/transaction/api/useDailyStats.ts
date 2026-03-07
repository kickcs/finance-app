import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, keepPreviousData } from '@tanstack/vue-query';
import { transactionsApi, type DailyStatsEntry } from './transactionsApi';
import { transactionQueryKeys } from './queryKeys';

export interface UseDailyStatsOptions {
  startDate: MaybeRefOrGetter<string | null>;
  endDate: MaybeRefOrGetter<string | null>;
  accountIds?: MaybeRefOrGetter<string[]>;
  groupBy?: MaybeRefOrGetter<'day' | 'week' | 'month'>;
}

export function useDailyStats(options: UseDailyStatsOptions) {
  const queryKey = computed(() => {
    const start = toValue(options.startDate);
    const end = toValue(options.endDate);
    const accounts = toValue(options.accountIds) ?? [];
    const group = toValue(options.groupBy);
    return transactionQueryKeys.dailyStats(start, end, accounts, group);
  });

  const enabled = computed(() => {
    const start = toValue(options.startDate);
    const end = toValue(options.endDate);
    return !!start && !!end;
  });

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<DailyStatsEntry[]> => {
      const start = toValue(options.startDate);
      const end = toValue(options.endDate);
      const accounts = toValue(options.accountIds);
      const group = toValue(options.groupBy);

      if (!start || !end) return [];

      return transactionsApi.getDailyStats({
        startDate: start,
        endDate: end,
        accountIds: accounts && accounts.length > 0 ? accounts : undefined,
        groupBy: group,
      });
    },
    enabled,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

  const entries = computed<DailyStatsEntry[]>(() => data.value ?? []);

  return { entries, isLoading, isFetching, error };
}
