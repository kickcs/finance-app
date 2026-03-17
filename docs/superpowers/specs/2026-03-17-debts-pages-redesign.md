# Debts Pages Redesign

**Date:** 2026-03-17
**Status:** Draft
**Scope:** Frontend debts pages + minor backend changes (migration, transaction filter)

## Problem Statement

The debts pages have several UX and code quality issues:

1. **No tree grouping** — active debts show in a flat list or manual grouped view with a toggle that adds complexity without value
2. **Closed debts lack context** — no indication of when debts were closed, how long they took, or whether they were forgiven
3. **No payment timeline** — partial payments happen but users can't see the history
4. **Code duplication** — DebtDetailPage and DebtDetailPanel share ~90% identical code
5. **Currency bugs** — amounts summed across currencies without conversion, hardcoded UZS fallback, debt currency not always displayed
6. **Missing description** — debt comments entered during creation are stored only on the linked transaction, never on the debt itself, so they're invisible in the debt detail view
7. **Hardcoded colors and dead code** — `#ef4444` in DebtCard, unused `_paid` computed, `DEBT_DIRECTION_COLORS` duplicates design token hex values
8. **Inconsistent animations** — DebtsSection uses custom CSS transitions instead of shared `listTransition`

## Design

### 1. Active Debts — Tree by Person

Replace the flat/grouped view toggle with a Reka UI `TreeRoot` + `TreeItem` structure.

> **Note:** Reka UI also offers `Accordion` and `Collapsible` components which are purpose-built for expand/collapse. `TreeRoot` is chosen per user preference — it provides keyboard navigation (arrow keys) and ARIA tree semantics as a bonus. If tree keyboard nav feels wrong during implementation, `Collapsible` is the fallback.

**Person node (collapsed):**
- Expand arrow (rotates on open)
- InitialAvatar — first letter of name, colored by debt type (amber = given, purple = taken)
- Person name
- Subtitle: "{N} долгов · Вам должны / Вы должны"
- Total remaining amount (converted to user currency if mixed, with `≈` prefix; in debt currency if all same)

**Person node (expanded):**
- Same header as collapsed
- Vertical connector line (`border-left`) from parent to children
- Child debt cards (compact DebtCard) indented under the line

**Overdue debts:**
- Red-tinted background (`bg-danger/3`) and border (`border-danger/15`) on the debt card
- "Просрочено" text instead of date
- Red icon color instead of debt-type color

**Behavior:**
- `personFilter` from query params auto-expands the matching person node via TreeRoot's `defaultExpanded`
- Click on debt card → mobile: navigate to DebtDetailPage; desktop: show in MasterDetailLayout detail panel (unchanged)
- Summary cards remain at top (Вам должны / Вы должны) with converted totals

**Empty states:**
- No active debts at all → existing "Вы без долгов!" empty state (unchanged)
- Person filter matches nobody → show filter chip with clear button + "Нет долгов для этого человека"

**Removed:**
- `viewMode` toggle (grouped/flat) — only tree view
- Custom view mode buttons

### 2. Backend Migration — Add `description`, `closed_at`, `forgiven_amount` to Debts

The debt entity currently lacks fields needed for the redesign:

- **`description`** (varchar, nullable) — debt comment/note. Currently the "description" entered in DebtForm is only stored on the linked transaction, not the debt itself. Adding it to the debt makes it accessible without loading the transaction.
- **`closed_at`** (timestamp, nullable) — set when `is_closed` becomes true. Needed for ClosedDebtCard to show the closed date and calculate duration without loading transactions.
- **`forgiven_amount`** (decimal(18,2), nullable, default 0) — amount that was forgiven when closing. Needed to distinguish "fully paid" from "partially/fully forgiven" debts. Set by the partial payment flow when `forgiveRemainder` is true.

**Changes required:**
1. New TypeORM migration: `AddDebtMetadata`
2. Update `DebtOrmEntity` — add 3 columns
3. Update `Debt` domain aggregate — add properties + setter methods
4. Update `DebtMapper` — map new fields
5. Update `CreateDebtDto` / `UpdateDebtDto` — add optional fields
6. Update `DebtResponse` type — include new fields in API response
7. Update close-debt / partial-payment command handlers — set `closed_at` and `forgiven_amount` when applicable
8. Update `debtsApi.ts` (frontend) — transform new fields in `DebtResponse`
9. Update `database.types.ts` (frontend) — add new fields to Debt type

