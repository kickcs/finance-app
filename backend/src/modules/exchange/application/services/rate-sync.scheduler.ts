import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CommandBus } from '@nestjs/cqrs';
import { SyncRatesCommand } from '../commands';
import { IExchangeRateCache, EXCHANGE_RATE_CACHE } from './exchange-rate-cache.service';

@Injectable()
export class RateSyncScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(RateSyncScheduler.name);
  private readonly baseCurrency = 'USD';

  constructor(
    private readonly commandBus: CommandBus,
    @Inject(EXCHANGE_RATE_CACHE)
    private readonly exchangeRateCache: IExchangeRateCache,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Initializing exchange rate sync on startup...');
    await this.syncRates();
  }

  @Cron('0 6 * * *') // Daily at 6:00 UTC
  async handleDailyCron(): Promise<void> {
    this.logger.log('Running scheduled daily exchange rate sync...');
    await this.syncRates();
  }

  private async syncRates(): Promise<void> {
    try {
      await this.commandBus.execute(new SyncRatesCommand(this.baseCurrency));
      await this.exchangeRateCache.reload();
      this.logger.log('Exchange rate sync completed successfully');
    } catch (error) {
      this.logger.error(
        `Exchange rate sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
