import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { DeleteSubscriptionCommand } from './delete-subscription.command';
import {
  IRecurringSubscriptionRepository,
  RECURRING_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';

@CommandHandler(DeleteSubscriptionCommand)
export class DeleteSubscriptionHandler implements ICommandHandler<DeleteSubscriptionCommand> {
  constructor(
    @Inject(RECURRING_SUBSCRIPTION_REPOSITORY)
    private readonly repository: IRecurringSubscriptionRepository,
  ) {}

  async execute(command: DeleteSubscriptionCommand) {
    const subscription = await this.repository.findById(command.id);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    if (subscription.userId !== command.userId) {
      throw new NotFoundException('Subscription not found');
    }

    await this.repository.delete(command.id);
  }
}
