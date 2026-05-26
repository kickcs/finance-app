export const personKeys = {
  all: ['people'] as const,
  list: (userId: string) => [...personKeys.all, 'list', userId] as const,
};
