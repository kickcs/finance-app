import type { QueryClient } from '@tanstack/vue-query';
import { transactionQueryKeys } from '@/entities/transaction';
import { accountQueryKeys } from '@/entities/account';
import { accountBalanceQueryKeys } from '@/entities/account-balance';

/**
 * Invalidate all transaction-related caches.
 * Covers: list, infinite (all), monthlyStats, recent, search, count, analyticsStats.
 *
 * Uses broad prefix keys (e.g. infinitePrefix covers both user-scoped and account-scoped infinite queries).
 */
export async function invalidateTransactionRelated(
  queryClient: QueryClient,
  userId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: transactionQueryKeys.list(userId),
    }),
    // Covers: infinite(userId, filters) + infiniteByAccount(accountId)
    queryClient.invalidateQueries({
      queryKey: transactionQueryKeys.infinitePrefix(),
    }),
    queryClient.invalidateQueries({
      queryKey: transactionQueryKeys.monthlyStatsPrefix(),
    }),
    queryClient.invalidateQueries({
      queryKey: transactionQueryKeys.recent(userId),
    }),
    queryClient.invalidateQueries({
      queryKey: transactionQueryKeys.searchPrefix(),
    }),
    queryClient.invalidateQueries({
      queryKey: transactionQueryKeys.countPrefix(),
    }),
    queryClient.invalidateQueries({
      queryKey: transactionQueryKeys.analyticsStatsPrefix(),
    }),
  ]);
}

/**
 * Invalidate all account-related caches (accounts + balances).
 */
export async function invalidateAccountRelated(
  queryClient: QueryClient,
  userId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: accountQueryKeys.list(userId),
    }),
    queryClient.invalidateQueries({
      queryKey: accountBalanceQueryKeys.all,
    }),
  ]);
}
