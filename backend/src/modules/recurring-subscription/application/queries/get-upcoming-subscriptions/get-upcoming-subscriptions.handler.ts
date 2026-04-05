import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetUpcomingSubscriptionsQuery } from './get-upcoming-subscriptions.query';
import {
  IRecurringSubscriptionRepository,
  RECURRING_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';
import { SubscriptionResponseMapper } from '../../mappers';

@QueryHandler(GetUpcomingSubscriptionsQuery)
export class GetUpcomingSubscriptionsHandler implements IQueryHandler<GetUpcomingSubscriptionsQuery> {
  constructor(
    @Inject(RECURRING_SUBSCRIPTION_REPOSITORY)
    private readonly repository: IRecurringSubscriptionRepository,
  ) {}

  async execute(query: GetUpcomingSubscriptionsQuery) {
    const subscriptions = await this.repository.findUpcoming(query.userId, query.days);
    return SubscriptionResponseMapper.toResponseList(subscriptions);
  }
}
