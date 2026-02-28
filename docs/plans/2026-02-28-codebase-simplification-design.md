# Codebase Simplification — Remaining Issues Design

**Date:** 2026-02-28
**Status:** Approved

## Overview

11 issues flagged by full-codebase review that require non-mechanical fixes. Grouped by effort: quick wins, medium, large.

## Quick Wins

### 1. Missing DB Indexes

New migration adding 3 indexes:
- `IDX_transactions_to_account_id` on `transactions(to_account_id) WHERE to_account_id IS NOT NULL` — B-tree partial index for transfer lookups
- `IDX_debts_source_transaction_id` on `debts(source_transaction_id) WHERE source_transaction_id IS NOT NULL` — for `hasOpenDebtsForTransaction`
- `IDX_transactions_description_trgm` using `GIN(description gin_trgm_ops)` — requires `CREATE EXTENSION IF NOT EXISTS pg_trgm` — for `ILIKE '%term%'` search

### 2. Reminder `isUpcoming`/`isOverdue` Utilities

Add `entities/reminder/model/utils.ts`:
```ts
export const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function isReminderOverdue(reminder: { next_date: string; is_active: boolean }): boolean {
  return reminder.is_active && new Date(reminder.next_date).getTime() < Date.now();
}

export function isReminderUpcoming(reminder: { next_date: string; is_active: boolean }, windowMs = THREE_DAYS_MS): boolean {
  const nextMs = new Date(reminder.next_date).getTime();
  const now = Date.now();
  return reminder.is_active && nextMs >= now && nextMs - now < windowMs;
}
```

Replace inline logic in: `ReminderCard.vue`, `RemindersSection.vue`, `ReminderDetailPage.vue`. Update `useReminders.ts` to call `isReminderUpcoming(r, SEVEN_DAYS_MS)`.

### 3. `getHashtags` SQL Rewrite

Replace JS-side regex parsing with PostgreSQL:
```sql
SELECT tag, COUNT(*) as count FROM (
  SELECT unnest(regexp_matches(description, '#[^\s#]+', 'g')) as tag
  FROM transactions WHERE user_id = :uid AND description LIKE '%#%'
) sub GROUP BY tag ORDER BY count DESC
```

Uses `#[^\s#]+` (non-whitespace, non-hash after #) to support Unicode without needing `\p{L}`.

### 4. `PremiumGuard` Caching

Add in-memory cache with 5-minute TTL:
```ts
private cache = new Map<string, { isPremium: boolean; checkedAt: number }>();
private readonly TTL = 5 * 60 * 1000;
```

Clear cache entry on `@OnEvent('subscription.changed')`. Falls through to DB on cache miss or expiry.

## Medium Effort

### 5. `getAnalyticsStats` Query Consolidation (14 → 3)

Replace 12 scalar/by-currency queries with single aggregation:
```sql
SELECT type, category_id, currency, SUM(amount) as total
FROM transactions
WHERE user_id = :uid AND date BETWEEN :start AND :end
GROUP BY type, category_id, currency
```

Compute regularIncome, regularExpense, debtGiven, debtTaken, debtReturnsToMe, debtReturnsFromMe (and by-currency variants) from this single result in application code. Category breakdown + offset queries remain separate. **14 → 3 queries.**

### 6. Bulk Import Batching

Convert 3 sequential for-loops to batch:
- Categories: `categoryRepository.saveMany(newCats)` (already exists)
- Accounts: `ormRepository.save([...accountsToSave.values()])` (TypeORM array save)
- Transactions: `ormRepository.save(transactionsToSave)` (TypeORM array save)

Keep `dataSource.transaction()` wrapper. Post-commit event publish loops stay sequential.

### 7. Transaction Edit/Delete Composable

Extract `useTransactionEditFlow(userId)` to `entities/transaction/model/useTransactionEditFlow.ts`:
- Encapsulates: `useTransactionSelection`, `useEditTransaction`, `showDeleteModal` ref
- Returns: `selectedTransaction`, `showEditModal`, `showDeleteModal`, all handlers, `isUpdating`, `isDeleting`
- Consumers: `HistoryPage.vue` and `AccountDetailPage.vue`

### 8. Payment Modal Deduplication

Extract:
1. `useDebtPaymentForm(debtCurrency, remainingAmount)` composable — `paymentAmount`, `forgiveRemainder`, `excessCategoryId`, `isOverpayment`, `excess`, `isValid`, watch side effect
2. `ForgivenessToggle.vue` — shared checkbox+label+icon UI block

Location: `features/partial-payment/` (shared by both features via cross-feature import, or lifted to `entities/debt/ui/`).

## Large Refactors

### 9. Router Navigation Consistency

Create `app/router/routeNames.ts`:
```ts
export const ROUTE_NAMES = {
  DASHBOARD: 'dashboard',
  PROFILE: 'profile',
  HISTORY: 'history',
  // ... all routes
} as const;
```

Convert 28 `router.push('/path')` calls across 11 files to `router.push({ name: ROUTE_NAMES.XXX })`. For routes with params/query, use `{ name, params, query }` syntax.

### 10. `DeleteDebtHandler` — Use Command Bus

Replace direct ORM access with dispatching `DeleteTransactionCommand` per transaction via `CommandBus`. The existing `DeleteTransactionHandler` already uses `BalanceCalculationService` correctly.

Flow: fetch debt → get transaction IDs → `Promise.all(ids.map(id => commandBus.execute(new DeleteTransactionCommand(userId, id))))` → delete debt entity.

Remove direct imports of `TransactionOrmEntity` and `AccountBalanceOrmEntity`.

### 11. Demo Data Sync Contract

Pragmatic approach: keep duplication, improve maintainability.
- Add prominent cross-reference comments in both files
- Extract shared numeric constants into a `DEMO_CONFIG` object at top of each file with identical structure for easy diffing
- Do NOT create shared package — over-engineering for demo data
