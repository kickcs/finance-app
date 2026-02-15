export const categoryQueryKeys = {
  all: ['categories'] as const,
  list: (userId: string) => [...categoryQueryKeys.all, 'list', userId] as const,
  byType: (userId: string, type: 'expense' | 'income') =>
    [...categoryQueryKeys.list(userId), type] as const,
};
