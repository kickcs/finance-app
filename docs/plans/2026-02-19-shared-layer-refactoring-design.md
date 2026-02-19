# Shared Layer Refactoring Design

**Date:** 2026-02-19
**Scope:** Extract reusable elements from pages/entities/widgets/features into shared layer (FSD)

## UI Components (shared/ui)

### 1. USpinner
- Path: `shared/ui/spinner/USpinner.vue`
- Props: `size: 'sm' | 'md' | 'lg'` (default `md`)
- Replaces: inline spinner in 5 files (AccountDetailPage, DebtDetailPage, ReminderDetailPage, AddDebtPage, App.vue)

### 2. ConfirmDeleteModal
- Path: `shared/ui/confirm-delete-modal/ConfirmDeleteModal.vue`
- Props: `modelValue`, `title`, `warningText`, `isDeleting`, `entityName`, `entityIcon`
- Slot: `#entity-info` for custom entity info block
- Replaces: 4 modals (DeleteAccountModal, DeleteDebtModal, DeleteTransactionModal, DeleteReminderModal)

### 3. NotFoundState
- Path: `shared/ui/not-found-state/NotFoundState.vue`
- Props: `message`, `icon`, `actionLabel`, `actionRoute`
- Replaces: inline "not found" blocks in 3 detail pages

### 4. Remove ColorPicker/IconSelector wrappers
- Delete `features/create-account/ui/ColorPicker.vue`, `features/create-reminder/ui/ColorPicker.vue`
- Delete `features/create-account/ui/IconSelector.vue`, `features/create-reminder/ui/IconSelector.vue`
- Consumers use `UColorPicker`/`UIconSelector` directly with `:colors`/`:icons` props

### 5. Migrate detail/add pages to AppHeader
- 7 pages with inline sticky header → `AppHeader` with `show-back` and `title` props
- May require extending AppHeader to support these props

## Composables (shared/lib/hooks)

### 6. useAsyncOperation
- Path: `shared/lib/hooks/useAsyncOperation.ts`
- API: `useAsyncOperation(fn)` → `{ isLoading, error, execute }`
- Replaces: repeated `isUpdating/isDeleting + try/catch/finally` pattern in 4 useEdit* composables

### 7. useUserCurrency upgrade
- Path: `shared/lib/hooks/useUserCurrency.ts` (update existing)
- Logic: `profile.currency` → `localStorage` → `'UZS'` fallback
- Replaces: 3 different currency resolution patterns across 10 files

### 8. useGroupedTransactions
- Path: `entities/transaction/model/useGroupedTransactions.ts`
- API: `useGroupedTransactions(transactions, options?)` → `computed<TransactionGroup[]>`
- Replaces: inline computed in HistoryPage and AccountDetailPage

### 9. useTransactionSelection
- Path: `features/edit-transaction/model/useTransactionSelection.ts`
- API: `useTransactionSelection(userId)` → `{ selectedTransaction, hasSplitDebts, handleClick, showEditModal }`
- Replaces: identical code in HistoryPage and AccountDetailPage

## Utilities & Constants

### 10. formatLocalDate
- Add `formatLocalDate(dateStr)` to `shared/lib/format/date.ts`
- Remove local `formatDate` in ChangelogPage.vue and ChangelogModal.vue

### 11. ENTITY_COLORS in shared
- Path: `shared/config/colors.ts`
- Export `ENTITY_COLORS` (formerly `ACCOUNT_COLORS`) — shared palette for accounts, reminders, etc.
- Removes cross-entity dependency (reminder → account)

### 12. Fix raw design token
- `RemindersListPage.vue`: `text-blue-500` → semantic token

### 13. Migrate to EmptyState
- 3 pages (AccountsPage, DebtsListPage, RemindersListPage) → use `EmptyState` from `shared/ui`

### 14. Changelog components
- Extract `ChangelogEntryItem` and `VersionBadge` into `features/changelog/ui/` (not shared — only used in changelog)

## Summary

| # | What | Where | Files affected |
|---|------|-------|---------------|
| 1 | USpinner | shared/ui/spinner/ | 5 |
| 2 | ConfirmDeleteModal | shared/ui/confirm-delete-modal/ | 4 |
| 3 | NotFoundState | shared/ui/not-found-state/ | 3 |
| 4 | Remove ColorPicker/IconSelector wrappers | features/ | 6 |
| 5 | Migrate to AppHeader | pages/ | 7 |
| 6 | useAsyncOperation | shared/lib/hooks/ | 4 |
| 7 | useUserCurrency upgrade | shared/lib/hooks/ | 10 |
| 8 | useGroupedTransactions | entities/transaction/ | 2 |
| 9 | useTransactionSelection | features/edit-transaction/ | 2 |
| 10 | formatLocalDate | shared/lib/format/ | 2 |
| 11 | ENTITY_COLORS | shared/config/ | 3 |
| 12 | Fix text-blue-500 | pages/reminders | 1 |
| 13 | Migrate to EmptyState | pages/ | 3 |
| 14 | Changelog components | features/changelog/ | 2 |
