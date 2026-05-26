export const debtKeys = {
  all: ['debts'] as const,
  lists: () => [...debtKeys.all, 'list'] as const,
  byUser: (userId: string) => [...debtKeys.lists(), userId] as const,
  infinite: (userId: string, filters?: unknown) =>
    [...debtKeys.all, 'infinite', userId, filters ?? {}] as const,
  detail: (id: string) => [...debtKeys.all, 'detail', id] as const,
  transactions: (debtId: string) => [...debtKeys.all, 'transactions', debtId] as const,
};
