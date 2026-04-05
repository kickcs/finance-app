import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProcessAutoChargesCommand } from './process-auto-charges.command';
import {
  IPushNotificationService,
  PUSH_NOTIFICATION_SERVICE,
} from '../../../../notification/application/services/push-notification.service';
import {
  IRecurringSubscriptionRepository,
  RECURRING_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';
import { CreateTransactionCommand } from '../../../../accounting/application/commands/create-transaction/create-transaction.command';
import { TimezoneUserResolverService } from '../../services/timezone-user-resolver.service';

@CommandHandler(ProcessAutoChargesCommand)
export class ProcessAutoChargesHandler implements ICommandHandler<ProcessAutoChargesCommand> {
  private readonly logger = new Logger(ProcessAutoChargesHandler.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly timezoneUserResolver: TimezoneUserResolverService,
    private readonly dataSource: DataSource,
    @Inject(RECURRING_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IRecurringSubscriptionRepository,
    @Inject(PUSH_NOTIFICATION_SERVICE)
    private readonly pushNotificationService: IPushNotificationService,
  ) {}

  async execute(command: ProcessAutoChargesCommand): Promise<void> {
    const { targetHour } = command;

    const users = await this.timezoneUserResolver.getUsersAtLocalHour(targetHour);
    if (users.length === 0) {
      return;
    }

    for (const { userId, timezone } of users) {
      try {
        await this.processUserAutoCharges(userId, timezone);
      } catch (error) {
        this.logger.error(
          `Failed to process auto-charges for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async processUserAutoCharges(userId: string, timezone: string): Promise<void> {
    const subscriptions = await this.subscriptionRepository.findActiveByUserId(userId);
    if (subscriptions.length === 0) return;

    const now = new Date();
    const todayInTz = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);

    for (const subscription of subscriptions) {
      if (!subscription.autoCharge) continue;

      const billingDateStr = subscription.billingDate.toISOString().split('T')[0];
      if (billingDateStr !== todayInTz) continue;

      let accountName = '';
      if (subscription.accountId) {
        const [account] = await this.dataSource.query<{ name: string }[]>(
          `SELECT name FROM accounts WHERE id = $1`,
          [subscription.accountId],
        );
        accountName = account?.name ?? '';
      }

      try {
        await this.commandBus.execute(
          new CreateTransactionCommand(
            userId,
            subscription.accountId ?? '',
            subscription.categoryId,
            subscription.amount,
            subscription.currency,
            'expense',
            new Date(),
            subscription.name,
          ),
        );
      } catch (error) {
        this.logger.error(
          `Failed to create transaction for subscription "${subscription.name}" (user ${userId}): ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        continue;
      }

      subscription.advanceBillingDate();
      await this.subscriptionRepository.save(subscription);

      const bodyParts = [`Списано ${subscription.amount} ${subscription.currency}`];
      if (accountName) {
        bodyParts.push(`· ${accountName}`);
      }

      await this.pushNotificationService.sendToUser(userId, {
        title: subscription.name,
        body: bodyParts.join(' '),
        url: `/subscriptions/${subscription.id}`,
      });

      this.logger.log(
        `Auto-charged subscription "${subscription.name}" for user ${userId}, amount: ${subscription.amount} ${subscription.currency}`,
      );
    }
  }
}
