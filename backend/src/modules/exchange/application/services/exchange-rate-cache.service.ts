import { Inject, Injectable, Logger } from '@nestjs/common';
import { ExchangeRate } from '../../domain/aggregates';
import { IExchangeRateRepository, EXCHANGE_RATE_REPOSITORY } from '../../domain/repositories';

export const EXCHANGE_RATE_CACHE = Symbol('EXCHANGE_RATE_CACHE');

const INTERMEDIATE_CURRENCY = 'USD';

export interface RateResult {
  rate: number;
  updatedAt: Date;
  isInverse: boolean;
  isCrossRate: boolean;
}

export interface IExchangeRateCache {
  get(baseCurrency: string, targetCurrency: string): ExchangeRate | null;
  resolve(baseCurrency: string, targetCurrency: string): RateResult | null;
  getAll(): ExchangeRate[];
  set(rate: ExchangeRate): void;
  reload(): Promise<void>;
}

@Injectable()
export class ExchangeRateCacheService implements IExchangeRateCache {
  private readonly logger = new Logger(ExchangeRateCacheService.name);
  private cache = new Map<string, ExchangeRate>();

  constructor(
    @Inject(EXCHANGE_RATE_REPOSITORY)
    private readonly exchangeRateRepository: IExchangeRateRepository,
  ) {}

  private toKey(base: string, target: string): string {
    return `${base.toUpperCase()}:${target.toUpperCase()}`;
  }

  get(baseCurrency: string, targetCurrency: string): ExchangeRate | null {
    return this.cache.get(this.toKey(baseCurrency, targetCurrency)) ?? null;
  }

  resolve(baseCurrency: string, targetCurrency: string): RateResult | null {
    const base = baseCurrency.toUpperCase();
    const target = targetCurrency.toUpperCase();

    if (base === target) {
      return { rate: 1, updatedAt: new Date(), isInverse: false, isCrossRate: false };
    }

    // Direct rate
    const direct = this.cache.get(this.toKey(base, target));
    if (direct) {
      return {
        rate: direct.rate,
        updatedAt: direct.updatedAt,
        isInverse: false,
        isCrossRate: false,
      };
    }

    // Inverse rate
    const inverse = this.cache.get(this.toKey(target, base));
    if (inverse) {
      return {
        rate: inverse.getInverseRate(),
        updatedAt: inverse.updatedAt,
        isInverse: true,
        isCrossRate: false,
      };
    }

    // Cross-rate through USD
    if (base !== INTERMEDIATE_CURRENCY && target !== INTERMEDIATE_CURRENCY) {
      const usdToFrom = this.cache.get(this.toKey(INTERMEDIATE_CURRENCY, base));
      const usdToTo = this.cache.get(this.toKey(INTERMEDIATE_CURRENCY, target));

      if (usdToFrom && usdToTo) {
        const rate = (1 / usdToFrom.rate) * usdToTo.rate;
        const updatedAt =
          usdToFrom.updatedAt > usdToTo.updatedAt ? usdToTo.updatedAt : usdToFrom.updatedAt;
        return { rate, updatedAt, isInverse: false, isCrossRate: true };
      }
    }

    return null;
  }

  getAll(): ExchangeRate[] {
    return Array.from(this.cache.values());
  }

  set(rate: ExchangeRate): void {
    this.cache.set(this.toKey(rate.baseCurrency, rate.targetCurrency), rate);
  }

  async reload(): Promise<void> {
    try {
      const rates = await this.exchangeRateRepository.findAll();
      const newCache = new Map<string, ExchangeRate>();
      for (const rate of rates) {
        newCache.set(this.toKey(rate.baseCurrency, rate.targetCurrency), rate);
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
