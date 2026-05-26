import { useQuery } from '@tanstack/react-query';
import { http } from '@/shared/api/http';

export type Rates = Record<string, number>;

const ONE_DAY = 24 * 60 * 60 * 1000;

export function useExchangeRates(baseCurrency: string | null) {
  return useQuery({
    queryKey: ['exchange-rates', baseCurrency] as const,
    queryFn: () => http<Rates>(`/api/exchange/rates?base=${baseCurrency}`),
    enabled: !!baseCurrency,
    staleTime: ONE_DAY,
    gcTime: ONE_DAY,
  });
}

export function convert(amount: number, from: string, to: string, rates: Rates): number {
  if (from === to) return amount;
  const fromRate = rates[from] ?? 1;
  const toRate = rates[to] ?? 1;
  const inBase = amount / fromRate;
  return inBase * toRate;
}
