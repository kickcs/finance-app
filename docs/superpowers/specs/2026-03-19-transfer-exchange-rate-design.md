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
const lastEditedField = ref<'rate' | 'toAmount' | 'amount'>('amount')
```

### Recalculation rules

| User action | What recalculates |
|---|---|
| Edit `amount` | `toAmount = amount * exchangeRate` |
| Edit `exchangeRate` | `toAmount = amount * exchangeRate` |
| Edit `toAmount` | `exchangeRate = toAmount / amount` |
| Change currency/account | `exchangeRate` loaded from API via `convertBetween(1, from, to)`, then `toAmount` recalculated |
| Swap button | `exchangeRate = 1 / oldRate`, `toAmount` recalculated |

### Preventing circular watchers

`lastEditedField` ref tracks which field the user last edited. The watcher checks this value before deciding what to recalculate, preventing infinite loops.

### Edge cases

- `amount === 0` — do not recalculate `exchangeRate` when `toAmount` changes (division by zero). Keep rate as-is.
- API rate unavailable — `exchangeRate` stays `null`, field shown empty, user enters manually.
- Rounding — `toAmount` rounded to 2 decimal places (`Math.round(x * 100) / 100`). `exchangeRate` displayed without rounding.

## UI Design

### Placement

New exchange rate section appears **between the target account card and the commission input**, visible only when `showConversion === true` (currencies differ).

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

- `HeroAmount` components — untouched
- Backend API — untouched
- `TransactionFormData` interface — no new fields (rate is local ref only)
- Commission section — untouched
- Submit logic in `useSubmitTransaction.ts` — untouched (sends `amount` + `toAmount` as before)

## Files to modify

1. `frontend/src/features/add-transaction/ui/TransferPanel.vue` — add state, UI section, update watcher logic
