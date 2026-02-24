import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetRateQuery } from './get-rate.query';
import {
  IExchangeRateCache,
  EXCHANGE_RATE_CACHE,
} from '../../services/exchange-rate-cache.service';

@QueryHandler(GetRateQuery)
export class GetRateHandler implements IQueryHandler<GetRateQuery> {
  constructor(
    @Inject(EXCHANGE_RATE_CACHE)
    private readonly cache: IExchangeRateCache,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(query: GetRateQuery) {
    const { baseCurrency, targetCurrency } = query;
    const result = this.cache.resolve(baseCurrency, targetCurrency);

    if (!result) {
      throw new NotFoundException(`Exchange rate not found for ${baseCurrency}/${targetCurrency}`);
    }

    return {
      baseCurrency: baseCurrency.toUpperCase(),
      targetCurrency: targetCurrency.toUpperCase(),
      ...result,
    };
  }
}
