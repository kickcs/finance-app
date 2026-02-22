import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { exchangeRatesApi } from '../services/exchangeRatesApi';

const STALE_TIME = 24 * 60 * 60 * 1000; // 1 day

export function useExchangeRates(baseCurrency: MaybeRefOrGetter<string>) {
  const queryKey = computed(() => ['exchangeRates', toValue(baseCurrency)]);

  const {
    data: rates,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => exchangeRatesApi.getRates(toValue(baseCurrency)),
    staleTime: STALE_TIME,
    gcTime: STALE_TIME,
    enabled: computed(() => !!toValue(baseCurrency)),
  });

  /**
   * Convert amount from a currency to base currency
   */
  function convert(amount: number, fromCurrency: string): number {
    const base = toValue(baseCurrency);

    if (fromCurrency === base) return amount;

    const ratesData = rates.value;
    if (!ratesData) return amount;

    // If we have direct rate from base to fromCurrency, we need inverse
    const directRate = ratesData[fromCurrency];
    if (directRate) {
      // rates are base -> target, so to convert target -> base we divide
      return amount / directRate;
    }

    return amount;
  }

  /**
   * Convert amount from one currency to another
   */
  function convertBetween(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) return amount;

    const ratesData = rates.value;
    if (!ratesData) return amount;

    const base = toValue(baseCurrency);

    // Convert to base currency first, then to target
    let inBase = amount;
    if (fromCurrency !== base) {
      const fromRate = ratesData[fromCurrency];
      if (fromRate) {
        inBase = amount / fromRate;
      }
    }

    if (toCurrency === base) return inBase;

    const toRate = ratesData[toCurrency];
    if (toRate) {
      return inBase * toRate;
    }

    return amount;
  }

  /**
   * Get rate for a specific currency pair
   */
  function getRate(targetCurrency: string): number | null {
    const ratesData = rates.value;
    if (!ratesData) return null;
    return ratesData[targetCurrency] ?? null;
  }

  return {
    rates,
    isLoading,
    error,
    refetch,
    convert,
    convertBetween,
    getRate,
  };
}
