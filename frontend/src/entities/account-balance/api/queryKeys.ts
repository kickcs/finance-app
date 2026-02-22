export const accountBalanceQueryKeys = {
  all: ['accountBalances'] as const,
  byAccount: (accountId: string) => [...accountBalanceQueryKeys.all, accountId] as const,
};
