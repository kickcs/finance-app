import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetSubscriptionByIdQuery } from './get-subscription-by-id.query';
import {
  IRecurringSubscriptionRepository,
  RECURRING_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';
import { SubscriptionResponseMapper } from '../../mappers';

@QueryHandler(GetSubscriptionByIdQuery)
export class GetSubscriptionByIdHandler implements IQueryHandler<GetSubscriptionByIdQuery> {
  constructor(
    @Inject(RECURRING_SUBSCRIPTION_REPOSITORY)
    private readonly repository: IRecurringSubscriptionRepository,
  ) {}

  async execute(query: GetSubscriptionByIdQuery) {
    const subscription = await this.repository.findById(query.id);
    if (subscription?.userId !== query.userId) {
      throw new NotFoundException('Subscription not found');
    }
    return SubscriptionResponseMapper.toResponse(subscription);
  }
}