### 3. Closed Debts — Informative Cards

Replace plain DebtCard in the "Закрытые" tab with `ClosedDebtCard`:

**Card structure:**
- Success check icon (✓) or forgiveness icon (♡) based on `forgiven_amount > 0`
- Person name + debt type subtitle
- Total amount in debt's own currency
- "Прощён" badge if `forgiven_amount > 0`
- Mini timeline bar: `created_at` → filled progress → `closed_at`
- Summary line: "{N} дней" (duration from `created_at` to `closed_at`). Payment count is NOT shown in the list card (requires transaction loading); it's only visible in the detail timeline.

**Data sources (all from the debt entity, no extra API calls):**
- Created date: `debt.created_at`
- Closed date: `debt.closed_at` (new field)
- Duration: `closed_at - created_at` in days
- Forgiveness: `debt.forgiven_amount > 0` (new field)

### 4. Debt Detail — Shared Component + Payment Timeline

**DebtDetailContent.vue** — new shared component used by both DebtDetailPage and DebtDetailPanel.

**Props:** `debt: Debt`, `transactions: Transaction[]`, `accounts: AccountWithBalances[]`, `isLoading: boolean`, `transactionsLoading: boolean`
**Emits:** `payment`, `edit`, `delete`

**Sections:**
1. **Main card** — icon badge, person name, debt direction label, closed badge. Amount section with remaining/paid/progress (unchanged layout). Amounts displayed in `debt.currency`.
2. **Description block** — shown only if `debt.description` exists (new field). Label "Комментарий" + text.
3. **Payment timeline** (`DebtPaymentTimeline.vue`) — vertical timeline:
   - First node: "Долг создан" — date + total amount (indigo dot)
   - Payment nodes: "Платёж" — amount + account name + date (green dot). Derived from transactions with `debt_id`.
   - Forgiveness node (if `debt.forgiven_amount > 0`): "Прощено" — forgiven amount (amber dot)
   - Current/final node: "Осталось {amount}" (outlined dot) or "Погашен" (green check)
   - Shows skeleton while `transactionsLoading` is true
4. **Details card** — simplified: linked account, due date, created date. Removed: "Тип" (visible from context), "Валюта" (visible from amounts).
5. **Actions** — payment button (active debts) or delete button (closed debts). Desktop panel adds edit button.

**DebtDetailPage.vue** — thin wrapper: loads debt + transactions via `useDebtTransactions`, passes to DebtDetailContent, handles modals.
**DebtDetailPanel.vue** — thin wrapper: same pattern, emits to parent for modals.

### 5. Currency Fixes

**Principle:** Each debt stores and displays its own currency. Conversion only for totals.

**Individual debts:**
- Always display using `debt.currency`. The backend always returns the currency field (column has `default: 'UZS'`), so the frontend fallback `|| DEFAULT_CURRENCY` is redundant but harmless. The real fix is ensuring currency is always set correctly at creation time.

**Person totals in Tree (page-level computation):**
- Move grouping logic out of `useDebts.ts` entity composable (which has no access to exchange rates) into `DebtsListPage.vue` where `useExchangeRates` is available.
- If all debts for a person are in the same currency → display in that currency
- If mixed currencies → convert to user currency with `convert()`, prefix with `≈`

**Summary cards:**
- Already convert via `useExchangeRates.convert()` in DebtsListPage — no change needed.

**`useDebts.ts` cleanup:**
- Remove `debtsByPerson` computed from entity composable (it sums raw amounts across currencies — fundamentally broken). Move to page-level.
- Remove `totalDebt` and `totalPaid` computeds (same cross-currency summing bug). These are unused outside the composable.
- Keep `overallProgress` only if it can be made currency-aware, otherwise remove.

**Specific fixes:**
- `debtsApi.create` line 74: remove `?? 'UZS'` — form always provides currency from selected account
- `DebtCard`: show `CurrencyBadge` next to amount when debt currency differs from user's main currency

