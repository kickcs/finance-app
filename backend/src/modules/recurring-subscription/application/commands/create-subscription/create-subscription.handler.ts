import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateSubscriptionCommand } from './create-subscription.command';
import { RecurringSubscription } from '../../../domain/aggregates/recurring-subscription';
import {
  IRecurringSubscriptionRepository,
  RECURRING_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';
import { SubscriptionResponseMapper } from '../../mappers';

@CommandHandler(CreateSubscriptionCommand)
export class CreateSubscriptionHandler implements ICommandHandler<CreateSubscriptionCommand> {
  constructor(
    @Inject(RECURRING_SUBSCRIPTION_REPOSITORY)
    private readonly repository: IRecurringSubscriptionRepository,
  ) {}

  async execute(command: CreateSubscriptionCommand) {
    const subscription = RecurringSubscription.create(
      crypto.randomUUID(),
      command.userId,
      command.name,
      command.amount,
      command.currency,
      command.icon,
      command.color,
      command.frequency,
      command.billingDate,
      command.categoryId,
      command.description,
      command.accountId,
      command.frequencyDays,
      command.notifyDaysBefore,
      command.autoCharge,
    );

    const saved = await this.repository.save(subscription);
    return SubscriptionResponseMapper.toResponse(saved);
  }
}
