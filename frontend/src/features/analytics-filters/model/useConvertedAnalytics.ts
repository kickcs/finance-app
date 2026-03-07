import { computed, type MaybeRefOrGetter } from 'vue';
import { useAnalyticsStats, type UseAnalyticsStatsOptions } from '@/entities/transaction';
import { useExchangeRates } from '@/shared/api';

export function useConvertedAnalytics(
  options: UseAnalyticsStatsOptions,
  currency: MaybeRefOrGetter<string>,
) {
  const {
    stats,
    categoryBreakdown,
    incomeByCurrency,
    expenseByCurrency,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAnalyticsStats(options);

  const { convert, isLoading: ratesLoading } = useExchangeRates(currency);

  const convertedIncome = computed(() =>
    Object.entries(incomeByCurrency.value).reduce(
      (sum, [curr, amt]) => sum + convert(amt, curr),
      0,
    ),
  );

  const convertedExpense = computed(() =>
    Object.entries(expenseByCurrency.value).reduce(
      (sum, [curr, amt]) => sum + convert(amt, curr),
      0,
    ),
  );

  const convertedBalance = computed(() => convertedIncome.value - convertedExpense.value);

  const savingsRate = computed(() => {
    if (convertedIncome.value <= 0) return 0;
    return (convertedBalance.value / convertedIncome.value) * 100;
  });

  const convertAmount = (amount: number, fromCurrency: string) => convert(amount, fromCurrency);

  return {
    stats,
    convertedIncome,
    convertedExpense,
    convertedBalance,
    savingsRate,
    categoryBreakdown,
    incomeByCurrency,
    expenseByCurrency,
    convertAmount,
    isLoading: computed(() => isLoading.value || ratesLoading.value),
    isFetching,
    error,
    refetch,
  };
}
