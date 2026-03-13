export const budgetQueryKeys = {
  all: ['budgets'] as const,
  current: (userId: string) => ['budgets', 'current', userId] as const,
  history: (userId: string) => ['budgets', 'history', userId] as const,
};
