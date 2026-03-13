export const budgetQueryKeys = {
  all: ['budgets'] as const,
  current: (userId: string) => ['budgets', 'current', userId] as const,
};
