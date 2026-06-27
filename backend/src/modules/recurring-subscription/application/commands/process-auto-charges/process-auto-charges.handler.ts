import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
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
import { formatDateUTC, todayInTz } from '../../../../../shared/utils/date';
import { RecurringSubscriptionOrmEntity } from '../../../infrastructure/persistence/typeorm/recurring-subscription.orm-entity';
import { RecurringSubscriptionMapper } from '../../../infrastructure/persistence/mappers/recurring-subscription.mapper';

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

interface FailedCharge {
  subscriptionId: string;
  userId: string;
  name: string;
  amount: number;
  currency: string;
  reason: string;
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
    private readonly i18n: I18nService,
  ) {}

  async execute(_command: ProcessAutoChargesCommand): Promise<void> {
    const users = await this.timezoneUserResolver.getUsersDueForNotification();
    if (users.length === 0) return;

    for (const { userId, timezone, language } of users) {
      try {
        await this.processUserAutoCharges(userId, timezone, language);
      } catch (error) {
        this.logger.error(
          `Failed to process auto-charges for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async processUserAutoCharges(
    userId: string,
    timezone: string,
    language: string,
  ): Promise<void> {
    const subscriptions = await this.subscriptionRepository.findActiveByUserId(userId);
    if (subscriptions.length === 0) return;

    const today = todayInTz(timezone);

    for (const subscription of subscriptions) {
      if (!subscription.autoCharge) continue;
      if (formatDateUTC(subscription.billingDate) !== today) continue;

      let succeeded: SuccessfulCharge | null = null;
      let failed: FailedCharge | null = null;

      // Pre-check: auto-charge requires a linked account.
      if (!subscription.accountId) {
        failed = {
          subscriptionId: subscription.id,
          userId,
          name: subscription.name,
          amount: subscription.amount,
          currency: subscription.currency,
          reason: this.i18n.translate('notifications.failReason.noAccount', {
            lang: language,
          }),
          dedupKey: buildDedupKey('subscription_failed', subscription.id, today),
        };
        await this.notifyFailure(failed, language);
        continue;
      }

      try {
        succeeded = await this.dataSource.transaction(async (manager) => {
          // BUG-12: lock the row AND re-read status, so a pause that happened
          // between findActiveByUserId and lock acquisition is honored.
          const lockedRow = await manager.query<Array<{ id: string; status: string }>>(
            `SELECT id, status FROM recurring_subscriptions WHERE id = $1 FOR UPDATE`,
            [subscription.id],
          );
          if (lockedRow.length === 0) return null;
          if (lockedRow[0].status !== 'active') {
            this.logger.log(
              `Subscription ${subscription.id} no longer active, skipping auto-charge`,
            );
            return null;
          }

          const chargedDedupKey = buildDedupKey('auto_charge', subscription.id, today);
          const recorded = await this.tryRecordChargeLog(
            manager,
            userId,
            chargedDedupKey,
            subscription,
          );
          if (!recorded) {
            this.logger.debug(
              `Auto-charge already recorded for subscription ${subscription.id} on ${today}`,
            );
            return null;
          }

          const accountName = await this.fetchAccountName(manager, subscription.accountId, userId);

          // BUG-5: pass the outer manager so CreateTransactionHandler joins this
          // transaction instead of opening its own. Rollback now covers both.
          await this.commandBus.execute(
            new CreateTransactionCommand(
              userId,
              subscription.accountId as string,
              subscription.categoryId,
              subscription.amount,
              subscription.currency,
              'expense',
              new Date(),
              subscription.name,
              false,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              manager,
            ),
          );

          subscription.advanceBillingDate();
          // BUG-6: save through the locked manager so the write participates
          // in the same transaction as the FOR UPDATE lock.
          await manager
            .getRepository(RecurringSubscriptionOrmEntity)
            .save(RecurringSubscriptionMapper.toOrm(subscription));

          return {
            subscriptionId: subscription.id,
            userId,
            name: subscription.name,
            amount: subscription.amount,
            currency: subscription.currency,
            accountName,
            dedupKey: buildDedupKey('subscription_charged', subscription.id, today),
          } satisfies SuccessfulCharge;
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to auto-charge subscription "${subscription.name}" (user ${userId}): ${errMsg}`,
        );
        const isCurrencyMismatch = errMsg.toLowerCase().includes('currency mismatch');
        failed = {
          subscriptionId: subscription.id,
          userId,
          name: subscription.name,
          amount: subscription.amount,
          currency: subscription.currency,
          reason: isCurrencyMismatch
            ? this.i18n.translate('notifications.failReason.currencyMismatch', {
                lang: language,
              })
            : this.i18n.translate('notifications.failReason.checkAccount', {
                lang: language,
              }),
          dedupKey: buildDedupKey('subscription_failed', subscription.id, today),
        };
      }

      if (succeeded) {
        const body = succeeded.accountName
          ? this.i18n.translate('notifications.subscriptionCharged.bodyWithAccount', {
              lang: language,
              args: {
                amount: succeeded.amount,
                currency: succeeded.currency,
                accountName: succeeded.accountName,
              },
            })
          : this.i18n.translate('notifications.subscriptionCharged.body', {
              lang: language,
              args: { amount: succeeded.amount, currency: succeeded.currency },
            });
        await this.pushNotificationService.sendToUser(
          succeeded.userId,
          {
            title: succeeded.name,
            body,
            url: `/subscriptions/${succeeded.subscriptionId}`,
          },
          { type: 'subscription_charged', dedupKey: succeeded.dedupKey },
        );
        this.logger.log(
          `Auto-charged subscription "${succeeded.name}" for user ${succeeded.userId}, amount: ${succeeded.amount} ${succeeded.currency}`,
        );
      }

      if (failed) {
        await this.notifyFailure(failed, language);
      }
    }
  }

  private async notifyFailure(failed: FailedCharge, language: string): Promise<void> {
    await this.pushNotificationService.sendToUser(
      failed.userId,
      {
        title: failed.name,
        body: this.i18n.translate('notifications.subscriptionFailed.body', {
          lang: language,
          args: {
            amount: failed.amount,
            currency: failed.currency,
            reason: capitalize(failed.reason),
          },
        }),
        url: `/subscriptions/${failed.subscriptionId}`,
      },
      { type: 'subscription_failed', dedupKey: failed.dedupKey },
    );
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
    userId: string,
  ): Promise<string> {
    if (!accountId) return '';
    // BUG-20: defense-in-depth — restrict by user_id so we never leak a name
    // from a cross-tenant account, even though CreateTransactionHandler would
    // also reject the charge.
    const rows = await manager.query<{ name: string }[]>(
      `SELECT name FROM accounts WHERE id = $1 AND user_id = $2`,
      [accountId, userId],
    );
    return rows.length > 0 ? rows[0].name : '';
  }
}
