import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CommandBus } from '@nestjs/cqrs';
import { ProcessNotificationsCommand } from '../commands/process-notifications/process-notifications.command';
import { ProcessAutoChargesCommand } from '../commands/process-auto-charges/process-auto-charges.command';

@Injectable()
export class SubscriptionCronService {
  private readonly logger = new Logger(SubscriptionCronService.name);

  constructor(private readonly commandBus: CommandBus) {}

  @Cron('0 * * * *')
  async handleHourlyCron(): Promise<void> {
    this.logger.log('Running hourly subscription processing...');
    try {
      await this.commandBus.execute(new ProcessNotificationsCommand());
      await this.commandBus.execute(new ProcessAutoChargesCommand());
      this.logger.log('Hourly subscription processing completed');
    } catch (error) {
      this.logger.error(
        `Subscription cron failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
