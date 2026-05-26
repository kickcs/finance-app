export const goalKeys = {
  all: ['goals'] as const,
  byUser: (userId: string) => [...goalKeys.all, 'list', userId] as const,
  detail: (id: string) => [...goalKeys.all, 'detail', id] as const,
};
