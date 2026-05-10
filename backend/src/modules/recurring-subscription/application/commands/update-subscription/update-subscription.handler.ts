import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { UpdateSubscriptionCommand } from './update-subscription.command';
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

@CommandHandler(UpdateSubscriptionCommand)
export class UpdateSubscriptionHandler implements ICommandHandler<UpdateSubscriptionCommand> {
  constructor(
    @Inject(RECURRING_SUBSCRIPTION_REPOSITORY)
    private readonly repository: IRecurringSubscriptionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
  ) {}

  async execute(command: UpdateSubscriptionCommand) {
    const subscription = await this.repository.findById(command.id);
    if (subscription?.userId !== command.userId) {
      throw new NotFoundException('Subscription not found');
    }

    const [account, category] = await Promise.all([
      command.data.accountId ? this.accountRepository.findById(command.data.accountId) : null,
      command.data.categoryId ? this.categoryRepository.findById(command.data.categoryId) : null,
    ]);

    if (command.data.accountId) {
      if (!account) {
        throw new NotFoundException('Account not found');
      }
      if (account.userId !== command.userId) {
        throw new ForbiddenException('Account does not belong to user');
      }
    }

    if (command.data.categoryId) {
      if (!category) {
        throw new NotFoundException('Category not found');
      }
      if (category.userId !== command.userId) {
        throw new ForbiddenException('Category does not belong to user');
      }
    }

    subscription.update(command.data);

    const saved = await this.repository.save(subscription);
    return SubscriptionResponseMapper.toResponse(saved);
  }
}
