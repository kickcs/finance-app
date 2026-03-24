# Financial Month Start Day (XDS-13)

User sets a **financial month start day** (1–31). All calculations — stats, budgets, analytics — use financial periods instead of calendar months. Default = 1 (backwards compatible).

Linear: https://linear.app/xds-tasks/issue/XDS-13

## Problem

All date calculations hardcode calendar month boundaries (`new Date(year, month-1, 1)`). Users paid mid-month see distorted monthly stats: one month shows double income, the next shows none.

## Architecture

### Date boundary convention

All date boundaries use **exclusive end** (consistent with existing codebase):
- `start` = midnight of first day (inclusive)
- `end` = midnight of first day of **next** period (exclusive)
- Queries use `date >= start AND date < end`

Example: `getFinancialMonthBounds(2026, 3, 15)` → `{ start: Mar 15 00:00:00, end: Apr 15 00:00:00 }`

All dates in `getFinancialMonthBounds` are created in **server-local timezone** (UTC in production Docker), matching how TypeORM stores and compares `timestamp with time zone`. Frontend mirrors this using UTC methods when building boundaries for API calls.

### Backend — Profile field + shared utility

**Migration**: `financial_month_start_day INTEGER DEFAULT 1 CHECK (1–31)` on `profiles` table.

**Files to modify**:
- `profile.orm-entity.ts` — add column `financialMonthStartDay`
- `profile.entity.ts` — add to domain `ProfileProps` interface
- `profile.mapper.ts` — map both directions
- `application/types/index.ts` — add `financialMonthStartDay` to `ProfileResponse`
- `update-profile.handler.ts` — accept new field (already generic via `ProfileProps`)
- `get-profile.handler.ts` — return new field (already returns all props)
- `data-source.ts` + `app.module.ts` — no change (Profile entity already registered)

**New file**: `backend/src/shared/utils/financial-period.ts`

```typescript
resolveStartDay(year, month, startDay) → number  // fallback for short months (31 in Feb → 28)
getFinancialMonthBounds(year, month, startDay) → { start: Date, end: Date }  // end is EXCLUSIVE
getFinancialMonth(date, startDay) → { year, month }  // which financial month a date belongs to
getCurrentFinancialMonth(startDay) → { year, month }
```

Edge cases handled:
- `startDay > days in month` → fallback to last day (e.g., 31 in Feb → 28)
- Year rollover: Dec with startDay=15 → Dec 15 – Jan 15 next year (exclusive end)
- Leap years: Feb 29 handling
- `startDay=1` → identical to current calendar month behavior

### Backend — startDay transport path

**Principle**: `startDay` is resolved **server-side** from the user's profile. The HTTP API does not change — controllers inject `PROFILE_REPOSITORY`, read `startDay`, and pass it down.

**Full chain for `getMonthlyStats`**:
1. `TransactionsController` — inject `PROFILE_REPOSITORY`, read `startDay` from profile, add to `GetMonthlyStatsQuery`
2. `GetMonthlyStatsQuery` — add `startDay: number` field
3. `GetMonthlyStatsHandler` — pass `startDay` to repository
4. `ITransactionRepository.getMonthlyStats(userId, year, month, startDay)` — update interface
5. `TransactionRepository.getMonthlyStats` — use `getFinancialMonthBounds(year, month, startDay)` instead of hardcoded dates

**Budget handlers transport**:
- `BudgetsController` already injects `PROFILE_REPOSITORY`
- Pass `startDay` as field in `GetBudgetForMonthQuery` and `GetBudgetHistoryQuery`
- Handlers receive `startDay` from query, pass to `getMonthlyStats`
- Budget overrides stored by `(year, month)` refer to **financial months** (same label, different boundaries). Override key `{ year: 2026, month: 3 }` at `startDay=15` covers Mar 15 – Apr 14. This is acceptable: budget "Март" = "my third financial month of the year".

**Backend modules to update**:

