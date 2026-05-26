export const budgetKeys = {
  all: ['budget'] as const,
  current: (userId: string) => [...budgetKeys.all, 'current', userId] as const,
};
