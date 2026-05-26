import type { QueryClient } from '@tanstack/react-query';

import { accountBalanceKeys } from '@/entities/account-balance/api/queryKeys';
import { accountKeys } from '@/entities/account/api/queryKeys';
import { transactionKeys } from '@/entities/transaction/api/queryKeys';

/**
 * Invalidate every transaction-derived cache slice.
 *
 * Vue parity: frontend/src/shared/api/invalidation.ts. Any transaction
 * mutation must touch list/infinite/recent/monthly/analytics/daily/hashtags —
 * miss one and the user sees stale analytics or duplicated rows in search.
 *
 * Uses broad prefix keys so account-scoped infinite queries
 * (transactionKeys.byAccountInfinite) get hit alongside user-scoped ones.
 */
export async function invalidateTransactionRelated(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
    queryClient.invalidateQueries({ queryKey: accountKeys.all }),
    queryClient.invalidateQueries({ queryKey: accountBalanceKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['budget'] }),
    queryClient.invalidateQueries({ queryKey: ['hashtags'] }),
  ]);
}

/** Invalidate account + balance caches (and monthly stats which read from them). */
export async function invalidateAccountRelated(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: accountKeys.all }),
    queryClient.invalidateQueries({ queryKey: accountBalanceKeys.all }),
    queryClient.invalidateQueries({ queryKey: [...transactionKeys.all, 'monthly'] }),
  ]);
}

/** Debt mutations cascade into transactions + accounts (Vue: invalidateDebtRelated). */
export async function invalidateDebtRelated(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['debts'] }),
    invalidateTransactionRelated(queryClient),
  ]);
}

/** Auto-charge on recurring subscription touches accounts + transactions. */
export async function invalidateSubscriptionRelated(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['recurring-subscription'] }),
    invalidateAccountRelated(queryClient),
    invalidateTransactionRelated(queryClient),
  ]);
}
