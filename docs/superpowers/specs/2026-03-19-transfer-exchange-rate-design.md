# Transfer Exchange Rate Editing — Design Spec

## Overview

Add a visible, editable exchange rate field to the transfer tab on the Add Transaction page. When transferring between accounts with different currencies, the user sees the API exchange rate by default and can override it manually. Bidirectional sync: editing the rate recalculates `toAmount`, editing `toAmount` recalculates the rate.

## Scope

- **Frontend only** — no backend changes
- **Single file** — `TransferPanel.vue` (local state, UI, logic)
- Exchange rate is NOT persisted to the database — it's a derived/local value

## State Design

### New local refs in `TransferPanel.vue`

```typescript
const exchangeRate = ref<number | null>(null)       // 1 sourceCurrency = X targetCurrency
const isUserEditingRate = ref(false)                 // true while user is editing rate or toAmount
```

### Recalculation rules

| User action | What recalculates |
|---|---|
| Edit `amount` | `toAmount = amount * exchangeRate` (uses stored rate, NOT API) |
| Edit `exchangeRate` | `toAmount = amount * exchangeRate`, set `isUserEditingRate = true` |
| Edit `toAmount` | `exchangeRate = toAmount / amount` (only if `amount > 0`), set `isUserEditingRate = true` |
| Change currency/account | `exchangeRate` loaded from API via `convertBetween(1, from, to)`, then `toAmount` recalculated. Reset `isUserEditingRate = false` |
| Swap button | `exchangeRate` loaded from API via `convertBetween(1, newSource, newTarget)`, then `toAmount` recalculated. Reset `isUserEditingRate = false` |

### Preventing circular watchers

Replace the existing watcher (lines 256-268) with explicit handler functions — no watchers for recalculation.

**Approach:** Each input handler (`handleAmountChange`, `handleRateChange`, `handleTargetAmountChange`) directly computes and emits the derived values. No watcher is needed because every change goes through an explicit handler.

- `handleAmountChange(newAmount)` — sets `amount`, computes `toAmount = newAmount * exchangeRate`, emits both
- `handleRateChange(newRate)` — sets `exchangeRate`, computes `toAmount = amount * newRate`, emits `toAmount`
- `handleTargetAmountChange(newToAmount)` — sets `toAmount`, computes `exchangeRate = newToAmount / amount` (guard: `amount > 0`), emits `toAmount`

The existing `skipWatcherRecalc` flag and the watcher on `[amount, currency, toCurrency]` are **removed**. The parent's `amount` changes already flow through `HeroAmount`'s `@update:amount` → `handleAmountChange`, so a watcher is not needed.

Currency/account change handlers (`handleSourceSelect`, `handleTargetSelect`, `handleSourceCurrencyChange`, `handleToCurrencyChange`, `handleSwap`) load the rate from API and compute `toAmount` directly — same as today but using `exchangeRate` ref as the intermediate.

### Loading rate from API

`convertBetween(1, fromCurrency, toCurrency)` returns `1` when rates are not yet loaded (it returns `amount` unchanged). To detect this, check `rates.value` from `useExchangeRates` — if `rates.value` is null/undefined, set `exchangeRate = null` (field shown empty). Otherwise set `exchangeRate = convertBetween(1, from, to)`.

### Edge cases

- `amount === 0` — do not recalculate `exchangeRate` when `toAmount` changes (division by zero). Keep rate as-is.
- `exchangeRate <= 0` or `null` — do not recalculate `toAmount`. Show field empty, user must enter a valid rate.
- API rate unavailable (`rates.value` is null) — `exchangeRate` stays `null`, field shown empty, user enters manually.
- Rounding — `toAmount` rounded to 2 decimal places (`Math.round(x * 100) / 100`). `exchangeRate` displayed without rounding.

## UI Design

### Template layout order

The full template structure when `showConversion` is true:

1. `HeroAmount` — source amount (existing, untouched)
2. `<div class="relative">` — source card, swap button, target card (existing, untouched)
3. **Exchange rate section** (NEW) — inside the relative div, after target card, before commission
4. Commission section (existing, untouched)
5. `HeroAmount` — target amount / `toAmount` (existing, untouched)

The exchange rate section is placed **inside** the `<div class="relative">` block, after the target account `Popover` and before the commission `Transition`. It shares the same `v-if` condition: visible when `showConversion` is true.

### Visual design

Same styling as the existing commission row (`rounded-xl bg-surface-light/50 dark:bg-surface-dark/50 border border-border-light dark:border-border-dark`):

```
┌─────────────────────────────────────────────┐
│ 🔄  Курс обмена      [ 12 750.00 ]    UZS  │
│                       1 USD = ...            │
└─────────────────────────────────────────────┘
```

**Elements:**
- `currency_exchange` icon (left)
- Label "Курс обмена"
- Number input (`inputmode="decimal"`) — bound to `exchangeRate`
- Currency suffix — `toCurrency`
- Subtitle line: `1 {sourceCurrency} = {formattedRate} {targetCurrency}`

### Animation

Same `Transition name="fee"` as the commission block.

### Interaction

- On focus: standard input selection, user can clear and type custom rate
- On input: `toAmount` recalculates in real-time
- Field appears/disappears with same animation as commission

## What does NOT change

- `HeroAmount` components — both remain untouched (source amount and target `toAmount`)
- Backend API — untouched
- `TransactionFormData` interface — no new fields (rate is local ref only)
- Commission section — untouched
- Submit logic in `useSubmitTransaction.ts` — untouched (sends `amount` + `toAmount` as before)

## What changes in existing code

- The watcher on `[amount, currency, toCurrency]` (lines 256-268) is **removed**
- The `skipWatcherRecalc` flag is **removed**
- `calculateConvertedAmount()` still exists but is only used internally by currency/account change handlers to seed `exchangeRate`
- All handlers that currently call `calculateConvertedAmount` directly are updated to go through `exchangeRate` ref

## Files to modify

1. `frontend/src/features/add-transaction/ui/TransferPanel.vue` — add state, UI section, replace watcher with explicit handlers
