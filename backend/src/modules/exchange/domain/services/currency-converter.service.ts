import type { ExchangeRate } from '../aggregates';

export interface ConversionResult {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  convertedAmount: number;
  rate: number;
  inverseRate: number;
}

/**
 * CurrencyConverterService - Pure Domain Service
 * Handles currency conversion calculations given exchange rates
 */
export class CurrencyConverterService {
  /**
   * Convert an amount between currencies using a direct exchange rate
   */
  static convert(amount: number, exchangeRate: ExchangeRate): ConversionResult {
    const convertedAmount = exchangeRate.convert(amount);

    return {
      amount,
      fromCurrency: exchangeRate.baseCurrency,
      toCurrency: exchangeRate.targetCurrency,
      convertedAmount,
      rate: exchangeRate.rate,
      inverseRate: exchangeRate.getInverseRate(),
    };
  }

  /**
   * Convert an amount using the inverse of the exchange rate
   * (when converting from target currency to base currency)
   */
  static convertInverse(
    amount: number,
    exchangeRate: ExchangeRate,
  ): ConversionResult {
    const convertedAmount = exchangeRate.convertReverse(amount);

    return {
      amount,
      fromCurrency: exchangeRate.targetCurrency,
      toCurrency: exchangeRate.baseCurrency,
      convertedAmount,
      rate: exchangeRate.getInverseRate(),
      inverseRate: exchangeRate.rate,
    };
  }

  /**
   * Convert through an intermediate currency (cross-rate conversion)
   * Useful when direct rate is not available
   * e.g., EUR -> USD -> JPY (using EUR/USD and USD/JPY rates)
   */
  static convertCrossRate(
    amount: number,
    firstRate: ExchangeRate,
    secondRate: ExchangeRate,
  ): ConversionResult {
    // First conversion
    const intermediateAmount = firstRate.convert(amount);
    // Second conversion
    const convertedAmount = secondRate.convert(intermediateAmount);

    const combinedRate = firstRate.rate * secondRate.rate;

    return {
      amount,
      fromCurrency: firstRate.baseCurrency,
      toCurrency: secondRate.targetCurrency,
      convertedAmount,
      rate: combinedRate,
      inverseRate: 1 / combinedRate,
    };
  }

  /**
   * Calculate the cross rate between two currencies
   * given their rates against a common intermediate currency
   */
  static calculateCrossRate(
    firstRate: ExchangeRate,
    secondRate: ExchangeRate,
  ): number {
    // Assuming both rates have the same base currency
    // e.g., USD/EUR and USD/JPY -> calculate EUR/JPY
    if (firstRate.baseCurrency !== secondRate.baseCurrency) {
      throw new Error(
        'Cross rate calculation requires rates with the same base currency',
      );
    }

    // EUR/JPY = (USD/JPY) / (USD/EUR) = JPY_rate / EUR_rate
    return secondRate.rate / firstRate.rate;
  }

  /**
   * Check if two amounts in different currencies are equivalent
   * within a given tolerance (for floating point comparison)
   */
  static areEquivalent(
    amount1: number,
    currency1: string,
    amount2: number,
    currency2: string,
    exchangeRate: ExchangeRate,
    tolerance: number = 0.01,
  ): boolean {
    let convertedAmount: number;

    if (
      exchangeRate.baseCurrency === currency1 &&
      exchangeRate.targetCurrency === currency2
    ) {
      convertedAmount = exchangeRate.convert(amount1);
    } else if (
      exchangeRate.baseCurrency === currency2 &&
      exchangeRate.targetCurrency === currency1
    ) {
      convertedAmount = exchangeRate.convert(amount2);
      return Math.abs(convertedAmount - amount1) <= tolerance;
    } else {
      throw new Error(
        'Exchange rate currencies do not match provided currencies',
      );
    }

    return Math.abs(convertedAmount - amount2) <= tolerance;
  }
}
