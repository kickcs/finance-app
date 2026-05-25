import { toLocalISODate } from '@/shared/lib/date';
import type { RecurringSubscription, SubscriptionFrequency } from './types';

/**
 * Returns the number of days from today to the subscription's billing date.
 * Negative values mean the billing date has already passed this period.
 */
export function daysUntilBilling(billingDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const billing = new Date(billingDate);
  billing.setHours(0, 0, 0, 0);

  const diffMs = billing.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Returns a short human-readable frequency label.
 * Examples: '/мес', '/год', '/нед', '/квартал', '/7 дн'
 */
export function formatFrequencyShort(
  frequency: SubscriptionFrequency,
  days?: number | null,
): string {
  switch (frequency) {
    case 'monthly':
      return '/мес';
    case 'yearly':
      return '/год';
    case 'weekly':
      return '/нед';
    case 'quarterly':
      return '/квартал';
    case 'custom':
      return days !== null && days !== undefined ? `/${days} дн` : '/дн';
    default:
      return '';
  }
}

/**
 * Returns true if the subscription is active and its billing date falls
 * within the next `withinDays` days (inclusive of today).
 */
export function isSubscriptionDueSoon(sub: RecurringSubscription, withinDays: number = 3): boolean {
  if (sub.status !== 'active') return false;
  const days = daysUntilBilling(sub.billing_date);
  return days >= 0 && days <= withinDays;
}

/**
 * Advance a date by one billing period.
 */
export function getNextBillingDate(
  currentDate: Date,
  frequency: SubscriptionFrequency,
  frequencyDays?: number | null,
): Date {
  const next = new Date(currentDate);

  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'custom':
      next.setDate(next.getDate() + (frequencyDays && frequencyDays > 0 ? frequencyDays : 30));
      break;
  }

  return next;
}

/**
 * Compute all billing dates for a subscription that fall in the target month.
 * Uses the subscription's billingDate as the anchor and iterates forward/backward
 * to find all occurrences within the given year/month.
 *
 * @param sub - the subscription
 * @param year - 4-digit year
 * @param month - 1-based month (1=January, 12=December)
 * @returns sorted array of ISO date strings (YYYY-MM-DD) within the target month
 */
export function computeBillingDatesForMonth(
  sub: RecurringSubscription,
  year: number,
  month: number,
): string[] {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0); // last day of month

  // Parse anchor date (billing_date is stored as YYYY-MM-DD).
  // billing_date is the FIRST scheduled charge — never iterate before it.
  const [anchorYear = 0, anchorMonth = 1, anchorDay = 1] = sub.billing_date.split('-').map(Number);
  const firstBillingDate = new Date(anchorYear, anchorMonth - 1, anchorDay);

  // Subscription hasn't started yet within this month — nothing to show.
  if (firstBillingDate > monthEnd) return [];

  const results: string[] = [];
  let current = new Date(firstBillingDate);

  while (current <= monthEnd) {
    const next = getNextBillingDate(current, sub.frequency, sub.frequency_days);
    if (next.getTime() === current.getTime()) break; // guard infinite loop
    if (current >= monthStart) {
      results.push(toLocalISODate(current));
    }
    current = next;
  }

  return results;
}
