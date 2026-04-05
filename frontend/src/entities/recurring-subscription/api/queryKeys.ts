export const recurringSubscriptionQueryKeys = {
  all: ['recurring-subscriptions'] as const,
  list: (userId: string) => [...recurringSubscriptionQueryKeys.all, 'list', userId] as const,
  detail: (id: string) => [...recurringSubscriptionQueryKeys.all, 'detail', id] as const,
  upcoming: (userId: string, days: number) =>
    [...recurringSubscriptionQueryKeys.all, 'upcoming', userId, days] as const,
  calendar: (userId: string, month: string) =>
    [...recurringSubscriptionQueryKeys.all, 'calendar', userId, month] as const,
};

export type RecurringSubscriptionQueryKeys = typeof recurringSubscriptionQueryKeys;
