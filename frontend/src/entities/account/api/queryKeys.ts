// Query key factory for accounts entity
export const accountQueryKeys = {
  all: ['accounts'] as const,
  list: (userId: string) => [...accountQueryKeys.all, 'list', userId] as const,
  detail: (accountId: string) => [...accountQueryKeys.all, 'detail', accountId] as const,
};

export type AccountQueryKeys = typeof accountQueryKeys;
