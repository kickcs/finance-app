export const transactionKeys = {
  all: ['transactions'] as const,
  list: (userId: string, limit?: number) =>
    [...transactionKeys.all, 'list', userId, limit ?? null] as const,
  infinite: (userId: string, filters?: unknown) =>
    [...transactionKeys.all, 'infinite', userId, filters ?? {}] as const,
  byAccount: (userId: string, accountId: string) =>
    [...transactionKeys.all, 'account', userId, accountId] as const,
  byAccountInfinite: (userId: string, accountId: string) =>
    [...transactionKeys.all, 'account-infinite', userId, accountId] as const,
  recent: (userId: string, limit: number) =>
    [...transactionKeys.all, 'recent', userId, limit] as const,
  detail: (id: string) => [...transactionKeys.all, 'detail', id] as const,
  monthly: (userId: string, year: number, month: number) =>
    [...transactionKeys.all, 'monthly', userId, year, month] as const,
};
