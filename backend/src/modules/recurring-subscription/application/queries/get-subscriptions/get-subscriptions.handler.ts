import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetSubscriptionsQuery } from './get-subscriptions.query';
import {
  IRecurringSubscriptionRepository,
  RECURRING_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';
import { SubscriptionResponseMapper } from '../../mappers';

@QueryHandler(GetSubscriptionsQuery)
export class GetSubscriptionsHandler implements IQueryHandler<GetSubscriptionsQuery> {
  constructor(
    @Inject(RECURRING_SUBSCRIPTION_REPOSITORY)
    private readonly repository: IRecurringSubscriptionRepository,
  ) {}

  async execute(query: GetSubscriptionsQuery) {
    const subscriptions = await this.repository.findByUserId(query.userId);
    return SubscriptionResponseMapper.toResponseList(subscriptions);
  }
}
