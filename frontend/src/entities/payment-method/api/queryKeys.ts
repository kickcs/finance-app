export const paymentMethodQueryKeys = {
  all: ['payment-methods'] as const,
  list: (userId: string) => ['payment-methods', userId] as const,
};
