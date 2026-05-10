import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetCalendarSubscriptionsQuery } from './get-calendar-subscriptions.query';
import {
  IRecurringSubscriptionRepository,
  RECURRING_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';
import { SubscriptionResponseMapper } from '../../mappers';
import { RecurringSubscription } from '../../../domain/aggregates/recurring-subscription';
import { formatDateUTC } from '../../../../../shared/utils/date';

@QueryHandler(GetCalendarSubscriptionsQuery)
export class GetCalendarSubscriptionsHandler implements IQueryHandler<GetCalendarSubscriptionsQuery> {
  constructor(
    @Inject(RECURRING_SUBSCRIPTION_REPOSITORY)
    private readonly repository: IRecurringSubscriptionRepository,
  ) {}

  async execute(query: GetCalendarSubscriptionsQuery) {
    const subscriptions = await this.repository.findActiveByUserId(query.userId);

    // All month bounds are computed in UTC to match the calendar-day semantics
    // of the `date` column (which arrives as a UTC-midnight Date) and the
    // UTC-based arithmetic in RecurringSubscription.advanceDate.
    const monthStart = new Date(Date.UTC(query.year, query.month - 1, 1));
    const monthEnd = new Date(Date.UTC(query.year, query.month, 0)); // last day of target month

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

    // Anchor at the subscription's billingDate, normalised to a UTC-midnight
    // Date so day comparisons align with monthStart / monthEnd.
    const anchor = subscription.billingDate;
    let current = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()),
    );

    // Rewind until current is strictly before monthStart so the first
    // forward-step lands on or after monthStart (and the in-range test
    // catches the very first occurrence, including one exactly on monthStart).
    while (current >= monthStart) {
      const prev = RecurringSubscription.rewindDate(current, frequency, frequencyDays);
      if (prev.getTime() === current.getTime()) break;
      current = prev;
    }

    let iterations = 0;
    const maxIterations = 1000;
    while (iterations < maxIterations) {
      const advanced = RecurringSubscription.advanceDate(current, frequency, frequencyDays);
      if (advanced.getTime() === current.getTime()) break;
      current = advanced;
      iterations++;
      if (current >= monthStart && current <= monthEnd) {
        dates.push(formatDateUTC(current));
      }
      if (current > monthEnd) break;
    }

    return [...new Set(dates)].sort();
  }
}
