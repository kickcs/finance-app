import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UnregisterPushSubscriptionCommand } from './unregister-push-subscription.command';
import {
  IPushSubscriptionRepository,
  PUSH_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';

@CommandHandler(UnregisterPushSubscriptionCommand)
export class UnregisterPushSubscriptionHandler implements ICommandHandler<UnregisterPushSubscriptionCommand> {
  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IPushSubscriptionRepository,
  ) {}

  async execute(command: UnregisterPushSubscriptionCommand): Promise<void> {
    const subscription = await this.subscriptionRepository.findById(command.id);
    if (!subscription) {
      throw new NotFoundException('Push subscription not found');
    }
    if (subscription.userId !== command.userId) {
      throw new ForbiddenException('Access denied');
    }
    await this.subscriptionRepository.delete(command.id);
  }
}
