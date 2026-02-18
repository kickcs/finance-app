# Balance After Transaction — Design

**Date:** 2026-02-18
**Status:** Approved

## Problem

The history page shows transaction amounts but gives no visibility into the resulting account balance. Users can't tell at a glance what their balance was at any point in the past.

## Solution

Display the account balance after each transaction directly in the transaction item, below the amount. For transfers, show the source account balance after the transfer.

## Approach: Frontend Calculation (no backend changes)

Use the current account balances (already in Vue Query cache via `useAccounts()`) and walk backwards through the displayed transactions to reconstruct the running balance at each point.

**Why:** Approximate accuracy is acceptable; no backend changes needed; data is already available client-side.

## Algorithm

```
Initialize: running[accountId] = account.balance  (for each account)

For each tx in displayedTransactions (newest → oldest):
  balanceAfterMap[tx.id] = running[tx.account_id]   // record

  // Undo the effect to step backwards in time:
  income:   running[account_id] -= amount
  expense:  running[account_id] += amount
  transfer: running[account_id] += amount            // undo outflow
            running[to_account_id] -= (to_amount ?? amount)  // undo inflow
```

## Display

```
-5 000 ₽         ← existing amount (colored)
= 45 230 ₽       ← new balance_after (text-[10px], text-tertiary)
```

Currency: uses `transaction.currency` (source account's currency for transfers).

## Files Changed

1. `TransactionItem.vue` — add `balanceAfter?: number` prop, render below amount
2. `VirtualGroupedTransactionList.vue` — add `getBalanceAfter` prop, pass to items, dynamic `TRANSACTION_HEIGHT` (72 → 84 when `getBalanceAfter` is provided)
3. `HistoryPage.vue` — add `balanceAfterMap` computed + `getBalanceAfter` function, pass to list
