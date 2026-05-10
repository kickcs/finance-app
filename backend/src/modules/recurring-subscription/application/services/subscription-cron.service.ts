import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CommandBus } from '@nestjs/cqrs';
import { ProcessNotificationsCommand } from '../commands/process-notifications/process-notifications.command';
import { ProcessAutoChargesCommand } from '../commands/process-auto-charges/process-auto-charges.command';

@Injectable()
export class SubscriptionCronService {
  private readonly logger = new Logger(SubscriptionCronService.name);

  constructor(private readonly commandBus: CommandBus) {}

  // Run every 30 minutes so users in half-hour timezones (IST, NPT) are
  // matched within their notification-hour window. The
  // TimezoneUserResolverService gates by `MINUTE < 30` so duplicate sends
  // are not a concern.
  @Cron('0,30 * * * *')
  async handleHourlyCron(): Promise<void> {
    this.logger.log('Running subscription processing...');
    try {
      // BUG-21: notifications and auto-charges operate on independent state
      // (notifications are read-only; auto-charges write subscriptions and
      // accounts). Running them concurrently keeps them in the same hour
      // bucket even if one is slow.
      await Promise.all([
        this.commandBus.execute(new ProcessNotificationsCommand()),
        this.commandBus.execute(new ProcessAutoChargesCommand()),
      ]);
      this.logger.log('Subscription processing completed');
    } catch (error) {
      this.logger.error(
        `Subscription cron failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
