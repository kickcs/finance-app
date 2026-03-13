import type { IExchangeRateCache } from '../../../exchange/application/services/exchange-rate-cache.service';

/**
 * Convert a multi-currency expense map to a single target currency.
 * Returns the total rounded to 2 decimal places.
 */
export function convertExpensesToCurrency(
  expenseByCurrency: Record<string, number>,
  targetCurrency: string,
  cache: IExchangeRateCache,
): number {
  let total = 0;
  for (const [currency, amount] of Object.entries(expenseByCurrency)) {
    if (currency === targetCurrency) {
      total += amount;
    } else {
      const rateResult = cache.resolve(currency, targetCurrency);
      total += rateResult ? amount * rateResult.rate : amount;
    }
  }
  return Math.round(total * 100) / 100;
}
