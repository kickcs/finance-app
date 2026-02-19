# Add Transaction Refactor v2 — Design

## Goal

Refactor `features/add-transaction` to eliminate code duplication across panels, delete dead code, and redesign TransferPanel with a card-based "from → to" layout with swap button.

## Scope

### 1. Extract `usePanelState` composable

Create `model/usePanelState.ts` that extracts duplicated logic from all 3 panels:
- `selectedAccount` computed
- `availableCurrencies` computed
- `isMultiCurrency` computed
- `currencySymbol` computed
- `currentBalance` computed
- `hasSufficientFunds` computed
- `updateField()` helper
- `handleAccountChange()` — sets accountId + first currency
- `watch(selectedAccount)` — auto-corrects currency if not available on new account

All three panels call `usePanelState(props, emit)` instead of duplicating this code.

### 2. Delete dead code

- Delete `ui/AmountInput.vue` (replaced by `HeroAmount`)
- Remove `setCurrency()` and `setToAmount()` from `useTransactionForm` (unused)
- Extract `DEFAULT_FORM_DATA` constant in `useTransactionForm` to DRY the `'UZS'` default

### 3. Redesign TransferPanel

Replace horizontal chip lists with card-based layout:

```
┌─────────────────────────────┐
│       1 200 000             │  ← HeroAmount (centered)
│                             │
│  ┌───────────────────────┐  │
│  │ Откуда                │  │
│  │ 🟢 Основной счёт      │  │  ← Popover to select account
│  │ Баланс: 5 000 000     │  │
│  └───────────────────────┘  │
│            [ ⇅ ]            │  ← Swap button
│  ┌───────────────────────┐  │
│  │ Куда                  │  │
│  │ 🟡 Накопления          │  │  ← Popover to select account
│  └───────────────────────┘  │
│                             │
│  Получит: ~15.20 USD       │  ← Only when currencies differ
│  (editable amount field)    │
└─────────────────────────────┘
```

Key behaviors:
- Each card is a Popover trigger — tap to open account list
- Swap button exchanges source/target accounts
- Cross-currency: shows auto-calculated amount with editable override
- Uses `usePanelState` for source account logic
- Has its own target account state (availableTargetAccounts, targetCurrencies)
- Currency-correction watch applies to BOTH source and target (fixes existing bug)

### 4. IncomePanel — show balance

Add `currentBalance` display to IncomePanel (via `usePanelState` — it already computes it). No "insufficient funds" warning for income, just informational balance.

## Non-goals

- No changes to TransactionForm orchestrator layout
- No changes to ExpensePanel visual design
- No changes to split-expense integration
- No changes to useSubmitTransaction
