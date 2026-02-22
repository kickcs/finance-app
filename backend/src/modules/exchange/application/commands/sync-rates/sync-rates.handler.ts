import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { SyncRatesCommand } from './sync-rates.command';
import { UpsertRateCommand } from '../upsert-rate/upsert-rate.command';
import { IExchangeRateProvider, EXCHANGE_RATE_PROVIDER } from '../../../infrastructure/external';

const TARGET_CURRENCIES = ['USD', 'EUR', 'RUB', 'UZS', 'GBP', 'CNY', 'KZT'];

@CommandHandler(SyncRatesCommand)
export class SyncRatesHandler implements ICommandHandler<SyncRatesCommand> {
  private readonly logger = new Logger(SyncRatesHandler.name);

  constructor(
    @Inject(EXCHANGE_RATE_PROVIDER)
    private readonly exchangeRateProvider: IExchangeRateProvider,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: SyncRatesCommand): Promise<void> {
    const { baseCurrency } = command;

    this.logger.log(`Starting exchange rate sync for base currency: ${baseCurrency}`);

    try {
      const rates = await this.exchangeRateProvider.fetchRates(baseCurrency, TARGET_CURRENCIES);

      this.logger.log(`Fetched ${rates.length} rates, saving to database...`);

      for (const rateData of rates) {
        await this.commandBus.execute(
          new UpsertRateCommand(rateData.baseCurrency, rateData.targetCurrency, rateData.rate),
        );
      }

      this.logger.log(
        `Exchange rate sync completed for ${baseCurrency}. Updated ${rates.length} rates.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync exchange rates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
