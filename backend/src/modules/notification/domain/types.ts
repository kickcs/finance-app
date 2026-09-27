export type NotificationType =
  | 'subscription_upcoming'
  | 'subscription_charged'
  | 'subscription_failed'
  | 'auto_charge'
  | 'test';

export function buildDedupKey(
  type: Exclude<NotificationType, 'test'>,
  subscriptionId: string,
  date: string,
  daysBefore?: number,
): string {
  return daysBefore !== undefined
    ? `${type}:${subscriptionId}:${date}:${daysBefore}`
    : `${type}:${subscriptionId}:${date}`;
}
