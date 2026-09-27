import type { QueryClient, InfiniteData } from '@tanstack/vue-query';
import { transactionQueryKeys } from './queryKeys';
import type { PaginatedResult } from './transactionsApi';
import type { Transaction } from '@/shared/api/database.types';

type InfinitePages = InfiniteData<PaginatedResult<Transaction>>;

/**
 * A single transaction can be cached in several places at once: `recent`
 * (any limit), the legacy `list`, and every infinite-scroll page (user-wide
 * or per-account). Edit/delete mutations must patch all of them or a stale
 * copy lingers until the next invalidation.
 */
function recentPrefix(userId: string) {
  return [...transactionQueryKeys.all, 'recent', userId] as const;
}

/** Snapshot every cache entry that may hold `userId`'s transactions, for rollback on error. */
export function snapshotTransactionCaches(queryClient: QueryClient, userId: string) {
  return [
    ...queryClient.getQueriesData<Transaction[]>({ queryKey: recentPrefix(userId) }),
    ...queryClient.getQueriesData<Transaction[]>({ queryKey: transactionQueryKeys.list(userId) }),
    ...queryClient.getQueriesData<InfinitePages>({
      queryKey: transactionQueryKeys.infinitePrefix(),
    }),
    ...queryClient.getQueriesData<InfinitePages>({
      queryKey: transactionQueryKeys.searchPrefix(),
    }),
  ];
}

export function restoreTransactionCaches(
  queryClient: QueryClient,
  snapshot: ReturnType<typeof snapshotTransactionCaches>,
) {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data);
  }
}

/** Patch a transaction's fields wherever it's cached. */
export function patchTransactionInCaches(
  queryClient: QueryClient,
  userId: string,
  id: string,
  patch: Partial<Transaction>,
) {
  queryClient.setQueriesData<Transaction[]>({ queryKey: recentPrefix(userId) }, (old) =>
    old?.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  );
  queryClient.setQueryData<Transaction[]>(transactionQueryKeys.list(userId), (old) =>
    old?.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  );
  const patchPages = (old: InfinitePages | undefined) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        data: page.data.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),
    };
  };
  queryClient.setQueriesData<InfinitePages>(
    { queryKey: transactionQueryKeys.infinitePrefix() },
    patchPages,
  );
  // Поиск живёт своим InfiniteData той же формы — правим и его, иначе открытый
  // поиск в Истории не увидит правку, сделанную с другого экрана.
  queryClient.setQueriesData<InfinitePages>(
    { queryKey: transactionQueryKeys.searchPrefix() },
    patchPages,
  );
}

/** Remove a transaction wherever it's cached. Balances are refreshed via invalidation, not here. */
export function removeTransactionFromCaches(queryClient: QueryClient, userId: string, id: string) {
  queryClient.setQueriesData<Transaction[]>({ queryKey: recentPrefix(userId) }, (old) =>
    old?.filter((t) => t.id !== id),
  );
  queryClient.setQueryData<Transaction[]>(transactionQueryKeys.list(userId), (old) =>
    old?.filter((t) => t.id !== id),
  );
  const removeFromPages = (old: InfinitePages | undefined) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        data: page.data.filter((t) => t.id !== id),
      })),
    };
  };
  queryClient.setQueriesData<InfinitePages>(
    { queryKey: transactionQueryKeys.infinitePrefix() },
    removeFromPages,
  );
  queryClient.setQueriesData<InfinitePages>(
    { queryKey: transactionQueryKeys.searchPrefix() },
    removeFromPages,
  );
}

/**
 * Prepend a server-created transaction to `recent` only: infinite lists are
 * filtered (account, type, search), so a blind insert would leak it into lists
 * it doesn't belong to — those catch up via invalidation.
 */
export function prependTransactionToRecent(
  queryClient: QueryClient,
  userId: string,
  transaction: Transaction,
) {
  queryClient.setQueriesData<Transaction[]>({ queryKey: recentPrefix(userId) }, (old) =>
    old ? [transaction, ...old] : old,
  );
}
