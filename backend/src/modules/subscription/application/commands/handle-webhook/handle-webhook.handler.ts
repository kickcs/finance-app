import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HandleWebhookCommand } from './handle-webhook.command';
import {
  IUserSubscriptionRepository,
  USER_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';
import { UserSubscription } from '../../../domain/aggregates/user-subscription/user-subscription.aggregate';
import {
  LemonSqueezyWebhookService,
  LemonSqueezyWebhookEvent,
} from '../../../infrastructure/lemonsqueezy';

@CommandHandler(HandleWebhookCommand)
export class HandleWebhookHandler implements ICommandHandler<HandleWebhookCommand> {
  private readonly logger = new Logger(HandleWebhookHandler.name);
  private readonly monthlyVariantId: string;
  private readonly yearlyVariantId: string;

  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IUserSubscriptionRepository,
    private readonly webhookService: LemonSqueezyWebhookService,
    private readonly configService: ConfigService,
  ) {
    this.monthlyVariantId = this.configService.getOrThrow<string>(
      'LEMONSQUEEZY_PREMIUM_MONTHLY_VARIANT_ID',
    );
    this.yearlyVariantId = this.configService.getOrThrow<string>(
      'LEMONSQUEEZY_PREMIUM_YEARLY_VARIANT_ID',
    );
  }

  async execute(command: HandleWebhookCommand): Promise<void> {
    const isValid = this.webhookService.verifySignature(command.rawBody, command.signature);

    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = this.webhookService.parseEvent(command.rawBody);
    const eventName = event.meta.event_name;

    this.logger.log(`Processing webhook event: ${eventName}`);

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
        await this.handleSubscriptionCreatedOrUpdated(event);
        break;
      case 'subscription_cancelled':
        await this.handleSubscriptionCancelled(event);
        break;
      case 'subscription_expired':
        await this.handleSubscriptionExpired(event);
        break;
      case 'subscription_payment_failed':
        await this.handlePaymentFailed(event);
        break;
      default:
        this.logger.warn(`Unhandled webhook event: ${eventName}`);
    }
  }

  private async handleSubscriptionCreatedOrUpdated(event: LemonSqueezyWebhookEvent): Promise<void> {
    const userId = event.meta.custom_data?.user_id;
    if (!userId) {
      this.logger.warn('Webhook event missing user_id in custom_data');
      return;
    }

    const attrs = event.data.attributes;
    let subscription = await this.subscriptionRepository.findByUserId(userId);

    if (!subscription) {
      subscription = UserSubscription.createFree(crypto.randomUUID(), userId);
    }

    const plan = this.variantToPlan(String(attrs.variant_id));
    const status = this.mapLemonStatus(attrs.status);

    const periodEnd = new Date(attrs.renews_at || attrs.ends_at || attrs.created_at);
    const periodStart = new Date(attrs.updated_at);

    subscription.activate({
      plan,
      lemonCustomerId: String(attrs.customer_id),
      lemonSubscriptionId: event.data.id,
      variantId: String(attrs.variant_id),
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      trialStart: attrs.trial_ends_at ? new Date(attrs.created_at) : undefined,
      trialEnd: attrs.trial_ends_at ? new Date(attrs.trial_ends_at) : undefined,
      status,
    });

    await this.subscriptionRepository.save(subscription);
  }

  private async handleSubscriptionCancelled(event: LemonSqueezyWebhookEvent): Promise<void> {
    const subscription = await this.findSubscriptionByEvent(event);
    if (!subscription) return;

    subscription.markCancelAtPeriodEnd();
    await this.subscriptionRepository.save(subscription);
  }

  private async handleSubscriptionExpired(event: LemonSqueezyWebhookEvent): Promise<void> {
    const subscription = await this.findSubscriptionByEvent(event);
    if (!subscription) return;

    subscription.deactivate();
    await this.subscriptionRepository.save(subscription);
  }

  private async handlePaymentFailed(event: LemonSqueezyWebhookEvent): Promise<void> {
    const subscription = await this.findSubscriptionByEvent(event);
    if (!subscription) return;

    subscription.updateStatus('past_due');
    await this.subscriptionRepository.save(subscription);
  }

  private async findSubscriptionByEvent(
    event: LemonSqueezyWebhookEvent,
  ): Promise<UserSubscription | null> {
    const userId = event.meta.custom_data?.user_id;

    if (userId) {
      const sub = await this.subscriptionRepository.findByUserId(userId);
      if (sub) return sub;
    }

    const sub = await this.subscriptionRepository.findByLemonSubscriptionId(event.data.id);

    if (!sub) {
      this.logger.warn(
        `Subscription not found for event ${event.meta.event_name}, lemonSubscriptionId=${event.data.id}`,
      );
    }

    return sub;
  }

  private variantToPlan(variantId: string): string {
    if (variantId === this.monthlyVariantId) return 'premium_monthly';
    if (variantId === this.yearlyVariantId) return 'premium_yearly';
    this.logger.warn(`Unknown variant ID: ${variantId}, defaulting to premium_monthly`);
    return 'premium_monthly';
  }

  private mapLemonStatus(status: string): string {
    const statusMap: Record<string, string> = {
      active: 'active',
      on_trial: 'trialing',
      cancelled: 'canceled',
      past_due: 'past_due',
      expired: 'expired',
      paused: 'canceled',
      unpaid: 'past_due',
    };

    return statusMap[status] || 'active';
  }
}
