import * as crypto from 'crypto';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';

import {
  USER_SUBSCRIPTION_REPOSITORY,
  type IUserSubscriptionRepository,
} from '../../../domain/repositories';
import { UserSubscription } from '../../../domain/aggregates/user-subscription/user-subscription.aggregate';
import { IapService } from '../../../infrastructure/iap';
import { VerifyIapReceiptCommand } from './verify-iap-receipt.command';

@CommandHandler(VerifyIapReceiptCommand)
export class VerifyIapReceiptHandler implements ICommandHandler<VerifyIapReceiptCommand, void> {
  private readonly logger = new Logger(VerifyIapReceiptHandler.name);

  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly repo: IUserSubscriptionRepository,
    private readonly iap: IapService,
  ) {}

  async execute(command: VerifyIapReceiptCommand): Promise<void> {
    const result = await this.iap.verifyReceipt({
      platform: command.platform,
      productId: command.productId,
      transactionId: command.transactionId,
      receipt: command.receipt,
    });

    // Trust the productId from the store, NEVER from the client — otherwise a
    // user can purchase a $0.99 SKU and ask us to activate the $99 yearly.
    const plan = this.iap.productIdToPlan(result.trustedProductId);

    const subscription =
      (await this.repo.findByUserId(command.userId)) ??
      UserSubscription.createFree(crypto.randomUUID(), command.userId);

    // Idempotency: if we've already activated this exact original_transaction_id
    // (e.g. user reopens the app, restorePurchases replays it), skip the write.
    if (
      subscription.originalTransactionId === result.originalTransactionId &&
      subscription.source === result.source &&
      subscription.isPremium()
    ) {
      this.logger.log(
        `Skipping duplicate IAP activation for user ${command.userId} (txn ${result.originalTransactionId})`,
      );
      return;
    }

    subscription.activateFromIap({
      plan,
      source: result.source,
      originalTransactionId: result.originalTransactionId,
      currentPeriodStart: result.currentPeriodStart,
      currentPeriodEnd: result.currentPeriodEnd,
    });

    await this.repo.save(subscription);
    this.logger.log(
      `Activated ${plan} via ${result.source} for user ${command.userId} (txn ${result.originalTransactionId})`,
    );
  }
}
