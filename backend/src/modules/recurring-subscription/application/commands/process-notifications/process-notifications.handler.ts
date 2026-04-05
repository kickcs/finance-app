import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { ProcessNotificationsCommand } from './process-notifications.command';
import {
  IPushNotificationService,
  PUSH_NOTIFICATION_SERVICE,
} from '../../../../notification/application/services/push-notification.service';
import {
  IRecurringSubscriptionRepository,
  RECURRING_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';
import { TimezoneUserResolverService } from '../../services/timezone-user-resolver.service';

@CommandHandler(ProcessNotificationsCommand)
export class ProcessNotificationsHandler implements ICommandHandler<ProcessNotificationsCommand> {
  private readonly logger = new Logger(ProcessNotificationsHandler.name);

  constructor(
    private readonly timezoneUserResolver: TimezoneUserResolverService,
    @Inject(RECURRING_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IRecurringSubscriptionRepository,
    @Inject(PUSH_NOTIFICATION_SERVICE)
    private readonly pushNotificationService: IPushNotificationService,
  ) {}

  async execute(command: ProcessNotificationsCommand): Promise<void> {
    const { targetHour } = command;

    const users = await this.timezoneUserResolver.getUsersAtLocalHour(targetHour);
    if (users.length === 0) {
      return;
    }

    for (const { userId, timezone } of users) {
      try {
        await this.processUserNotifications(userId, timezone);
      } catch (error) {
        this.logger.error(
          `Failed to process notifications for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async processUserNotifications(userId: string, timezone: string): Promise<void> {
    const subscriptions = await this.subscriptionRepository.findActiveByUserId(userId);
    if (subscriptions.length === 0) return;

    const now = new Date();
    const todayInTz = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);

    for (const subscription of subscriptions) {
      if (subscription.notifyDaysBefore <= 0) continue;

      const billingDateStr = subscription.billingDate.toISOString().split('T')[0];
      const notifyDate = new Date(billingDateStr);
      notifyDate.setDate(notifyDate.getDate() - subscription.notifyDaysBefore);
      const notifyDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(
        notifyDate,
      );

      if (notifyDateStr === todayInTz) {
        await this.pushNotificationService.sendToUser(userId, {
          title: subscription.name,
          body: `Списание ${subscription.amount} ${subscription.currency} через ${subscription.notifyDaysBefore} дн.`,
          url: `/subscriptions/${subscription.id}`,
        });

        this.logger.log(
          `Sent notification reminder to user ${userId} for subscription "${subscription.name}"`,
        );
      }
    }
  }
}
