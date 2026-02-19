# Redesign: AddTransactionPage UI/UX

## Summary

Full redesign of the Add Transaction page with hero-style amount input and chip-based category selection. Single-screen layout without scrolling.

## Layout

Fixed `h-dvh flex flex-col` layout:

1. **AppHeader** — unchanged (back button + title)
2. **UTabs** — unchanged (Expense/Income/Transfer with swipe)
3. **HeroAmount** — large centered amount (text-3xl/4xl), hidden `<input type="number">`, tap-to-focus with system keyboard, currency badge, balance subtitle
4. **AccountSelector** — horizontal chip scroll (unchanged logic, visual polish)
5. **CategoryChips** — 2-row horizontal scroll of `[icon + full name]` chips replacing the 4-column grid of CategoryCards
6. **Bottom section** — description + date inputs, hashtag suggestions, full-width submit button

## Key Changes

### HeroAmount (replaces AmountInput)
- Large centered number (text-3xl or text-4xl, font-semibold)
- Hidden input element, visually shows formatted number
- Tap anywhere on amount area to focus the hidden input → system numeric keyboard appears
- Currency shown as small badge next to amount (selectable if multi-currency account)
- Below amount: current balance in muted text + insufficient funds warning
- Digit transition animation (scale/opacity)

### CategoryChips (replaces CategoryCard grid)
- Horizontal scrollable container with 2 rows
- Each chip: `[icon] [full name]` — no truncation
- Selected state: colored border + tinted background (using category color)
- `whitespace-nowrap` per chip, `flex-nowrap` per row
- CSS grid with 2 fixed rows and auto columns, or two flex rows

### Layout
- `h-dvh flex flex-col overflow-hidden` on page container
- Category section gets `flex-1` or fixed height
- Submit button area is sticky at bottom with padding

## Unchanged
- Swipe between transaction types (CYCLIC_PANEL_ORDER)
- Split expense section and logic
- TransferPanel (from/to accounts with currency conversion)
- Hashtag suggestions
- Business logic (useTransactionForm, useSubmitTransaction)
- AccountSelector component logic

## Scope
- Modify: `TransactionForm.vue`, `ExpensePanel.vue`, `IncomePanel.vue`, `AmountInput.vue`, `AddTransactionPage.vue`
- New: `HeroAmount.vue` component, `CategoryChips.vue` component
- Keep: `AccountSelector.vue`, `TransferPanel.vue`, `SplitExpenseSection.vue`