| Module | File | Change |
|--------|------|--------|
| Monthly Stats Interface | `transaction.repository.interface.ts` | Add `startDay` param to `getMonthlyStats` |
| Monthly Stats Query | `get-monthly-stats.query.ts` | Add `startDay` field |
| Monthly Stats Handler | `get-monthly-stats.handler.ts` | Pass `startDay` to repository |
| Monthly Stats Repository | `transaction.repository.ts` | Use `getFinancialMonthBounds()` |
| Transactions Controller | `transactions.controller.ts` | Inject `PROFILE_REPOSITORY`, read `startDay`, add to query |
| Budget Current Query | `get-budget-for-month.query.ts` | Add `startDay` field |
| Budget Current Handler | `get-budget-for-month.handler.ts` | Pass `startDay` to `getMonthlyStats` |
| Budget History Query | `get-budget-history.query.ts` | Add `startDay` field |
| Budget History Handler | `get-budget-history.handler.ts` | Iterate financial months using `getFinancialMonth`, pass `startDay` |
| Budgets Controller | `budgets.controller.ts` | Read `startDay` from profile (already has `PROFILE_REPOSITORY`), pass to queries |
| Profile API | `update-profile.handler.ts` | Accept + validate `financialMonthStartDay` (1–31) |

**Not changed** (already flexible): `getAnalyticsStats`, `getDailyStats` — accept explicit `startDate/endDate`, frontend will pass correct boundaries.

**Unit tests** for `financial-period.ts`:
- `resolveStartDay(2026, 2, 31) === 28`
- `resolveStartDay(2024, 2, 31) === 29` (leap year)
- `getFinancialMonthBounds(2026, 3, 15)` → `{ start: Mar 15 00:00, end: Apr 15 00:00 }` (exclusive)
- `getFinancialMonthBounds(2026, 12, 15)` → `{ start: Dec 15, end: Jan 15 2027 }`
- `getFinancialMonthBounds(2026, 3, 1)` → `{ start: Mar 1, end: Apr 1 }` (backwards compat)
- `getFinancialMonth('2027-01-10', 15)` → `{ year: 2026, month: 12 }` (year rollover)
- `getFinancialMonth('2026-02-28', 31)` → `{ year: 2026, month: 2 }` (resolved=28)

### Frontend — utility + composable + settings UI

**Files to modify (types + API)**:
- `database.types.ts` — add `financial_month_start_day: number` to profiles `Row` and `Update` types
- `profileApi.ts` — add `financialMonthStartDay` → `financial_month_start_day` transform in `transformProfile()` and reverse in `update()`

**New file**: `frontend/src/shared/lib/utils/financialPeriod.ts`
Mirror of backend utility + formatting:
- `formatFinancialPeriod(year, month, startDay)`:
  - `startDay=1` → "Март 2026"
  - `startDay≠1` → "15 мар – 14 апр"
- `getDaysRemainingInPeriod(startDay)` → days from today to end of current financial period (replaces `getDaysRemainingInMonth` for financial period contexts)

**New file**: `frontend/src/shared/lib/hooks/useFinancialPeriod.ts`
```typescript
useFinancialPeriod() → { startDay, isCustomPeriod, currentPeriod, currentBounds, daysRemaining }
```
Internally uses `useCurrentUser()` → `useProfile(userId)` to read `financial_month_start_day`. No parameters needed — self-contained.

**New file**: `frontend/src/features/configure-financial-period/ui/FinancialPeriodModal.vue`
- Grid 1–31 (7 columns, 4 rows of 7 + row of 3 for 29-31)
- Selected day highlighted with primary color
- Live preview: "Ваш текущий период: 15 мар – 14 апр (31 дней)"
- Hint for days 29-31: "В коротких месяцах будет использоваться последний доступный день"
- Hint for dual-paycheck: "Если вы получаете зарплату дважды в месяц, укажите день первой выплаты"
- Warning when changing from non-default: "Смена дня начала пересчитает статистику за все месяцы"

