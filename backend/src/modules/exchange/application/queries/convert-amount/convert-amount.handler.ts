import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { ConvertAmountQuery } from './convert-amount.query';
import {
  IExchangeRateCache,
  EXCHANGE_RATE_CACHE,
} from '../../services/exchange-rate-cache.service';
import { CurrencyConverterService } from '../../../domain/services';

const INTERMEDIATE_CURRENCY = 'USD';

@QueryHandler(ConvertAmountQuery)
export class ConvertAmountHandler implements IQueryHandler<ConvertAmountQuery> {
  constructor(
    @Inject(EXCHANGE_RATE_CACHE)
    private readonly cache: IExchangeRateCache,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(query: ConvertAmountQuery) {
    const { amount, fromCurrency, toCurrency } = query;

    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    // Same currency - no conversion needed
    if (from === to) {
      return {
        amount,
        fromCurrency: from,
        toCurrency: to,
        convertedAmount: amount,
        rate: 1,
        inverseRate: 1,
      };
    }

    // Try direct rate first
    const exchangeRate = this.cache.get(from, to);

    if (exchangeRate) {
      return CurrencyConverterService.convert(amount, exchangeRate);
    }

    // Try inverse rate
    const inverseExchangeRate = this.cache.get(to, from);

    if (inverseExchangeRate) {
      return CurrencyConverterService.convertInverse(amount, inverseExchangeRate);
    }

    // Try cross-rate through USD (e.g., EUR -> UZS = EUR -> USD -> UZS)
    if (from !== INTERMEDIATE_CURRENCY && to !== INTERMEDIATE_CURRENCY) {
      const crossRate = this.calculateCrossRate(from, to);
      if (crossRate !== null) {
        const convertedAmount = amount * crossRate;
        return {
          amount,
          fromCurrency: from,
          toCurrency: to,
          convertedAmount: Math.round(convertedAmount * 100) / 100,
          rate: crossRate,
          inverseRate: 1 / crossRate,
        };
      }
    }

    throw new NotFoundException(`Exchange rate not found for ${from}/${to}`);
  }

  /**
   * Calculate cross-rate through USD
   * e.g., EUR -> UZS = (1/USD->EUR) * (USD->UZS)
   */
  private calculateCrossRate(from: string, to: string): number | null {
    // Get rate from USD to source currency (to calculate FROM -> USD)
    const usdToFrom = this.cache.get(INTERMEDIATE_CURRENCY, from);
    // Get rate from USD to target currency (to calculate USD -> TO)
    const usdToTo = this.cache.get(INTERMEDIATE_CURRENCY, to);

    if (usdToFrom && usdToTo) {
      // FROM -> USD -> TO
      // Rate = (1 / USD->FROM) * (USD->TO)
      const fromToUsd = 1 / usdToFrom.rate;
      const usdToToRate = usdToTo.rate;
      return fromToUsd * usdToToRate;
    }

    return null;
  }
}