**Hardcoded colors:**
- `DebtCard.vue` line 76-78: replace `#ef4444` with Tailwind `text-danger` / `bg-danger`
- `DEBT_DIRECTION_COLORS` in `entities/debt/model/types.ts`: currently `{ given: '#f59e0b', taken: '#8b5cf6' }` — these duplicate design tokens `--color-debt-given` and `--color-debt-received`. Replace with CSS variable references where possible, or at minimum note the duplication. Components using `:style="{ color: ... }"` bindings need raw hex, so keep the constants but ensure they match the tokens.

### 6. API Changes

**Backend — Transaction filter by debt_id:**

Add `debtId` query parameter to existing transactions endpoint:
`GET /api/transactions?debtId=<uuid>`

Implementation: add optional `debtId` filter in the get-transactions query handler's `where` clause.

**Frontend — New composable:**

`entities/debt/api/useDebtTransactions.ts`:
```typescript
export function useDebtTransactions(debtId: MaybeRefOrGetter<string | null>) {
  // Vue Query composable that fetches transactions filtered by debt_id
  // Returns: transactions (sorted by date asc for timeline), isLoading
  // Uses existing transactionsApi with debtId filter param
}
```

### 7. Code Cleanup

**Removed:**
- `_paid` unused computed in `DebtCard.vue`
- `viewMode` state and toggle buttons in `DebtsListPage.vue`
- Duplicated detail layout code in `DebtDetailPanel.vue` (replaced by DebtDetailContent)
- "Тип" and "Валюта" rows from details card
- Custom `.debt-list-*` CSS transitions in `DebtsSection.vue` (replace with `listTransition`)
- `debtsByPerson`, `totalDebt`, `totalPaid` from `useDebts.ts` (moved to page level or removed)

**Unchanged:**
- MasterDetailLayout behavior (desktop detail panel)
- Summary cards structure
- Modals (DeleteDebtModal, PartialPaymentModal, CloseAllDebtsModal)
- AddDebtPage
- DebtsSection widget (except animation fix)

**Test updates:**
- `DebtsListPage.spec.ts` — update for tree view, remove viewMode toggle tests
- `DebtDetailPage.spec.ts` — update for DebtDetailContent usage, mock useDebtTransactions

## New Components

| Component | Layer | Purpose |
|-----------|-------|---------|
| `DebtDetailContent.vue` | `entities/debt/ui/` | Shared detail view (main card + description + timeline + details + actions) |
| `DebtPaymentTimeline.vue` | `entities/debt/ui/` | Vertical payment timeline |
| `ClosedDebtCard.vue` | `entities/debt/ui/` | Closed debt card with mini-timeline |
| `useDebtTransactions.ts` | `entities/debt/api/` | Vue Query composable for debt transactions |

## Modified Components

| Component | Changes |
|-----------|---------|
| `DebtsListPage.vue` | Tree view, remove viewMode toggle, page-level grouping with currency conversion |
| `DebtDetailPage.vue` | Use DebtDetailContent, load transactions |
| `DebtDetailPanel.vue` | Use DebtDetailContent, load transactions |
| `DebtCard.vue` | Fix hardcoded color, remove `_paid`, add CurrencyBadge |
| `DebtsSection.vue` | Replace custom transitions with `listTransition` |
| `debtsApi.ts` | Remove hardcoded 'UZS', add `getDebtTransactions()`, transform new fields |
| `useDebts.ts` | Remove broken `debtsByPerson`/`totalDebt`/`totalPaid` |
| `database.types.ts` | Add `description`, `closed_at`, `forgiven_amount` to Debt type |

## Backend Changes

| File | Changes |
|------|---------|
| New migration `AddDebtMetadata` | Add `description`, `closed_at`, `forgiven_amount` columns |
| `DebtOrmEntity` | Add 3 new columns |
| `Debt` aggregate | Add properties + setters |
| `DebtMapper` | Map new fields |
| `CreateDebtDto` / `UpdateDebtDto` | Add optional new fields |
| Debt response serialization | Include new fields |
| Close-debt / partial-payment handlers | Set `closed_at` and `forgiven_amount` |
| Transactions query handler | Add optional `debtId` filter |
| Transactions controller | Accept `debtId` query param |
