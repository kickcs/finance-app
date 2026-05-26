export const accountKeys = {
  all: ['accounts'] as const,
  lists: () => [...accountKeys.all, 'list'] as const,
  byUser: (userId: string) => [...accountKeys.lists(), userId] as const,
  details: () => [...accountKeys.all, 'detail'] as const,
  detail: (userId: string, accountId: string) =>
    [...accountKeys.details(), userId, accountId] as const,
  withBalancesAll: () => [...accountKeys.all, 'with-balances'] as const,
  withBalances: (userId: string) => [...accountKeys.withBalancesAll(), userId] as const,
};
