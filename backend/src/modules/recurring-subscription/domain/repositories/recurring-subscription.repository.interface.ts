import type { RecurringSubscription } from '../aggregates/recurring-subscription';

export const RECURRING_SUBSCRIPTION_REPOSITORY = Symbol('RECURRING_SUBSCRIPTION_REPOSITORY');

export interface IRecurringSubscriptionRepository {
  findById(id: string): Promise<RecurringSubscription | null>;
  findByUserId(userId: string): Promise<RecurringSubscription[]>;
  findActiveByUserId(userId: string): Promise<RecurringSubscription[]>;
  findActiveByBillingDate(billingDate: Date): Promise<RecurringSubscription[]>;
  findUpcoming(userId: string, days: number): Promise<RecurringSubscription[]>;
  save(subscription: RecurringSubscription): Promise<RecurringSubscription>;
  delete(id: string): Promise<void>;
}
