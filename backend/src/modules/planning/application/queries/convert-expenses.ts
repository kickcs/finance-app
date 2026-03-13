import type { IExchangeRateCache } from '../../../exchange/application/services/exchange-rate-cache.service';

/** Cap displayed percentage to avoid absurd UI values. */
export const MAX_PERCENTAGE = 999;

/** Compute capped budget usage percentage. */
export function calcBudgetPercentage(spent: number, budgetAmount: number): number {
  return Math.min(Math.round((spent / budgetAmount) * 100), MAX_PERCENTAGE);
}

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
