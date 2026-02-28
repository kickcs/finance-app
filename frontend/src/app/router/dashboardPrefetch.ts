import { queryClient } from '@/shared/api/queryClient';
import { profileQueryKeys } from '@/shared/api/queryKeys';
import { accountQueryKeys } from '@/entities/account';
import { transactionQueryKeys } from '@/entities/transaction';
import { debtQueryKeys } from '@/entities/debt';
import { reminderQueryKeys } from '@/entities/reminder';
import { DEFAULT_CURRENCY } from '@/entities/currency';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

/**
 * Fire-and-forget prefetch of dashboard data.
 * Called from router guard so API calls run in parallel with page chunk download.
 * If any prefetch fails, Dashboard composables will fetch as usual.
 */
export function prefetchDashboardData(userId: string) {
  const currency = localStorage.getItem(STORAGE_KEYS.SELECTED_CURRENCY) || DEFAULT_CURRENCY;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Last month for percent change
  const lastMonth = new Date(year, now.getMonth() - 1, 1);
  const lastYear = lastMonth.getFullYear();
  const lastMonthNum = lastMonth.getMonth() + 1;

  // Dynamically import API modules to avoid adding them to the router chunk
  import('@/entities/account/api/accountsApi').then(({ accountsApi }) => {
    queryClient.prefetchQuery({
      queryKey: accountQueryKeys.list(userId),
      queryFn: () => accountsApi.getAllWithBalances(userId),
    });
  });

  import('@/entities/debt/api/debtsApi').then(({ debtsApi }) => {
    queryClient.prefetchQuery({
      queryKey: debtQueryKeys.list(userId),
      queryFn: () => debtsApi.getAll(userId),
    });
  });

  import('@/entities/reminder/api/remindersApi').then(({ remindersApi }) => {
    queryClient.prefetchQuery({
      queryKey: reminderQueryKeys.list(userId),
      queryFn: () => remindersApi.getAll(userId),
    });
  });

  import('@/entities/transaction/api/transactionsApi').then(({ transactionsApi }) => {
    queryClient.prefetchQuery({
      queryKey: transactionQueryKeys.monthlyStats(userId, year, month),
      queryFn: () => transactionsApi.getMonthlyStats(userId, year, month),
    });
    queryClient.prefetchQuery({
      queryKey: transactionQueryKeys.monthlyStats(userId, lastYear, lastMonthNum),
      queryFn: () => transactionsApi.getMonthlyStats(userId, lastYear, lastMonthNum),
    });
  });

  import('@/shared/api/services/profileApi').then(({ profileApi }) => {
    queryClient.prefetchQuery({
      queryKey: profileQueryKeys.detail(userId),
      queryFn: () => profileApi.getById(userId),
    });
  });

  import('@/shared/api/services/exchangeRatesApi').then(({ exchangeRatesApi }) => {
    queryClient.prefetchQuery({
      queryKey: ['exchangeRates', currency],
      queryFn: () => exchangeRatesApi.getRates(currency),
    });
  });
}
