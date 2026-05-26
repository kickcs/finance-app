export const recurringSubscriptionKeys = {
  all: ['recurring-subscription'] as const,
  list: (userId: string) => [...recurringSubscriptionKeys.all, 'list', userId] as const,
  upcoming: (userId: string, days: number) =>
    [...recurringSubscriptionKeys.all, 'upcoming', userId, days] as const,
  detail: (id: string) => [...recurringSubscriptionKeys.all, 'detail', id] as const,
};
