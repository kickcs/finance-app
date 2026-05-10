import type { RecurringSubscription } from '../aggregates/recurring-subscription';

export const RECURRING_SUBSCRIPTION_REPOSITORY = Symbol('RECURRING_SUBSCRIPTION_REPOSITORY');

/**
 * Result row for {@link IRecurringSubscriptionRepository.findUpcoming}.
 *
 * The repository rolls each subscription's stored `billingDate` forward to its
 * next occurrence within the requested window, but we do NOT mutate the
 * aggregate — that would bump `_updatedAt` and poison the API response. The
 * rolled date is returned alongside the untouched aggregate so callers can
 * project it into responses without persistence side effects.
 */
export interface UpcomingSubscriptionRow {
  subscription: RecurringSubscription;
  nextDue: Date;
}

export interface IRecurringSubscriptionRepository {
  findById(id: string): Promise<RecurringSubscription | null>;
  findByUserId(userId: string): Promise<RecurringSubscription[]>;
  findActiveByUserId(userId: string): Promise<RecurringSubscription[]>;
  findActiveByBillingDate(billingDate: Date): Promise<RecurringSubscription[]>;
  findUpcoming(userId: string, days: number): Promise<UpcomingSubscriptionRow[]>;
  save(subscription: RecurringSubscription): Promise<RecurringSubscription>;
  delete(id: string): Promise<void>;
}
