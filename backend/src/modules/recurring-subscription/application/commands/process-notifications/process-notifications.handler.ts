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
import { buildDedupKey } from '../../../../notification/domain/types';
import { TimezoneUserResolverService } from '../../services/timezone-user-resolver.service';
import { formatDateUTC, subtractDaysISO, todayInTz } from '../../../../../shared/utils/date';

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

  async execute(_command: ProcessNotificationsCommand): Promise<void> {
    const users = await this.timezoneUserResolver.getUsersDueForNotification();
    if (users.length === 0) return;

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

    const today = todayInTz(timezone);

    for (const subscription of subscriptions) {
      if (!subscription.notifyDaysBefore.length) continue;

      const billingDateStr = formatDateUTC(subscription.billingDate);

      for (const daysBefore of subscription.notifyDaysBefore) {
        if (subtractDaysISO(billingDateStr, daysBefore) !== today) continue;

        const dedupKey = buildDedupKey('subscription_upcoming', subscription.id, today, daysBefore);
        const sent = await this.pushNotificationService.sendToUser(
          userId,
          {
            title: subscription.name,
            body: `Списание ${subscription.amount} ${subscription.currency} ${formatDaysBefore(daysBefore)}`,
            url: `/subscriptions/${subscription.id}`,
          },
          { type: 'subscription_upcoming', dedupKey },
        );

        if (sent) {
          this.logger.log(
            `Sent notification reminder to user ${userId} for subscription "${subscription.name}" (${daysBefore} days before)`,
          );
        }
      }
    }
  }
}

function formatDaysBefore(daysBefore: number): string {
  if (daysBefore === 0) return 'сегодня';
  if (daysBefore === 1) return 'завтра';
  return `через ${daysBefore} дн.`;
}
