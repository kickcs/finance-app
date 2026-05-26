import { useInfiniteQuery } from '@tanstack/react-query';

import {
  type PaginatedCursor,
  type TransactionFilters,
  transactionsApi,
} from './transactionsApi';
import { transactionKeys } from './queryKeys';

const PAGE_SIZE = 20;

export function useInfiniteTransactions(
  userId: string | null,
  filters?: TransactionFilters,
) {
  return useInfiniteQuery({
    queryKey: transactionKeys.infinite(userId ?? '__disabled__', filters),
    queryFn: ({ pageParam }) =>
      transactionsApi.getPaginated(PAGE_SIZE, pageParam, filters),
    initialPageParam: undefined as PaginatedCursor | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!userId,
  });
}

export function useInfiniteAccountTransactions(
  userId: string | null,
  accountId: string | null,
) {
  return useInfiniteQuery({
    queryKey: transactionKeys.byAccountInfinite(
      userId ?? '__disabled__',
      accountId ?? '__disabled__',
    ),
    queryFn: ({ pageParam }) => {
      if (!accountId) throw new Error('accountId is required');
      return transactionsApi.getByAccountPaginated(accountId, PAGE_SIZE, pageParam);
    },
    initialPageParam: undefined as PaginatedCursor | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!userId && !!accountId,
  });
}
