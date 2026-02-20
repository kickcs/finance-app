# Page Refactoring Design

## Goal
Refactor DashboardPage, HistoryPage, ImportPage — extract logic into composables, improve FSD compliance, readability, and performance. Fix HeroAmount caret bug.

## Approach: Composables extraction
Pages become thin wiring layers (template + composable calls). No new shared modules — reuse existing shared/lib/format, shared/api/composables, entity/feature composables.

## New Files

### 1. DashboardPage (679 → ~150 lines)

**`pages/dashboard/model/useDashboardData.ts`**
- Consolidates 6 API calls: useAccounts, useDebts, useReminders, useCategories, useRecentTransactions, useMonthlyStats (current + last month)
- Derived: totalBalance, savedThisMonth, spentThisMonth, percentChange (all with currency conversion via useExchangeRates)
- Returns: all data refs + loading states

**`pages/dashboard/model/useDashboardQuickActions.ts`**
- Wraps useQuickActions + modal state (showQuickActionModal, editingAction)
- Handlers: handleClick, handleLongPress, handleSave, handleDelete
- categoryMap computed (for icon/color lookup)

### 2. HistoryPage (573 → ~120 lines)

**`pages/history/model/useHistoryFilters.ts`**
- State: activeTypeFilter, selectedAccountId, selectedCategoryId, isFiltersCollapsed
- Computed: activeFiltersCount, serverFilters (TransactionFilters), usedCategories
- Methods: handleTypeFilterChange, clearAdditionalFilters

**`pages/history/model/useBalanceAfter.ts`**
- Accepts: accounts, displayedTransactions, currency
- Heavy balanceAfterMap computed isolated here
- balanceAfterEnabled computed
- getBalanceAfter(txId) function

**`pages/history/lib/computeDayTotal.ts`**
- Pure function extracted from 40-line inline lambda in useGroupedTransactions call
- Testable independently

### 3. ImportPage (421 → ~80 lines)

**`pages/settings/import/model/useImportWizard.ts`**
- Step state machine: select → preview → result
- parseResult, importResult, parseError
- handleFileChange, handleImport, openFilePicker
- previewTransactions computed
- Replace local formatDate/formatAmount with shared/lib/format/date + currency

### 4. Bug Fix: HeroAmount caret

**`features/add-transaction/ui/HeroAmount.vue`**
- Hidden input with opacity-0 has caret on left instead of center
- Fix: add `text-center caret-color-transparent` or use contenteditable span approach
