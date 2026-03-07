import type { TransactionFilters } from './transactionsApi';
import { cleanUndefined } from '@/shared/lib/utils';

// Query key factory for transactions entity
export const transactionQueryKeys = {
  all: ['transactions'] as const,
  list: (userId: string) => [...transactionQueryKeys.all, 'list', userId] as const,
  byAccount: (accountId: string) => [...transactionQueryKeys.all, 'byAccount', accountId] as const,
  byDateRange: (userId: string, startDate: string, endDate: string) =>
    [...transactionQueryKeys.all, 'dateRange', userId, startDate, endDate] as const,

  // Infinite query keys - strip undefined/empty values for stable serialization
  infinitePrefix: () => [...transactionQueryKeys.all, 'infinite'] as const,
  infinite: (userId: string, filters?: TransactionFilters) =>
    [...transactionQueryKeys.all, 'infinite', userId, cleanUndefined(filters ?? {})] as const,
  infiniteByAccount: (accountId: string) =>
    [...transactionQueryKeys.all, 'infinite', 'account', accountId] as const,
  searchPrefix: () => [...transactionQueryKeys.all, 'search'] as const,
  search: (userId: string, searchTerm: string) =>
    [...transactionQueryKeys.all, 'search', userId, searchTerm] as const,
  countPrefix: () => [...transactionQueryKeys.all, 'count'] as const,
  countByAccount: (accountId: string) =>
    [...transactionQueryKeys.all, 'count', 'account', accountId] as const,
  recent: (userId: string, limit?: number) =>
    [...transactionQueryKeys.all, 'recent', userId, ...(limit ? [limit] : [])] as const,
  monthlyStats: (userId: string, year: number, month: number) =>
    [...transactionQueryKeys.all, 'monthly-stats', userId, year, month] as const,
  monthlyStatsPrefix: () => [...transactionQueryKeys.all, 'monthly-stats'] as const,
  analyticsStats: (startDate: string | null, endDate: string | null, accountIds: string[]) =>
    [
      ...transactionQueryKeys.all,
      'analytics-stats',
      startDate,
      endDate,
      accountIds.join(','),
    ] as const,
  analyticsStatsPrefix: () => [...transactionQueryKeys.all, 'analytics-stats'] as const,
  dailyStats: (
    startDate: string | null,
    endDate: string | null,
    accountIds: string[],
    groupBy?: string,
  ) =>
    [
      ...transactionQueryKeys.all,
      'daily-stats',
      startDate,
      endDate,
      accountIds.join(','),
      groupBy,
    ] as const,
  dailyStatsPrefix: () => [...transactionQueryKeys.all, 'daily-stats'] as const,
  hashtags: (userId: string) => [...transactionQueryKeys.all, 'hashtags', userId] as const,
};

export type TransactionQueryKeys = typeof transactionQueryKeys;
