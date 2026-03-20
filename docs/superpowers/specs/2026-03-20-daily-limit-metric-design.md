# Daily Spending Limit in BalanceCard

## Problem

Users open the app to check "how much can I spend today" but have to navigate to the analytics page to find this information. The daily spending limit should be the first thing they see.

## Solution

Add a **safe daily spending limit** metric inside the existing BalanceCard widget on the dashboard. The metric shows how much the user can spend per day for the rest of the month, based on their remaining budget.

## Formula

```
dailyLimit = budget.remaining / daysRemainingInMonth
```

Where:
- `budget.remaining` = `budget.amount - spent` (from `useBudget`)
- `daysRemainingInMonth` = days from today to end of current month (inclusive of today, minimum 1)

## Conditions

- **Shown only when budget is set** — if user has no budget, the right side of the card is hidden and the card displays only the balance (left-aligned, no "Общий баланс" label)
- **No new backend endpoint** — all data already available via `useBudget` and date math on frontend

## UI Layout (Mobile — source of truth)

```
┌─────────────────────────────────────────┐
│  Баланс          │  В день              │
│  12 450 000 сўм  │  500 000 сўм         │
│                   │  осталось 11 дней    │
└─────────────────────────────────────────┘
```

### Left side
- Label: "Баланс" — small uppercase, secondary color
- Amount: total balance across all accounts — large, bold, white/primary text
- Click navigates to accounts page

### Divider
- Vertical 1px line, `rgba(255,255,255,0.08)` — only rendered when budget exists

### Right side (only with budget)
- Label: "В день" — small uppercase, green-tinted (`#4ade80` at 60% opacity)
- Amount: daily limit — medium-bold, green (`#4ade80`)
- Sub-text: "осталось N дней" — small, tertiary color

### Preserved
- Eye toggle button for hiding balances
- Animated blob background (morph keyframes)
- Rotating conic-gradient border
- Desktop: "К счетам" button on far right

### Without budget
- Card shows only balance on the left (no divider, no right side)
- Label "Баланс" replaces old "Общий баланс"
- Card is more compact than current design

## File Changes

### 1. `frontend/src/widgets/balance-card/ui/BalanceCard.vue`
- Remove "Общий баланс" label and centered layout
- New props: `dailyLimit: number | null`, `daysRemaining: number`
- Layout: flex-row with left (balance) + conditional divider + conditional right (daily limit)
- Left-align balance
- Conditionally render right side when `dailyLimit !== null`

### 2. `frontend/src/pages/dashboard/model/useDashboardData.ts`
- Import and use `useBudget` composable
- Compute `daysRemainingInMonth`: days from today to last day of month (min 1)
- Compute `dailyLimit`: `budget.remaining / daysRemainingInMonth` — null if no budget
- Expose `dailyLimit`, `daysRemaining`, `budgetLoading` in return

### 3. `frontend/src/pages/dashboard/DashboardPage.vue`
- Pass `dailyLimit` and `daysRemaining` props to BalanceCard

## Edge Cases

| Case | Behavior |
|------|----------|
| No budget set | Right side hidden, card shows balance only |
| Last day of month | `daysRemaining = 1`, shows full remaining budget |
| Budget overspent (`remaining < 0`) | Shows negative daily limit (red instead of green) |
| Budget remaining = 0 | Shows "0 сўм" in green |
| Loading state | Skeleton for both sides |

## Color Coding

- `remaining > 0`: green (#4ade80)
- `remaining <= 0`: red (#f87171) — overspent signal

## Out of Scope

- Savings account exclusion from balance calculation (keep current total balance logic)
- New backend endpoints
- Budget creation flow changes
- Period selection (always current month)
