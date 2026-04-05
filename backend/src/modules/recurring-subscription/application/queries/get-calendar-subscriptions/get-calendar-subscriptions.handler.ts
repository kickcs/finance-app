import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetCalendarSubscriptionsQuery } from './get-calendar-subscriptions.query';
import {
  IRecurringSubscriptionRepository,
  RECURRING_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';
import { SubscriptionResponseMapper } from '../../mappers';
import { RecurringSubscription } from '../../../domain/aggregates/recurring-subscription';

@QueryHandler(GetCalendarSubscriptionsQuery)
export class GetCalendarSubscriptionsHandler implements IQueryHandler<GetCalendarSubscriptionsQuery> {
  constructor(
    @Inject(RECURRING_SUBSCRIPTION_REPOSITORY)
    private readonly repository: IRecurringSubscriptionRepository,
  ) {}

  async execute(query: GetCalendarSubscriptionsQuery) {
    const subscriptions = await this.repository.findActiveByUserId(query.userId);

    const monthStart = new Date(query.year, query.month - 1, 1);
    const monthEnd = new Date(query.year, query.month, 0); // last day of month

    const results: {
      subscription: ReturnType<typeof SubscriptionResponseMapper.toResponse>;
      dates: string[];
    }[] = [];

    for (const sub of subscriptions) {
      const dates = this.computeBillingDatesInMonth(sub, monthStart, monthEnd);
      if (dates.length > 0) {
        results.push({
          subscription: SubscriptionResponseMapper.toResponse(sub),
          dates,
        });
      }
    }

    return results;
  }

  private computeBillingDatesInMonth(
    subscription: RecurringSubscription,
    monthStart: Date,
    monthEnd: Date,
  ): string[] {
    const dates: string[] = [];
    const frequency = subscription.frequency;
    const frequencyDays = subscription.frequencyDays;

    // Start from the billing date and step forward/backward to find dates in the target month
    // We need to find all occurrences that fall within [monthStart, monthEnd]
    let current = new Date(subscription.billingDate);

    // First, rewind to before monthStart if billing date is after it
    // Then step forward to find all dates in range
    // For efficiency, step backwards from billingDate until before monthStart
    while (current > monthEnd) {
      current = RecurringSubscription.rewindDate(current, frequency, frequencyDays);
    }

    // Now step forward until we pass monthEnd
    // But first rewind further to make sure we don't miss any
    while (current >= monthStart) {
      current = RecurringSubscription.rewindDate(current, frequency, frequencyDays);
    }

    // Now step forward through the month
    // Limit iterations to prevent infinite loops
    let iterations = 0;
    const maxIterations = 1000;
    while (current <= monthEnd && iterations < maxIterations) {
      current = RecurringSubscription.advanceDate(current, frequency, frequencyDays);
      iterations++;
      if (current >= monthStart && current <= monthEnd) {
        dates.push(this.formatDate(current));
      }
      if (current > monthEnd) break;
    }

    return [...new Set(dates)].sort();
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
