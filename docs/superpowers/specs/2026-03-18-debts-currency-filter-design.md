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
- `allLabel?: string` — label for the "all" option (default: `'Все валюты'`)

**Emits:**
- `update:modelValue: string | null`

**Behaviour:**
- Renders an "all" chip followed by one chip per item.
- The "all" chip uses the internal sentinel id `'__all__'` so that `useSlidingIndicator` can track it. Internally the component maps `modelValue === null` → `'__all__'` and emits `null` when the "all" chip is clicked.
- Horizontal scroll with `no-scrollbar`, full-bleed (`-mx-4 px-4`) like AccountSelector.
- Sliding indicator follows the selected chip with spring easing.
- The component does **not** hide itself — the caller controls visibility with `v-if`.

### 2. `useDebtsPageState.ts` changes

- Add `availableClosedCurrencies` computed: `Array.from(new Set(allClosedDebts.map(d => d.currency))).sort()` where `allClosedDebts` is the unfiltered closed list.
- Apply `currencyFilter` to closed debts: `closedDebts` becomes `allClosedDebts.filter(d => !currencyFilter.value || d.currency === currencyFilter.value)`.
- Both tabs **share the single `currencyFilter` ref**. The existing `watch(statusFilter, () => { currencyFilter.value = null })` already resets it on tab switch — no new ref needed.
- Add `availableClosedCurrencies` to the composable's `return {}` so the template can reference it.

### 3. `DebtsListPage.vue` changes

- Replace the existing `v-if="availableCurrencies.length > 1"` block with `<FilterChips v-if="availableCurrencies.length > 1" :items="..." v-model="currencyFilter" />`.
- Add `<FilterChips v-if="availableClosedCurrencies.length > 1" :items="..." v-model="currencyFilter" />` before the closed debts list. The `allLabel` default (`'Все валюты'`) is used; no need to pass it explicitly.

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
