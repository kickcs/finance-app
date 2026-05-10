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
    const rows = await this.repository.findUpcoming(query.userId, query.days);
    // Project nextDue into billingDate without mutating the aggregate, so
    // updatedAt remains the real DB value (BUG-14).
    return rows.map(({ subscription, nextDue }) => ({
      ...SubscriptionResponseMapper.toResponse(subscription),
      billingDate: nextDue,
    }));
  }
}
