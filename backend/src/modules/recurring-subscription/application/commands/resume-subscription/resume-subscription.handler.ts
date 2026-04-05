import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { ResumeSubscriptionCommand } from './resume-subscription.command';
import {
  IRecurringSubscriptionRepository,
  RECURRING_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';
import { SubscriptionResponseMapper } from '../../mappers';

@CommandHandler(ResumeSubscriptionCommand)
export class ResumeSubscriptionHandler implements ICommandHandler<ResumeSubscriptionCommand> {
  constructor(
    @Inject(RECURRING_SUBSCRIPTION_REPOSITORY)
    private readonly repository: IRecurringSubscriptionRepository,
  ) {}

  async execute(command: ResumeSubscriptionCommand) {
    const subscription = await this.repository.findById(command.id);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    if (subscription.userId !== command.userId) {
      throw new NotFoundException('Subscription not found');
    }

    subscription.resume();

    const saved = await this.repository.save(subscription);
    return SubscriptionResponseMapper.toResponse(saved);
  }
}
