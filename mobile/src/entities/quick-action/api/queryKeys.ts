export const quickActionKeys = {
  all: ['quick-actions'] as const,
  list: (userId: string) => [...quickActionKeys.all, 'list', userId] as const,
};
