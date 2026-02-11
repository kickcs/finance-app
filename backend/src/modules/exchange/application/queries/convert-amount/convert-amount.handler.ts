import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { ConvertAmountQuery } from './convert-amount.query';
import {
  IExchangeRateRepository,
  EXCHANGE_RATE_REPOSITORY,
} from '../../../domain/repositories';
import { CurrencyConverterService } from '../../../domain/services';

const INTERMEDIATE_CURRENCY = 'USD';

@QueryHandler(ConvertAmountQuery)
export class ConvertAmountHandler implements IQueryHandler<ConvertAmountQuery> {
  constructor(
    @Inject(EXCHANGE_RATE_REPOSITORY)
    private readonly exchangeRateRepository: IExchangeRateRepository,
  ) {}

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
    const exchangeRate = await this.exchangeRateRepository.findByPair(from, to);

    if (exchangeRate) {
      return CurrencyConverterService.convert(amount, exchangeRate);
    }

    // Try inverse rate
    const inverseExchangeRate = await this.exchangeRateRepository.findByPair(
      to,
      from,
    );

    if (inverseExchangeRate) {
      return CurrencyConverterService.convertInverse(
        amount,
        inverseExchangeRate,
      );
    }

    // Try cross-rate through USD (e.g., EUR -> UZS = EUR -> USD -> UZS)
    if (from !== INTERMEDIATE_CURRENCY && to !== INTERMEDIATE_CURRENCY) {
      const crossRate = await this.calculateCrossRate(from, to);
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
  private async calculateCrossRate(
    from: string,
    to: string,
  ): Promise<number | null> {
    // Get rate from USD to source currency (to calculate FROM -> USD)
    const usdToFrom = await this.exchangeRateRepository.findByPair(
      INTERMEDIATE_CURRENCY,
      from,
    );
    // Get rate from USD to target currency (to calculate USD -> TO)
    const usdToTo = await this.exchangeRateRepository.findByPair(
      INTERMEDIATE_CURRENCY,
      to,
    );

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
