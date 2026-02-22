export const subscriptionQueryKeys = {
  all: ['subscription'] as const,
  status: (userId: string) => [...subscriptionQueryKeys.all, 'status', userId] as const,
};
