import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetRateQuery } from './get-rate.query';
import {
  IExchangeRateCache,
  EXCHANGE_RATE_CACHE,
} from '../../services/exchange-rate-cache.service';

const INTERMEDIATE_CURRENCY = 'USD';

@QueryHandler(GetRateQuery)
export class GetRateHandler implements IQueryHandler<GetRateQuery> {
  constructor(
    @Inject(EXCHANGE_RATE_CACHE)
    private readonly cache: IExchangeRateCache,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(query: GetRateQuery) {
    const { baseCurrency, targetCurrency } = query;

    const base = baseCurrency.toUpperCase();
    const target = targetCurrency.toUpperCase();

    // Same currency
    if (base === target) {
      return {
        baseCurrency: base,
        targetCurrency: target,
        rate: 1,
        updatedAt: new Date(),
        isInverse: false,
        isCrossRate: false,
      };
    }

    // Try to find direct rate
    const exchangeRate = this.cache.get(base, target);

    if (exchangeRate) {
      return {
        baseCurrency: exchangeRate.baseCurrency,
        targetCurrency: exchangeRate.targetCurrency,
        rate: exchangeRate.rate,
        updatedAt: exchangeRate.updatedAt,
        isInverse: false,
        isCrossRate: false,
      };
    }

    // Try inverse rate
    const inverseRate = this.cache.get(target, base);

    if (inverseRate) {
      return {
        baseCurrency: base,
        targetCurrency: target,
        rate: inverseRate.getInverseRate(),
        updatedAt: inverseRate.updatedAt,
        isInverse: true,
        isCrossRate: false,
      };
    }

    // Try cross-rate through USD
    if (base !== INTERMEDIATE_CURRENCY && target !== INTERMEDIATE_CURRENCY) {
      const crossRateResult = this.calculateCrossRate(base, target);
      if (crossRateResult) {
        return {
          baseCurrency: base,
          targetCurrency: target,
          rate: crossRateResult.rate,
          updatedAt: crossRateResult.updatedAt,
          isInverse: false,
          isCrossRate: true,
        };
      }
    }

    throw new NotFoundException(`Exchange rate not found for ${baseCurrency}/${targetCurrency}`);
  }

  private calculateCrossRate(from: string, to: string): { rate: number; updatedAt: Date } | null {
    const usdToFrom = this.cache.get(INTERMEDIATE_CURRENCY, from);
    const usdToTo = this.cache.get(INTERMEDIATE_CURRENCY, to);

    if (usdToFrom && usdToTo) {
      const fromToUsd = 1 / usdToFrom.rate;
      const rate = fromToUsd * usdToTo.rate;
      const updatedAt =
        usdToFrom.updatedAt > usdToTo.updatedAt ? usdToTo.updatedAt : usdToFrom.updatedAt;

      return { rate, updatedAt };
    }

    return null;
  }
}
