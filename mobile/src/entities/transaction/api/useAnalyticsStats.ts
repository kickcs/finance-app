import { useQuery } from '@tanstack/react-query';

import {
  type AnalyticsOptions,
  type DailyStatsOptions,
  transactionsApi,
} from './transactionsApi';
import { transactionKeys } from './queryKeys';

export function useAnalyticsStats(userId: string | null, options: AnalyticsOptions) {
  return useQuery({
    queryKey: [
      ...transactionKeys.all,
      'analytics',
      userId ?? '__disabled__',
      options.startDate,
      options.endDate,
      options.accountIds?.join(',') ?? '',
    ] as const,
    queryFn: () => transactionsApi.getAnalyticsStats(options),
    enabled: !!userId && !!options.startDate && !!options.endDate,
    staleTime: 60_000,
  });
}

export function useDailyStats(userId: string | null, options: DailyStatsOptions) {
  return useQuery({
    queryKey: [
      ...transactionKeys.all,
      'daily',
      userId ?? '__disabled__',
      options.startDate,
      options.endDate,
      options.groupBy ?? 'day',
      options.accountIds?.join(',') ?? '',
    ] as const,
    queryFn: () => transactionsApi.getDailyStats(options),
    enabled: !!userId && !!options.startDate && !!options.endDate,
    staleTime: 60_000,
  });
}
