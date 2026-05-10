import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { CreateSubscriptionCommand } from './create-subscription.command';
import { RecurringSubscription } from '../../../domain/aggregates/recurring-subscription';
import {
  IRecurringSubscriptionRepository,
  RECURRING_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../../accounting/domain/repositories/account.repository.interface';
import {
  ICategoryRepository,
  CATEGORY_REPOSITORY,
} from '../../../../accounting/domain/repositories/category.repository.interface';
import { SubscriptionResponseMapper } from '../../mappers';

@CommandHandler(CreateSubscriptionCommand)
export class CreateSubscriptionHandler implements ICommandHandler<CreateSubscriptionCommand> {
  constructor(
    @Inject(RECURRING_SUBSCRIPTION_REPOSITORY)
    private readonly repository: IRecurringSubscriptionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
  ) {}

  async execute(command: CreateSubscriptionCommand) {
    const [account, category] = await Promise.all([
      command.accountId ? this.accountRepository.findById(command.accountId) : null,
      command.categoryId ? this.categoryRepository.findById(command.categoryId) : null,
    ]);

    if (command.accountId) {
      if (!account) {
        throw new NotFoundException('Account not found');
      }
      if (account.userId !== command.userId) {
        throw new ForbiddenException('Account does not belong to user');
      }
    }

    if (command.categoryId) {
      if (!category) {
        throw new NotFoundException('Category not found');
      }
      if (category.userId !== command.userId) {
        throw new ForbiddenException('Category does not belong to user');
      }
    }

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
