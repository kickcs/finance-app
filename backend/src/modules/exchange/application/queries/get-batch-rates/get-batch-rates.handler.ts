import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetBatchRatesQuery } from './get-batch-rates.query';
import {
  IExchangeRateCache,
  EXCHANGE_RATE_CACHE,
} from '../../services/exchange-rate-cache.service';

@QueryHandler(GetBatchRatesQuery)
export class GetBatchRatesHandler implements IQueryHandler<GetBatchRatesQuery> {
  constructor(
    @Inject(EXCHANGE_RATE_CACHE)
    private readonly cache: IExchangeRateCache,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(query: GetBatchRatesQuery) {
    const base = query.baseCurrency.toUpperCase();
    const rates: Record<string, { rate: number; updatedAt: Date }> = {};

    // Collect all unique target currencies from the cache
    const allRates = this.cache.getAll();
    const targets = new Set<string>();
    for (const rate of allRates) {
      targets.add(rate.baseCurrency);
      targets.add(rate.targetCurrency);
    }
    targets.delete(base);

    for (const target of targets) {
      const result = this.cache.resolve(base, target);
      if (result) {
        rates[target] = { rate: result.rate, updatedAt: result.updatedAt };
      }
    }

    return { baseCurrency: base, rates };
  }
}
