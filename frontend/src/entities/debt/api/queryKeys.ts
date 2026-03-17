// Query key factory for debts entity
export const debtQueryKeys = {
  all: ['debts'] as const,
  list: (userId: string) => [...debtQueryKeys.all, 'list', userId] as const,
  detail: (debtId: string) => [...debtQueryKeys.all, 'detail', debtId] as const,
  transactions: (debtId: string) => [...debtQueryKeys.all, 'transactions', debtId] as const,
};

export type DebtQueryKeys = typeof debtQueryKeys;
