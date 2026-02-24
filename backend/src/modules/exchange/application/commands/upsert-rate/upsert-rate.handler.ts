import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpsertRateCommand } from './upsert-rate.command';
import { ExchangeRate } from '../../../domain/aggregates';
import { IExchangeRateRepository, EXCHANGE_RATE_REPOSITORY } from '../../../domain/repositories';
import {
  IExchangeRateCache,
  EXCHANGE_RATE_CACHE,
} from '../../services/exchange-rate-cache.service';

@CommandHandler(UpsertRateCommand)
export class UpsertRateHandler implements ICommandHandler<UpsertRateCommand> {
  constructor(
    @Inject(EXCHANGE_RATE_REPOSITORY)
    private readonly exchangeRateRepository: IExchangeRateRepository,
    @Inject(EXCHANGE_RATE_CACHE)
    private readonly exchangeRateCache: IExchangeRateCache,
  ) {}

  async execute(command: UpsertRateCommand) {
    const { baseCurrency, targetCurrency, rate } = command;

    // Check if rate already exists
    const existingRate = await this.exchangeRateRepository.findByPair(baseCurrency, targetCurrency);

    let exchangeRate: ExchangeRate;

    if (existingRate) {
      // Update existing rate
      existingRate.updateRate(rate);
      exchangeRate = existingRate;
    } else {
      // Create new rate
      exchangeRate = ExchangeRate.create(baseCurrency, targetCurrency, rate);
    }

    const savedRate = await this.exchangeRateRepository.save(exchangeRate);
    await this.exchangeRateCache.reload();

    return this.toResponse(savedRate);
  }

  private toResponse(exchangeRate: ExchangeRate) {
    return {
      baseCurrency: exchangeRate.baseCurrency,
      targetCurrency: exchangeRate.targetCurrency,
      rate: exchangeRate.rate,
      updatedAt: exchangeRate.updatedAt,
    };
  }
}
