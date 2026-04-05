import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RegisterPushSubscriptionCommand } from './register-push-subscription.command';
import { PushSubscription } from '../../../domain/aggregates/push-subscription';
import {
  IPushSubscriptionRepository,
  PUSH_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';

@CommandHandler(RegisterPushSubscriptionCommand)
export class RegisterPushSubscriptionHandler implements ICommandHandler<RegisterPushSubscriptionCommand> {
  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IPushSubscriptionRepository,
  ) {}

  async execute(command: RegisterPushSubscriptionCommand): Promise<{ id: string }> {
    // Upsert by endpoint: remove existing subscription for this endpoint
    const existing = await this.subscriptionRepository.findByEndpoint(command.endpoint);
    if (existing) {
      await this.subscriptionRepository.delete(existing.id);
    }

    const subscription = PushSubscription.create(
      crypto.randomUUID(),
      command.userId,
      command.endpoint,
      command.p256dh,
      command.auth,
      command.userAgent,
    );

    const saved = await this.subscriptionRepository.save(subscription);
    return { id: saved.id };
  }
}
