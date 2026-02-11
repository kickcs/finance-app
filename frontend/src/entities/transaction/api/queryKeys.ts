import type { TransactionFilters } from './transactionsApi'

// Query key factory for transactions entity
export const transactionQueryKeys = {
  all: ['transactions'] as const,
  list: (userId: string) => [...transactionQueryKeys.all, 'list', userId] as const,
  byAccount: (accountId: string) => [...transactionQueryKeys.all, 'byAccount', accountId] as const,
  byDateRange: (userId: string, startDate: string, endDate: string) =>
    [...transactionQueryKeys.all, 'dateRange', userId, startDate, endDate] as const,

  // Infinite query keys
  infinite: (userId: string, filters?: TransactionFilters) =>
    [...transactionQueryKeys.all, 'infinite', userId, filters ?? {}] as const,
  infiniteByAccount: (accountId: string) =>
    [...transactionQueryKeys.all, 'infinite', 'account', accountId] as const,
  search: (userId: string, searchTerm: string) =>
    [...transactionQueryKeys.all, 'search', userId, searchTerm] as const,
}

export type TransactionQueryKeys = typeof transactionQueryKeys