**Profile page integration**: New menu item after currency selection:
- Icon: `calendar_month`, color `#6366f1`
- Label: "Начало месяца" / "Финансовый период"
- Value: "1-е (стандарт)" or "15-е число"

**Frontend modules to update**:

| Module | Change |
|--------|--------|
| `useAnalyticsFilters` | `'month-start'` filter → use `currentBounds` from `useFinancialPeriod()` (self-contained, no params needed) |
| `useAnalyticsFilters` | Replace `daysRemainingInMonth` with `daysRemaining` from `useFinancialPeriod()` |
| `useMonthlyStats` | No HTTP change needed — backend reads `startDay` from profile server-side |
| Dashboard widgets | Use `formatFinancialPeriod()` in headers |
| Query keys | Add `startDay` to period-related keys |

**Cache invalidation on startDay change**: `queryClient.invalidateQueries()` (global reset — acceptable since change is rare).

### Profile API contract

```
PATCH /api/profiles/me
Body: { financialMonthStartDay: 15 }
Response: ProfileResponse with financialMonthStartDay: 15
```

Validation: integer 1–31. Reject otherwise with 400.

## Backwards Compatibility

- Default `1` → all calculations identical to current behavior
- Migration with `DEFAULT 1` — existing users unaffected
- `getFinancialMonthBounds(y, m, 1)` === `{ start: new Date(y, m-1, 1), end: new Date(y, m, 1) }`
- Month labels at `startDay=1` remain "Март 2026" (no date ranges)
- Query keys with `startDay=1` produce same cache hits
- HTTP API unchanged — `startDay` resolved server-side from profile

## Premium Gating

None — free feature. Basic setting affecting data correctness for all users.

## Phases

### Phase 1 — Backend infrastructure
1. Migration: `financial_month_start_day` in profiles
2. Utility `financial-period.ts` with unit tests
3. Update Profile entity/mapper/response/handler
4. Update `getMonthlyStats` full chain (interface → query → handler → repository → controller)
5. Update budget handlers (queries + handlers + controller)

### Phase 2 — Frontend infrastructure + UI
6. Update `database.types.ts` and `profileApi.ts` with new field + transforms
7. Utility `financialPeriod.ts` (mirror of backend) + `getDaysRemainingInPeriod`
8. Composable `useFinancialPeriod()` (uses `useCurrentUser` internally)
9. `FinancialPeriodModal.vue` with grid, preview, hints
10. Profile page integration
11. Update query keys with startDay

### Phase 3 — Module migration
12. `useAnalyticsFilters` → financial boundaries + `daysRemaining`
13. Dashboard widget headers → `formatFinancialPeriod()`
14. Global cache invalidation on startDay change

## Acceptance Criteria

- Migration adds `financial_month_start_day` with DEFAULT 1 and CHECK (1–31)
- `PATCH /api/profiles/me` accepts and validates `financialMonthStartDay` (1–31)
- `resolveStartDay(2026, 2, 31)` → 28
- `getFinancialMonthBounds(2026, 3, 15)` → `{ start: Mar 15 00:00, end: Apr 15 00:00 }` (exclusive end)
- `getFinancialMonth('2027-01-10', 15)` → `{ year: 2026, month: 12 }`
- `getMonthlyStats` with startDay=15 returns data for 15th → 14th
- `getBudgetForMonth` with startDay=15 calculates spent for financial period
- At startDay=1 — behavior identical to current (backwards compatible)
- `startDay` resolved server-side — HTTP API for stats/budgets unchanged
- UI: grid 1–31 with hint for 29-31, dual-paycheck hint, live preview
- UI: warning when changing startDay
- UI: month labels at startDay≠1 show date ranges, not month names
- Vue Query keys contain startDay, global invalidation on change
- `daysRemainingInPeriod` replaces `daysRemainingInMonth` in analytics
- Frontend types (`database.types.ts`) and API transforms (`profileApi.ts`) include new field
- Unit tests for all utility functions
