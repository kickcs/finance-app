export interface ExchangeRateData {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  date: Date;
}

export interface IExchangeRateProvider {
  fetchRates(
    baseCurrency: string,
    targetCurrencies: string[],
  ): Promise<ExchangeRateData[]>;
}

export const EXCHANGE_RATE_PROVIDER = Symbol('EXCHANGE_RATE_PROVIDER');
