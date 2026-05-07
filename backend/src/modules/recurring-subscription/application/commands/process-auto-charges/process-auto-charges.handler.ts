import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
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
import { RecurringSubscription } from '../../../domain/aggregates/recurring-subscription';
import { buildDedupKey, NotificationType } from '../../../../notification/domain/types';
import { formatDateUTC } from '../../../../../shared/utils/date';

interface FailedCharge {
  subscriptionId: string;
  userId: string;
  name: string;
  amount: number;
  currency: string;
  dedupKey: string;
}

interface SuccessfulCharge {
  subscriptionId: string;
  userId: string;
  name: string;
  amount: number;
  currency: string;
  accountName: string;
  dedupKey: string;
}

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
    void command;
    const users = await this.timezoneUserResolver.getUsersDueForNotification();
    if (users.length === 0) return;

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

      const billingDateStr = formatDateUTC(subscription.billingDate);
      if (billingDateStr !== todayInTz) continue;

      let succeeded: SuccessfulCharge | null = null;
      let failed: FailedCharge | null = null;

      try {
        succeeded = await this.dataSource.transaction(async (manager) => {
          const lockedRow = await manager.query<Array<{ id: string }>>(
            `SELECT id FROM recurring_subscriptions WHERE id = $1 FOR UPDATE`,
            [subscription.id],
          );
          if (lockedRow.length === 0) return null;

          const chargedDedupKey = buildDedupKey('auto_charge', subscription.id, todayInTz);
          const recorded = await this.tryRecordChargeLog(
            manager,
            userId,
            chargedDedupKey,
            subscription,
          );
          if (!recorded) {
            this.logger.debug(
              `Auto-charge already recorded for subscription ${subscription.id} on ${todayInTz}`,
            );
            return null;
          }

          const accountName = await this.fetchAccountName(manager, subscription.accountId);

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

          subscription.advanceBillingDate();
          await this.subscriptionRepository.save(subscription);

          return {
            subscriptionId: subscription.id,
            userId,
            name: subscription.name,
            amount: subscription.amount,
            currency: subscription.currency,
            accountName,
            dedupKey: buildDedupKey('subscription_charged', subscription.id, todayInTz),
          } satisfies SuccessfulCharge;
        });
      } catch (error) {
        this.logger.error(
          `Failed to auto-charge subscription "${subscription.name}" (user ${userId}): ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        failed = {
          subscriptionId: subscription.id,
          userId,
          name: subscription.name,
          amount: subscription.amount,
          currency: subscription.currency,
          dedupKey: buildDedupKey('subscription_failed', subscription.id, todayInTz),
        };
      }

      if (succeeded) {
        const bodyParts = [`Списано ${succeeded.amount} ${succeeded.currency}`];
        if (succeeded.accountName) bodyParts.push(`· ${succeeded.accountName}`);
        await this.pushNotificationService.sendToUser(
          succeeded.userId,
          {
            title: succeeded.name,
            body: bodyParts.join(' '),
            url: `/subscriptions/${succeeded.subscriptionId}`,
          },
          { type: 'subscription_charged', dedupKey: succeeded.dedupKey },
        );
        this.logger.log(
          `Auto-charged subscription "${succeeded.name}" for user ${succeeded.userId}, amount: ${succeeded.amount} ${succeeded.currency}`,
        );
      }

      if (failed) {
        await this.pushNotificationService.sendToUser(
          failed.userId,
          {
            title: failed.name,
            body: `Не удалось списать ${failed.amount} ${failed.currency}. Проверьте счёт.`,
            url: `/subscriptions/${failed.subscriptionId}`,
          },
          { type: 'subscription_failed', dedupKey: failed.dedupKey },
        );
      }
    }
  }

  private async tryRecordChargeLog(
    manager: EntityManager,
    userId: string,
    dedupKey: string,
    subscription: RecurringSubscription,
  ): Promise<boolean> {
    const result: Array<{ id: string }> = await manager.query(
      `
        INSERT INTO "notification_log" ("id", "user_id", "type", "dedup_key", "payload", "sent_at")
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT ("user_id", "dedup_key") DO NOTHING
        RETURNING "id"
      `,
      [
        crypto.randomUUID(),
        userId,
        'auto_charge' satisfies NotificationType,
        dedupKey,
        JSON.stringify({
          subscriptionId: subscription.id,
          amount: subscription.amount,
          currency: subscription.currency,
        }),
        new Date(),
      ],
    );
    return result.length > 0;
  }

  private async fetchAccountName(
    manager: EntityManager,
    accountId: string | null,
  ): Promise<string> {
    if (!accountId) return '';
    const rows = await manager.query<{ name: string }[]>(
      `SELECT name FROM accounts WHERE id = $1`,
      [accountId],
    );
    return rows.length > 0 ? rows[0].name : '';
  }
}
