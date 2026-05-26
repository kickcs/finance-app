export const accountBalanceKeys = {
  all: ['accountBalances'] as const,
  byAccount: (accountId: string) => [...accountBalanceKeys.all, accountId] as const,
};
