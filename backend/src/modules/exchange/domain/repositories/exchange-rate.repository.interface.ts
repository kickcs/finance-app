import type { ExchangeRate } from '../aggregates';

export const EXCHANGE_RATE_REPOSITORY = Symbol('EXCHANGE_RATE_REPOSITORY');

/**
 * Exchange Rate Repository Interface
 */
export interface IExchangeRateRepository {
  /**
   * Find an exchange rate by currency pair
   */
  findByPair(
    baseCurrency: string,
    targetCurrency: string,
  ): Promise<ExchangeRate | null>;

  /**
   * Find all exchange rates
   */
  findAll(): Promise<ExchangeRate[]>;

  /**
   * Find all exchange rates with a specific base currency
   */
  findByBaseCurrency(baseCurrency: string): Promise<ExchangeRate[]>;

  /**
   * Find all exchange rates with a specific target currency
   */
  findByTargetCurrency(targetCurrency: string): Promise<ExchangeRate[]>;

  /**
   * Save (insert or update) an exchange rate
   */
  save(exchangeRate: ExchangeRate): Promise<ExchangeRate>;

  /**
   * Delete an exchange rate by currency pair
   */
  delete(baseCurrency: string, targetCurrency: string): Promise<void>;

  /**
   * Check if an exchange rate exists for a currency pair
   */
  exists(baseCurrency: string, targetCurrency: string): Promise<boolean>;

  /**
   * Bulk save multiple exchange rates
   */
  saveMany(exchangeRates: ExchangeRate[]): Promise<ExchangeRate[]>;
}
