import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { ConvertAmountQuery } from './convert-amount.query';
import {
  IExchangeRateCache,
  EXCHANGE_RATE_CACHE,
} from '../../services/exchange-rate-cache.service';

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

    const result = this.cache.resolve(from, to);

    if (!result) {
      throw new NotFoundException(`Exchange rate not found for ${from}/${to}`);
    }

    const convertedAmount = Math.round(amount * result.rate * 100) / 100;

    return {
      amount,
      fromCurrency: from,
      toCurrency: to,
      convertedAmount,
      rate: result.rate,
      inverseRate: 1 / result.rate,
    };
  }
}
