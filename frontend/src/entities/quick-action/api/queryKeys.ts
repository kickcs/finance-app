export const quickActionQueryKeys = {
  all: ['quick-actions'] as const,
  list: (userId: string) => [...quickActionQueryKeys.all, 'list', userId] as const,
};
