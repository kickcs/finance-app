import type { InfiniteData, QueryClient } from '@tanstack/vue-query';
import type { Debt } from '@/shared/api/database.types';
import { debtQueryKeys } from './queryKeys';
import type { DebtsFilters, DebtStatus, PaginatedDebtsResult } from '../model/types';

/**
 * Optimistic cache helpers for debt mutations.
 *
 * Debt data lives in two cache shapes:
 * - plain lists `['debts', 'list', userId]` (dashboard, debt detail page)
 * - grouped infinite queries `['debts', 'infinite', userId, filters]` (debts page)
 *
 * Flow: `snapshotDebtCaches` → `applyDebtUpdate`/`applyDebtRemove` → API call →
 * `invalidateDebtRelated` on success / `restoreDebtCaches` on error.
 */

type InfiniteDebts = InfiniteData<PaginatedDebtsResult, unknown>;
type DebtSummary = PaginatedDebtsResult['totalSummary'];

export type DebtCacheSnapshot = Array<[readonly unknown[], unknown]>;

/** Cancel in-flight debt queries (so refetches don't overwrite the optimistic state) and snapshot all debt caches. */
export async function snapshotDebtCaches(queryClient: QueryClient): Promise<DebtCacheSnapshot> {
  await queryClient.cancelQueries({ queryKey: debtQueryKeys.all });
  return queryClient.getQueriesData({ queryKey: debtQueryKeys.all });
}

export function restoreDebtCaches(queryClient: QueryClient, snapshot: DebtCacheSnapshot): void {
  for (const [queryKey, data] of snapshot) {
    queryClient.setQueryData(queryKey, data);
  }
}

/**
 * Optimistically patch a debt in every debt cache.
 *
 * In infinite caches filtered by `status: 'active'` (the default), setting
 * `is_closed: true` removes the debt from its group, drops the group when it
 * becomes empty, decrements `totalDebtsCount` and subtracts the debt's previous
 * `remaining_amount` from `totalSummary`. Closed-status caches are not updated
 * with newly closed debts — the follow-up invalidation refetches them.
 */
export function applyDebtUpdate(
  queryClient: QueryClient,
  debtId: string,
  updates: Partial<Debt>,
): void {
  applyToListCaches(queryClient, debtId, updates);
  applyToInfiniteCaches(queryClient, debtId, updates);
}

/** Optimistically remove a debt from every debt cache (delete flow). */
export function applyDebtRemove(queryClient: QueryClient, debtId: string): void {
  applyToListCaches(queryClient, debtId, null);
  applyToInfiniteCaches(queryClient, debtId, null);
}

/**
 * Expected end state of a debt after paying `amount` towards it
 * (optionally forgiving the remainder). Shared by the single-payment
 * and close-all flows so both predict the same optimistic state.
 */
export function buildDebtPaymentPatch(debt: Debt, amount: number, forgive: boolean): Partial<Debt> {
  const willClose = forgive || amount >= debt.remaining_amount;
  return {
    remaining_amount: willClose ? 0 : debt.remaining_amount - amount,
    is_closed: willClose,
    ...(willClose ? { closed_at: new Date().toISOString() } : {}),
    ...(forgive ? { forgiven_amount: Math.max(0, debt.remaining_amount - amount) } : {}),
  };
}

function applyToListCaches(
  queryClient: QueryClient,
  debtId: string,
  updates: Partial<Debt> | null,
): void {
  // Списки бывают со статусом в ключе (`['debts','list',uid,'active']`), и
  // закрывшийся долг обязан из такого списка исчезнуть, а не остаться
  // закрытым — поэтому записи перебираются вручную, ради доступа к ключу.
  const entries = queryClient.getQueriesData<Debt[]>({ queryKey: debtQueryKeys.listPrefix() });
  for (const [queryKey, data] of entries) {
    if (!data) continue;
    if (!data.some((debt) => debt.id === debtId)) continue;

    const status = queryKey[3] as DebtStatus | undefined;
    const next: Debt[] = [];
    for (const debt of data) {
      if (debt.id !== debtId) {
        next.push(debt);
        continue;
      }
      if (updates === null) continue;
      const after = { ...debt, ...updates };
      if (status && after.is_closed !== (status === 'closed')) continue;
      next.push(after);
    }
    queryClient.setQueryData(queryKey, next);
  }
}

function applyToInfiniteCaches(
  queryClient: QueryClient,
  debtId: string,
  updates: Partial<Debt> | null,
): void {
  // setQueriesData's updater doesn't expose the query key, but the transform
  // depends on each cache's filters — iterate entries manually.
  const infiniteEntries = queryClient.getQueriesData<InfiniteDebts>({
    queryKey: debtQueryKeys.infinitePrefix(),
  });
  for (const [queryKey, data] of infiniteEntries) {
    if (!data) continue;
    const filters = (queryKey[3] ?? {}) as DebtsFilters;
    queryClient.setQueryData(queryKey, transformInfinite(data, filters, debtId, updates));
  }
}

function transformInfinite(
  data: InfiniteDebts,
  filters: DebtsFilters,
  debtId: string,
  updates: Partial<Debt> | null,
): InfiniteDebts {
  const before = findDebtInPages(data.pages, debtId);
  if (!before) return data;

  const statusFilter = filters.status ?? 'active';
  const after = updates === null ? null : { ...before, ...updates };
  const closingNow = !!after && !before.is_closed && after.is_closed;
  const remove = after === null || (statusFilter === 'active' && closingNow);
  const summaryDelta = remove
    ? before.remaining_amount
    : before.remaining_amount - after.remaining_amount;

  const pages = data.pages.map((page, pageIndex) => {
    const groups = page.groups
      .map((group) => {
        if (!group.debts.some((d) => d.id === debtId)) return group;
        const debts = remove
          ? group.debts.filter((d) => d.id !== debtId)
          : group.debts.map((d) => (d.id === debtId ? (after as Debt) : d));
        return { ...group, debts };
      })
      .filter((group) => group.debts.length > 0);

    return {
      ...page,
      groups,
      totalDebtsCount: remove ? Math.max(0, page.totalDebtsCount - 1) : page.totalDebtsCount,
      // totalSummary is read from pages[0] only
      totalSummary:
        pageIndex === 0
          ? subtractFromSummary(page.totalSummary, before, summaryDelta)
          : page.totalSummary,
    };
  });

  return { ...data, pages };
}

function findDebtInPages(pages: PaginatedDebtsResult[], debtId: string): Debt | null {
  for (const page of pages) {
    for (const group of page.groups) {
      const debt = group.debts.find((d) => d.id === debtId);
      if (debt) return debt;
    }
  }
  return null;
}

function subtractFromSummary(summary: DebtSummary, debt: Debt, amount: number): DebtSummary {
  if (amount === 0) return summary;
  const bucket = debt.debt_type === 'given' ? 'totalGiven' : 'totalTaken';
  const current = summary[bucket][debt.currency] ?? 0;
  return {
    ...summary,
    [bucket]: { ...summary[bucket], [debt.currency]: Math.max(0, current - amount) },
  };
}
