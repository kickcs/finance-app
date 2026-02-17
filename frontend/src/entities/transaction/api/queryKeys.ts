import type { TransactionFilters } from './transactionsApi';
import { cleanUndefined } from '@/shared/lib/utils';

// Query key factory for transactions entity
export const transactionQueryKeys = {
  all: ['transactions'] as const,
  list: (userId: string) =>
    [...transactionQueryKeys.all, 'list', userId] as const,
  byAccount: (accountId: string) =>
    [...transactionQueryKeys.all, 'byAccount', accountId] as const,
  byDateRange: (userId: string, startDate: string, endDate: string) =>
    [
      ...transactionQueryKeys.all,
      'dateRange',
      userId,
      startDate,
      endDate,
    ] as const,

  // Infinite query keys - strip undefined/empty values for stable serialization
  infinite: (userId: string, filters?: TransactionFilters) =>
    [
      ...transactionQueryKeys.all,
      'infinite',
      userId,
      cleanUndefined(filters ?? {}),
    ] as const,
  infiniteByAccount: (accountId: string) =>
    [...transactionQueryKeys.all, 'infinite', 'account', accountId] as const,
  search: (userId: string, searchTerm: string) =>
    [...transactionQueryKeys.all, 'search', userId, searchTerm] as const,
  countByAccount: (accountId: string) =>
    [...transactionQueryKeys.all, 'count', 'account', accountId] as const,
  recent: (userId: string) =>
    [...transactionQueryKeys.all, 'recent', userId] as const,
};

export type TransactionQueryKeys = typeof transactionQueryKeys;
