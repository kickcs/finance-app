export const pushSubscriptionQueryKeys = {
  all: ['push-subscriptions'] as const,
  preferences: () => [...pushSubscriptionQueryKeys.all, 'preferences'] as const,
};
