import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
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
    private readonly i18n: I18nService,
  ) {}

  async execute(_command: ProcessNotificationsCommand): Promise<void> {
    const users = await this.timezoneUserResolver.getUsersDueForNotification();
    if (users.length === 0) return;

    for (const { userId, timezone, language } of users) {
      try {
        await this.processUserNotifications(userId, timezone, language);
      } catch (error) {
        this.logger.error(
          `Failed to process notifications for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async processUserNotifications(
    userId: string,
    timezone: string,
    language: string,
  ): Promise<void> {
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
            body: this.i18n.translate('notifications.subscriptionUpcoming.body', {
              lang: language,
              args: {
                amount: subscription.amount,
                currency: subscription.currency,
                when: this.formatDaysBefore(daysBefore, language),
              },
            }),
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

  private formatDaysBefore(daysBefore: number, lang: string): string {
    if (daysBefore === 0) return this.i18n.translate('notifications.when.today', { lang });
    if (daysBefore === 1) return this.i18n.translate('notifications.when.tomorrow', { lang });
    // TODO(i18n): plural
    return this.i18n.translate('notifications.when.inDays', {
      lang,
      args: { count: daysBefore },
    });
  }
}
