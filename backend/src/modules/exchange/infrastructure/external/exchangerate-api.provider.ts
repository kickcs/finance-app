import { Injectable, Logger } from '@nestjs/common';
import {
  ExchangeRateData,
  IExchangeRateProvider,
} from './exchange-rate-provider.interface';

interface ExchangeRateApiResponse {
  result: string;
  base_code: string;
  rates: Record<string, number>;
}

@Injectable()
export class ExchangeRateApiProvider implements IExchangeRateProvider {
  private readonly logger = new Logger(ExchangeRateApiProvider.name);
  private readonly baseUrl = 'https://open.er-api.com/v6/latest';

  async fetchRates(
    baseCurrency: string,
    targetCurrencies: string[],
  ): Promise<ExchangeRateData[]> {
    const url = `${this.baseUrl}/${baseCurrency}`;

    try {
      this.logger.log(
        `Fetching exchange rates for ${baseCurrency} -> ${targetCurrencies.join(', ')}`,
      );

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as ExchangeRateApiResponse;

      if (data.result !== 'success') {
        throw new Error(`API returned error: ${data.result}`);
      }

      const now = new Date();
      const rates: ExchangeRateData[] = [];

      for (const currency of targetCurrencies) {
        if (currency === baseCurrency) {
          // Skip same currency pair (rate is always 1)
          continue;
        }

        const rate = data.rates[currency];

        if (rate === undefined) {
          this.logger.warn(
            `Rate for ${baseCurrency}/${currency} not found in API response`,
          );
          continue;
        }

        rates.push({
          baseCurrency,
          targetCurrency: currency,
          rate,
          date: now,
        });
      }

      this.logger.log(`Successfully fetched ${rates.length} exchange rates`);

      return rates;
    } catch (error) {
      this.logger.error(
        `Failed to fetch exchange rates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
