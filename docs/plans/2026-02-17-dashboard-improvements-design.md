# Dashboard Improvements Design

## Summary

Three improvements to the DashboardPage:
1. Personalized greeting in the header
2. Quick Actions grid (new widget)
3. Recent Transactions section (new widget)

## 1. Personalized Greeting

Replace "Ouro" logo text with time-based greeting + user's first name.

- Morning (5-11): «Доброе утро, Имя»
- Day (12-16): «Добрый день, Имя»
- Evening (17-22): «Добрый вечер, Имя»
- Night (23-4): «Доброй ночи, Имя»

Keep the gradient "O" avatar icon. Name from `profile.value?.name`. Fallback: just greeting without name.

## 2. Quick Actions Grid

2x2 grid of compact action cards placed between SaveSpendSection and AccountStack.

Actions:
- **Перевод** — icon: `arrow_range`, navigates to `/transactions/new?type=transfer`
- **Разделить** — icon: `call_split`, navigates to `/transactions/new?split=true`
- **Курсы** — icon: `currency_exchange`, navigates to `/exchange-rates`
- **Категории** — icon: `category`, navigates to `/categories`

Style: rounded cards with icon + label, matching existing design tokens. `bg-surface-light dark:bg-surface-dark`, compact padding.

## 3. Recent Transactions

Section between AccountStack and DebtsSection showing last 5 transactions.

- Header: «Последние операции» + count badge + «Все >» button → `/history`
- Uses existing `transactionsApi.getAll(userId, 5)` endpoint
- Compact transaction rows: icon (category), name, date, amount (colored by type)
- Lazy loaded via `defineAsyncComponent` with skeleton fallback
- Respects `isHidden` toggle for amounts
- Empty state: «Нет операций» + CTA button

## Updated Dashboard Section Order

1. AppHeader — greeting + ThemeToggle
2. BalanceCard — unchanged
3. SaveSpendSection — unchanged
4. **Quick Actions** — NEW
5. AccountStack — unchanged
6. **Recent Transactions** — NEW
7. DebtsSection — unchanged
8. RemindersSection — unchanged
