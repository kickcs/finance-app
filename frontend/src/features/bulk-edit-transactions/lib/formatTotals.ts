import { formatCurrency } from '@/shared/lib/format/currency';

export interface CurrencyTotal {
  currency: string;
  amount: number;
}

/**
 * Суммы по валютам со знаком: расход «−», доход «+». Общей суммы нет — валюты не складываются.
 * Нулевые и пустые итоги дают «0»: «+0 UZS» читалось бы как операция без денег.
 */
export function formatTotals(
  totals: readonly CurrencyTotal[],
  { compact = false }: { compact?: boolean } = {},
): string {
  const parts = totals
    .filter((total) => total.amount !== 0)
    .map((total) => formatCurrency(total.amount, total.currency, { showSign: true, compact }));
  return parts.length > 0 ? parts.join(' · ') : '0';
}
