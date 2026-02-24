import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ExchangeRate } from '../../domain/aggregates';
import {
  IExchangeRateRepository,
  EXCHANGE_RATE_REPOSITORY,
} from '../../domain/repositories';

export const EXCHANGE_RATE_CACHE = Symbol('EXCHANGE_RATE_CACHE');

export interface IExchangeRateCache {
  get(baseCurrency: string, targetCurrency: string): ExchangeRate | null;
  getAll(): ExchangeRate[];
  reload(): Promise<void>;
}

@Injectable()
export class ExchangeRateCacheService
  implements IExchangeRateCache, OnApplicationBootstrap
{
  private readonly logger = new Logger(ExchangeRateCacheService.name);
  private cache = new Map<string, ExchangeRate>();

  constructor(
    @Inject(EXCHANGE_RATE_REPOSITORY)
    private readonly exchangeRateRepository: IExchangeRateRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.reload();
  }

  private toKey(base: string, target: string): string {
    return `${base.toUpperCase()}:${target.toUpperCase()}`;
  }

  get(baseCurrency: string, targetCurrency: string): ExchangeRate | null {
    return this.cache.get(this.toKey(baseCurrency, targetCurrency)) ?? null;
  }

  getAll(): ExchangeRate[] {
    return Array.from(this.cache.values());
  }

  async reload(): Promise<void> {
    try {
      const rates = await this.exchangeRateRepository.findAll();
      const newCache = new Map<string, ExchangeRate>();
      for (const rate of rates) {
        newCache.set(
          this.toKey(rate.baseCurrency, rate.targetCurrency),
          rate,
        );
      }
      this.cache = newCache;
      this.logger.log(`Exchange rate cache loaded: ${newCache.size} rates`);
    } catch (error) {
      this.logger.error(
        `Failed to load exchange rate cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
