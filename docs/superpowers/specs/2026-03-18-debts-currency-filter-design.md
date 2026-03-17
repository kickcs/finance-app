# Debts Currency Filter with FilterChips

**Date:** 2026-03-18

## Problem

The debts list page (`/debts`) has a custom currency filter on the active tab implemented with plain `<button>` elements. It does not follow the established chip pattern used in `AccountSelector` and `CategoryChips` (sliding indicator, consistent styling). The closed tab has no currency filter at all.

## Solution

### 1. New `FilterChips` component (`shared/ui/FilterChips.vue`)

A generic, reusable chip row component modelled after `AccountSelector`. Accepts a flat list of `{ id, label }` items plus an optional "all" label. Uses `useSlidingIndicator` for the animated sliding selection indicator.

**Props:**
- `items: { id: string; label: string }[]` — list of filter options
- `modelValue: string | null` — currently selected id (`null` = "all")
- `allLabel?: string` — label for the "all" option (default: `'Все'`)

**Emits:**
- `update:modelValue: string | null`

**Behaviour:**
- Renders an "all" chip followed by one chip per item.
- Horizontal scroll with `no-scrollbar`, full-bleed (`-mx-4 px-4`) like AccountSelector.
- Sliding indicator follows the selected chip with spring easing.
- Hidden when `items.length < 2` (no point filtering a single option).

### 2. `useDebtsPageState.ts` changes

- Extract `availableCurrencies` logic into a shared helper so it works for both tabs.
- Add `closedDebts` currency filtering: `availableClosedCurrencies` computed + apply `currencyFilter` to closed debts.
- `currencyFilter` already resets on `statusFilter` change — no change needed.

### 3. `DebtsListPage.vue` changes

- Replace the existing custom `<button>` chip block on the active tab with `<FilterChips>`.
- Add `<FilterChips>` before the closed debts list (shown when `availableClosedCurrencies.length > 1`).

### 4. Export

Export `FilterChips` from `shared/ui/index.ts`.

## Files to Create/Modify

| File | Change |
|------|--------|
| `frontend/src/shared/ui/FilterChips.vue` | Create |
| `frontend/src/shared/ui/index.ts` | Add export |
| `frontend/src/pages/debts/list/useDebtsPageState.ts` | Add closed currency filter |
| `frontend/src/pages/debts/list/DebtsListPage.vue` | Replace chips, add to closed tab |

## Out of Scope

- Filtering on the detail panel
- Persisting filter selection across navigation
- Filter chips on any page other than debts
