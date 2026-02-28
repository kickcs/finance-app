import { http } from '../http';

interface BatchRatesResponse {
  baseCurrency: string;
  rates: Record<string, { rate: number; updatedAt: string }>;
}

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
   * Get exchange rates for all common currencies from a base currency in one request
   */
  async getRates(baseCurrency: string): Promise<Record<string, number>> {
    const data = await http.get<BatchRatesResponse>('/exchange-rates/batch', {
      params: { base: baseCurrency },
    });

    const rates: Record<string, number> = {};
    for (const [currency, info] of Object.entries(data.rates)) {
      rates[currency] = info.rate;
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
