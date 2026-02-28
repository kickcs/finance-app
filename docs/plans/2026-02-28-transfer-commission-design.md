# Transfer Commission Design

## Problem

Users need to record commission/fees when transferring between accounts (e.g., bank transfer fees, currency conversion markups). Currently transfers have no fee support.

## Approach

Commission creates a **separate expense transaction** linked to the transfer. No new DB columns needed.

## Data Model

When saving a transfer with commission, backend creates **2 transactions atomically**:

1. **Transfer** — as today (`type: 'transfer'`, category `transfer`)
2. **Expense** — `type: 'expense'`, category `commission`, same `accountId` (source), same date, description `"Комиссия за перевод"`

### System Category

New `COMMISSION_CATEGORY`:
- `id: 'commission'`, `name: 'Комиссия'`, `icon: 'receipt_long'`, `color: '#ef4444'`, `type: 'expense'`
- Added to `CATEGORY_IDS.COMMISSION`, `ALL_CATEGORIES`, `getCategoryById`
- Excluded from user category management (like transfer/debt categories)

## API Changes

Extend `CreateTransactionCommand` with optional fields:
- `feeAmount?: number` — fee amount (always in source currency)
- `feeType?: 'fixed' | 'percent'` — for frontend display only; backend always receives calculated amount

Handler logic when `type === 'transfer'` and `feeAmount > 0`:
1. Create transfer as usual
2. Create expense transaction with `categoryId: 'commission'`
3. Debit `feeAmount` from source account balance
4. All within single DB transaction

## UI (TransferPanel)

Optional commission row appears **after target account is selected**, before "Сумма зачисления":

```
┌─────────────────────────────────────┐
│  [Откуда: Тинькофф]    1 000 ₽     │
│            ⇅                        │
│  [Куда: Сбер]            950 ₽     │
│                                     │
│  ┌─ Комиссия ─────────────────────┐ │
│  │  [  50 ] [₽ ▾] [% | ₽]       │ │
│  └────────────────────────────────┘ │
│                                     │
│         Сумма зачисления            │
│              950                    │
│                                     │
│  [Комментарий]        [15 фев]     │
│       [ Перевести ]                 │
└─────────────────────────────────────┘
```

- Toggle `% | ₽` switches between percentage and fixed amount
- Currency = source account currency
- If fee is 0 or empty — no expense transaction created
- Fee included in insufficient funds validation (amount + fee <= balance)

## Scope

- No new DB migrations
- No changes to transaction list display (commission shows as regular expense)
- Commission automatically appears in expense analytics
