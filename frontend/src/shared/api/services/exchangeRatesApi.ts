import { http } from '../http';

// Common currencies to fetch rates for
const COMMON_CURRENCIES = ['USD', 'EUR', 'RUB', 'UZS', 'KZT', 'GBP'];

// Response type from NestJS backend
interface RateResponse {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
}

interface ConvertResponse {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  convertedAmount: number;
  rate: number;
  inverseRate: number;
}

export const exchangeRatesApi = {
  /**
   * Get exchange rates for common currencies from a base currency
   * Fetches individual rates and combines them
   */
  async getRates(baseCurrency: string): Promise<Record<string, number>> {
    const rates: Record<string, number> = {};

    // Fetch rates for all common currencies in parallel
    const targetCurrencies = COMMON_CURRENCIES.filter((c) => c !== baseCurrency);

    const promises = targetCurrencies.map(async (targetCurrency) => {
      try {
        const data = await http.get<RateResponse>(
          `/exchange-rates/${baseCurrency}/${targetCurrency}`,
        );
        return { currency: targetCurrency, rate: data.rate };
      } catch {
        // If rate not found, skip it
        return null;
      }
    });

    const results = await Promise.all(promises);

    for (const result of results) {
      if (result) {
        rates[result.currency] = result.rate;
      }
    }

    return rates;
  },

  /**
   * Get single exchange rate
   */
  async getRate(baseCurrency: string, targetCurrency: string): Promise<number | null> {
    try {
      const data = await http.get<RateResponse>(
        `/exchange-rates/${baseCurrency}/${targetCurrency}`,
      );
      return data.rate;
    } catch {
      return null;
    }
  },

  /**
   * Convert amount between currencies using backend
   */
  async convert(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return amount;

    try {
      const data = await http.get<ConvertResponse>('/exchange-rates/convert', {
        params: { amount, from: fromCurrency, to: toCurrency },
      });
      return data.convertedAmount;
    } catch {
      // If conversion fails, return original amount
      return amount;
    }
  },

  /**
   * Upsert an exchange rate
   */
  async upsertRate(baseCurrency: string, targetCurrency: string, rate: number): Promise<void> {
    await http.post('/exchange-rates', {
      baseCurrency,
      targetCurrency,
      rate,
    });
  },
};
