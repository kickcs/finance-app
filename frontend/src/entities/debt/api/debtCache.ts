import type { InfiniteData, QueryClient } from '@tanstack/vue-query';
import type { Debt } from '@/shared/api/database.types';
import { debtQueryKeys } from './queryKeys';
import type { DebtsFilters, PaginatedDebtsResult } from '../model/types';

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
  queryClient.setQueriesData<Debt[]>({ queryKey: debtQueryKeys.listPrefix() }, (old) => {
    if (!old) return old;
    return updates === null
      ? old.filter((d) => d.id !== debtId)
      : old.map((d) => (d.id === debtId ? { ...d, ...updates } : d));
  });
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
