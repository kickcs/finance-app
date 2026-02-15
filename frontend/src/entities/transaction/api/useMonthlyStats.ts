import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { transactionsApi, type MonthlyStats } from './transactionsApi';

export interface UseMonthlyStatsOptions {
  year?: number;
  month?: number; // 1-12 (not 0-11)
}

export function useMonthlyStats(
  userId: MaybeRefOrGetter<string | null>,
  options?: UseMonthlyStatsOptions,
) {
  const now = new Date();
  const year = options?.year ?? now.getFullYear();
  const month = options?.month ?? now.getMonth() + 1; // Convert to 1-12

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return ['transactions', 'monthly-stats', uid, year, month];
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKey,
    queryFn: async (): Promise<MonthlyStats> => {
      const uid = toValue(userId);
      if (!uid) {
        return {
          total_income: 0,
          total_expense: 0,
          income_by_currency: {},
          expense_by_currency: {},
        };
      }
      return transactionsApi.getMonthlyStats(uid, year, month);
    },
    enabled: computed(() => !!toValue(userId)),
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
  });

  const stats = computed<MonthlyStats>(
    () =>
      data.value ?? {
        total_income: 0,
        total_expense: 0,
        income_by_currency: {},
        expense_by_currency: {},
      },
  );

  const totalIncome = computed(() => stats.value.total_income);
  const totalExpense = computed(() => stats.value.total_expense);
  const incomeByCurrency = computed(() => stats.value.income_by_currency);
  const expenseByCurrency = computed(() => stats.value.expense_by_currency);

  return {
    stats,
    totalIncome,
    totalExpense,
    incomeByCurrency,
    expenseByCurrency,
    isLoading,
    error,
    refetch,
  };
}
