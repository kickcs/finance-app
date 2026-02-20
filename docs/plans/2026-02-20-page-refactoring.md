# Page Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract business logic from DashboardPage, HistoryPage, ImportPage into composables; fix HeroAmount caret bug.

**Architecture:** Each page gets model/ composables that encapsulate state + computed + handlers. Pages become thin template + wiring. No new shared modules — reuse existing shared/lib/format, entity/feature composables.

**Tech Stack:** Vue 3 Composition API, TypeScript

---

### Task 1: Create `useDashboardData` composable

**Files:**
- Create: `frontend/src/pages/dashboard/model/useDashboardData.ts`

**Step 1: Create the composable**

```typescript
import { computed } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { toValue } from 'vue';
import { useAccounts } from '@/entities/account';
import { useMonthlyStats, useRecentTransactions } from '@/entities/transaction';
import { useDebts } from '@/entities/debt';
import { useReminders } from '@/entities/reminder';
import { useCategories } from '@/entities/category';
import { useProfile, useExchangeRates } from '@/shared/api';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';

export function useDashboardData() {
  const { user, userId } = useCurrentUser();
  const { currency } = useUserCurrency();
  const { profile } = useProfile(userId);
  const { convert, isLoading: ratesLoading } = useExchangeRates(currency);

  const {
    accounts,
    totalBalancesByCurrency,
    isLoading: accountsLoading,
  } = useAccounts(userId);
  const { debts, isLoading: debtsLoading } = useDebts(userId);
  const { reminders, isLoading: remindersLoading } = useReminders(userId);
  const { expenseCategories, allCategories } = useCategories(userId);
  const { transactions: recentTransactions, isLoading: recentTxLoading } =
    useRecentTransactions(userId, 5);

  // Monthly statistics
  const now = new Date();
  const {
    incomeByCurrency,
    expenseByCurrency,
    isLoading: statsLoading,
  } = useMonthlyStats(userId, {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  // Last month stats for percent change
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const {
    incomeByCurrency: lastMonthIncomeByCurrency,
    expenseByCurrency: lastMonthExpenseByCurrency,
  } = useMonthlyStats(userId, {
    year: lastMonth.getFullYear(),
    month: lastMonth.getMonth() + 1,
  });

  // Greeting
  const greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Доброе утро';
    if (hour >= 12 && hour < 17) return 'Добрый день';
    if (hour >= 17 && hour < 23) return 'Добрый вечер';
    return 'Доброй ночи';
  });

  const userName = computed(() => {
    const fullName = profile.value?.name || user?.value?.name;
    if (!fullName) return '';
    return fullName.split(' ')[0];
  });

  // Derived totals with currency conversion
  const totalBalance = computed(() => {
    let total = 0;
    for (const [curr, amount] of Object.entries(totalBalancesByCurrency.value)) {
      total += convert(amount, curr);
    }
    return total;
  });

  const savedThisMonth = computed(() => {
    let total = 0;
    for (const [curr, amount] of Object.entries(incomeByCurrency.value)) {
      total += convert(amount, curr);
    }
    return total;
  });

  const spentThisMonth = computed(() => {
    let total = 0;
    for (const [curr, amount] of Object.entries(expenseByCurrency.value)) {
      total += convert(amount, curr);
    }
    return total;
  });

  const percentChange = computed(() => {
    let thisMonthIncome = 0;
    for (const [curr, amount] of Object.entries(incomeByCurrency.value)) {
      thisMonthIncome += convert(amount, curr);
    }
    let thisMonthExpense = 0;
    for (const [curr, amount] of Object.entries(expenseByCurrency.value)) {
      thisMonthExpense += convert(amount, curr);
    }

    let lastIncome = 0;
    for (const [curr, amount] of Object.entries(lastMonthIncomeByCurrency.value)) {
      lastIncome += convert(amount, curr);
    }
    let lastExpense = 0;
    for (const [curr, amount] of Object.entries(lastMonthExpenseByCurrency.value)) {
      lastExpense += convert(amount, curr);
    }

    if (lastIncome === 0 && lastExpense === 0) return undefined;

    const thisMonthSavings = thisMonthIncome - thisMonthExpense;
    const lastMonthSavings = lastIncome - lastExpense;

    if (lastMonthSavings === 0) {
      return thisMonthSavings > 0 ? 100 : thisMonthSavings < 0 ? -100 : 0;
    }

    return (
      ((thisMonthSavings - lastMonthSavings) / Math.abs(lastMonthSavings)) * 100
    );
  });

  return {
    // Auth
    user,
    userId,
    currency,
    greeting,
    userName,
    // Data
    accounts,
    debts,
    reminders,
    expenseCategories,
    allCategories,
    recentTransactions,
    // Derived
    totalBalance,
    savedThisMonth,
    spentThisMonth,
    percentChange,
    // Loading
    accountsLoading,
    debtsLoading,
    remindersLoading,
    recentTxLoading,
    statsLoading,
    ratesLoading,
  };
}
```

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS (composable not yet wired, just compiles)

**Step 3: Commit**

```bash
git add frontend/src/pages/dashboard/model/useDashboardData.ts
git commit -m "refactor(dashboard): extract useDashboardData composable"
```

---

### Task 2: Create `useDashboardQuickActions` composable

**Files:**
- Create: `frontend/src/pages/dashboard/model/useDashboardQuickActions.ts`

**Step 1: Create the composable**

```typescript
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  useQuickActions,
  type QuickAction,
} from '@/features/configure-quick-action';

export function useDashboardQuickActions(
  categoryMap: () => Map<string, { icon: string; color: string }>,
) {
  const router = useRouter();

  const {
    slots: quickActionSlots,
    addAction,
    updateAction,
    removeAction,
    hidden: quickActionsHidden,
  } = useQuickActions();

  const showQuickActionModal = ref(false);
  const editingAction = ref<QuickAction | null>(null);

  function handleClick(action: QuickAction | null) {
    if (!action) {
      editingAction.value = null;
      showQuickActionModal.value = true;
      return;
    }
    router.push(
      `/transactions/new?type=expense&categoryId=${action.categoryId}&accountId=${action.accountId}`,
    );
  }

  function handleLongPress(action: QuickAction | null) {
    if (!action) {
      editingAction.value = null;
      showQuickActionModal.value = true;
      return;
    }
    editingAction.value = action;
    showQuickActionModal.value = true;
  }

  function handleSave(data: {
    label: string;
    categoryId: string;
    accountId: string;
  }) {
    if (editingAction.value) {
      updateAction(editingAction.value.id, data);
    } else {
      addAction(data);
    }
    editingAction.value = null;
  }

  function handleDelete() {
    if (editingAction.value) {
      removeAction(editingAction.value.id);
    }
    editingAction.value = null;
  }

  return {
    quickActionSlots,
    quickActionsHidden,
    showQuickActionModal,
    editingAction,
    handleClick,
    handleLongPress,
    handleSave,
    handleDelete,
  };
}
```

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/pages/dashboard/model/useDashboardQuickActions.ts
git commit -m "refactor(dashboard): extract useDashboardQuickActions composable"
```

---

### Task 3: Wire composables into DashboardPage

**Files:**
- Modify: `frontend/src/pages/dashboard/DashboardPage.vue`

**Step 1: Replace script setup**

Replace the entire `<script setup>` section. Keep all template unchanged. The new script:

1. Import `useDashboardData` and `useDashboardQuickActions`
2. Import only: `ref, computed, onMounted` from vue, `useRouter`, `useLocalStorage`, `queryClient`, `PullToRefresh`, `UIcon`, `formatMasked`, `COMPACT_FORMAT`
3. Import UI components (AppHeader, BottomNav, ThemeToggle, InstallPwa*, lazy widgets — unchanged)
4. Import types only: `AccountWithBalances`, `Transaction`, `Debt`, `Reminder`
5. Destructure from composables
6. Keep: `isHidden`, `quickActionsHintDismissed`, scroll logic, `isMounted`, `handleRefresh`, navigation handlers
7. Remove: all API calls, all derived computed, quick action handlers, `categoryMap`

The `categoryMap` should be computed locally and passed to `useDashboardQuickActions`:

```typescript
const categoryMap = computed(() => {
  const map = new Map<string, { icon: string; color: string }>();
  for (const cat of allCategories.value) {
    map.set(cat.id, { icon: cat.icon, color: cat.color });
  }
  return map;
});
```

Navigation handlers stay inline in the component since they're simple `router.push` calls.

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

**Step 3: Verify dev server renders correctly**

Run: `cd frontend && bun run dev`
Open the dashboard, check all sections render.

**Step 4: Commit**

```bash
git add frontend/src/pages/dashboard/DashboardPage.vue
git commit -m "refactor(dashboard): wire useDashboardData and useDashboardQuickActions"
```

---

### Task 4: Create `useHistoryFilters` composable

**Files:**
- Create: `frontend/src/pages/history/model/useHistoryFilters.ts`

**Step 1: Create the composable**

```typescript
import { ref, computed, type MaybeRefOrGetter, toValue } from 'vue';
import {
  ALL_CATEGORIES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  DEBT_CATEGORIES,
  TRANSFER_CATEGORY,
  useCategories,
} from '@/entities/category';
import type { TransactionFilters } from '@/entities/transaction';

export type TypeFilter = 'all' | 'income' | 'expense' | 'transfer' | 'debt';

export const TYPE_FILTER_ITEMS = [
  { id: 'all', label: 'Все' },
  { id: 'expense', label: 'Расходы' },
  { id: 'income', label: 'Доходы' },
  { id: 'transfer', label: 'Переводы' },
  { id: 'debt', label: 'Долги' },
];

export function useHistoryFilters(userId: MaybeRefOrGetter<string | null>) {
  const activeTypeFilter = ref<TypeFilter>('all');
  const selectedAccountId = ref<string | null>(null);
  const selectedCategoryId = ref<string | null>(null);
  const isFiltersCollapsed = ref(false);

  const activeFiltersCount = computed(() => {
    let count = 0;
    if (selectedAccountId.value) count++;
    if (selectedCategoryId.value) count++;
    return count;
  });

  const serverFilters = computed<TransactionFilters>(() => ({
    type: activeTypeFilter.value !== 'all' ? activeTypeFilter.value : undefined,
    accountId: selectedAccountId.value ?? undefined,
    categoryId: selectedCategoryId.value ?? undefined,
  }));

  function handleTypeFilterChange(val: string) {
    activeTypeFilter.value = val as TypeFilter;
    selectedCategoryId.value = null;
  }

  function clearAdditionalFilters() {
    selectedAccountId.value = null;
    selectedCategoryId.value = null;
  }

  function resetAll() {
    activeTypeFilter.value = 'all';
    clearAdditionalFilters();
  }

  // User categories from API + fallback to static
  const {
    allCategories: userCategories,
    expenseCategories: userExpenseCategories,
    incomeCategories: userIncomeCategories,
    isLoading: isLoadingCategories,
  } = useCategories(userId);

  const usedCategories = computed(() => {
    const uid = toValue(userId);
    const useDefaults =
      isLoadingCategories.value || (!uid && userCategories.value.length === 0);

    switch (activeTypeFilter.value) {
      case 'expense':
        return useDefaults ? EXPENSE_CATEGORIES : userExpenseCategories.value;
      case 'income':
        return useDefaults ? INCOME_CATEGORIES : userIncomeCategories.value;
      case 'debt':
        return DEBT_CATEGORIES;
      case 'transfer':
        return [TRANSFER_CATEGORY];
      case 'all':
      default:
        return useDefaults ? ALL_CATEGORIES : userCategories.value;
    }
  });

  return {
    activeTypeFilter,
    selectedAccountId,
    selectedCategoryId,
    isFiltersCollapsed,
    activeFiltersCount,
    serverFilters,
    usedCategories,
    handleTypeFilterChange,
    clearAdditionalFilters,
    resetAll,
  };
}
```

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/pages/history/model/useHistoryFilters.ts
git commit -m "refactor(history): extract useHistoryFilters composable"
```

---

### Task 5: Create `computeDayTotal` utility

**Files:**
- Create: `frontend/src/pages/history/lib/computeDayTotal.ts`

**Step 1: Create the utility**

Extract the 40-line `computeTotal` lambda from HistoryPage into a pure, testable function:

```typescript
import type { Transaction } from '@/entities/transaction';

/**
 * Compute the daily total for a group of transactions.
 *
 * Handles debt transactions, net_amount for partial returns,
 * currency conversion, and transfer exclusion.
 *
 * @param txs - transactions in the group
 * @param userCurrency - user's main currency code
 * @param convert - currency conversion function (amount, fromCurrency) => convertedAmount
 */
export function computeDayTotal(
  txs: Transaction[],
  userCurrency: string,
  convert: (amount: number, from: string) => number,
): number {
  return txs.reduce((sum, tx) => {
    // Exclude debt-related transactions EXCEPT debt_given/debt_taken and returns
    const isDebtGivenOrTaken =
      tx.category_id === 'debt_given' || tx.category_id === 'debt_taken';
    const isDebtReturn =
      tx.category_id === 'debt_return_to_me' ||
      tx.category_id === 'debt_return_from_me';
    if (tx.is_debt_related && !isDebtGivenOrTaken && !isDebtReturn) return sum;

    // For expenses, use net_amount (accounts for partial debt returns)
    const baseAmount =
      tx.type === 'expense' && tx.net_amount !== undefined
        ? tx.net_amount
        : tx.amount;

    // Convert to base currency if different
    const amount =
      tx.currency !== userCurrency ? convert(baseAmount, tx.currency) : baseAmount;

    // Debt operations: explicit handling by category_id
    if (tx.category_id === 'debt_given') return sum - amount;
    if (tx.category_id === 'debt_taken') return sum + amount;

    // Debt returns: don't count in daily total (already reflected in net_amount)
    if (
      tx.category_id === 'debt_return_to_me' ||
      tx.category_id === 'debt_return_from_me'
    ) {
      return sum;
    }

    if (tx.type === 'transfer') return sum;
    return sum + (tx.type === 'income' ? amount : -amount);
  }, 0);
}
```

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/pages/history/lib/computeDayTotal.ts
git commit -m "refactor(history): extract computeDayTotal pure function"
```

---

### Task 6: Create `useBalanceAfter` composable

**Files:**
- Create: `frontend/src/pages/history/model/useBalanceAfter.ts`

**Step 1: Create the composable**

```typescript
import { computed, type ComputedRef, type Ref } from 'vue';
import type { AccountWithBalances } from '@/entities/account';
import type { Transaction } from '@/entities/transaction';

/**
 * Computes balance_after for each transaction by walking backwards
 * from current account balances.
 *
 * Only meaningful when no filters are active (full transaction set).
 */
export function useBalanceAfter(
  accounts: Ref<AccountWithBalances[]> | ComputedRef<AccountWithBalances[]>,
  displayedTransactions: ComputedRef<Transaction[]>,
  currency: ComputedRef<string>,
  isFilterActive: ComputedRef<boolean>,
) {
  const balanceAfterMap = computed(() => {
    const map = new Map<string, number>();
    const running = new Map<string, number>();

    for (const acc of accounts.value) {
      for (const b of acc.balances) {
        running.set(`${acc.id}_${b.currency}`, b.balance);
      }
    }

    for (const tx of displayedTransactions.value) {
      const txCurrency = tx.currency || currency.value;
      const srcKey = `${tx.account_id}_${txCurrency}`;
      const current = running.get(srcKey);
      if (current !== undefined) {
        map.set(tx.id, current);
        if (tx.type === 'income') {
          running.set(srcKey, current - tx.amount);
        } else if (tx.type === 'expense') {
          running.set(srcKey, current + tx.amount);
        } else if (tx.type === 'transfer') {
          running.set(srcKey, current + tx.amount);
          if (tx.to_account_id) {
            const toCurrency = tx.to_currency || txCurrency;
            const destKey = `${tx.to_account_id}_${toCurrency}`;
            const dest = running.get(destKey);
            if (dest !== undefined) {
              running.set(destKey, dest - (tx.to_amount ?? tx.amount));
            }
          }
        }
      }
    }

    return map;
  });

  function getBalanceAfter(txId: string): number | undefined {
    if (isFilterActive.value) return undefined;
    return balanceAfterMap.value.get(txId);
  }

  return { getBalanceAfter };
}
```

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/pages/history/model/useBalanceAfter.ts
git commit -m "refactor(history): extract useBalanceAfter composable"
```

---

### Task 7: Wire composables into HistoryPage

**Files:**
- Modify: `frontend/src/pages/history/HistoryPage.vue`

**Step 1: Replace script setup**

1. Import `useHistoryFilters`, `TYPE_FILTER_ITEMS` from `./model/useHistoryFilters`
2. Import `useBalanceAfter` from `./model/useBalanceAfter`
3. Import `computeDayTotal` from `./lib/computeDayTotal`
4. Remove: inline filter state, `activeFiltersCount`, `serverFilters`, `usedCategories`, `clearAdditionalFilters`, `handleTypeFilterChange`, `typeFilterItems`, category imports (EXPENSE/INCOME/DEBT/TRANSFER/ALL_CATEGORIES, useCategories)
5. Remove: `balanceAfterMap`, `balanceAfterEnabled`, `getBalanceAfter` inline code
6. Remove: inline `computeTotal` lambda — replace with `computeDayTotal` in `useGroupedTransactions` call

Wire:
```typescript
const {
  activeTypeFilter,
  selectedAccountId,
  selectedCategoryId,
  isFiltersCollapsed,
  activeFiltersCount,
  serverFilters,
  usedCategories,
  handleTypeFilterChange,
  clearAdditionalFilters,
  resetAll,
} = useHistoryFilters(userId);
```

For `useGroupedTransactions`, replace the inline `computeTotal` with:
```typescript
const groupedTransactions = useGroupedTransactions(displayedTransactions, {
  sortGroups: true,
  sortTransactions: (a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  computeTotal: (txs) => computeDayTotal(txs, currency.value, convert),
});
```

For `useBalanceAfter`:
```typescript
const isFilterActive = computed(
  () => isSearchActive.value || activeTypeFilter.value !== 'all' || activeFiltersCount.value > 0,
);
const { getBalanceAfter } = useBalanceAfter(
  accounts,
  displayedTransactions,
  currency,
  isFilterActive,
);
```

In template, replace `typeFilterItems` with `TYPE_FILTER_ITEMS`.

For the "reset filters" button, replace inline handler with `resetAll`:
```html
@click="() => { clearSearch(); resetAll(); }"
```

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

**Step 3: Verify in dev server**

Test filtering, search, scroll.

**Step 4: Commit**

```bash
git add frontend/src/pages/history/HistoryPage.vue
git commit -m "refactor(history): wire useHistoryFilters, useBalanceAfter, computeDayTotal"
```

---

### Task 8: Create `useImportWizard` composable

**Files:**
- Create: `frontend/src/pages/settings/import/model/useImportWizard.ts`

**Step 1: Create the composable**

```typescript
import { ref, computed } from 'vue';
import { parseMoneyLoverCsv } from '@/shared/lib/csv/parseMoneyLoverCsv';
import type { ParseResult } from '@/shared/lib/csv/parseMoneyLoverCsv';
import { useImportData } from '@/features/import-data';
import type { ImportResult } from '@/features/import-data';

export type ImportStep = 'select' | 'preview' | 'result';

export function useImportWizard() {
  const step = ref<ImportStep>('select');
  const parseResult = ref<ParseResult | null>(null);
  const importResult = ref<ImportResult | null>(null);
  const parseError = ref<string | null>(null);

  const { importMutation } = useImportData();

  const fileInput = ref<HTMLInputElement | null>(null);

  const previewTransactions = computed(
    () => parseResult.value?.data.slice(0, 20) ?? [],
  );

  function openFilePicker() {
    fileInput.value?.click();
  }

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    parseError.value = null;

    try {
      const result = await parseMoneyLoverCsv(file);
      if (result.data.length === 0) {
        parseError.value = 'Файл не содержит транзакций';
        return;
      }
      parseResult.value = result;
      step.value = 'preview';
    } catch {
      parseError.value = 'Не удалось прочитать файл';
    }

    // Reset input so same file can be re-selected
    target.value = '';
  }

  async function handleImport() {
    if (!parseResult.value) return;

    try {
      const result = await importMutation.mutateAsync(parseResult.value.data);
      importResult.value = result;
      step.value = 'result';
    } catch {
      // Error handled by mutation state
    }
  }

  return {
    step,
    parseResult,
    importResult,
    parseError,
    importMutation,
    fileInput,
    previewTransactions,
    openFilePicker,
    handleFileChange,
    handleImport,
  };
}
```

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/pages/settings/import/model/useImportWizard.ts
git commit -m "refactor(import): extract useImportWizard composable"
```

---

### Task 9: Wire composable into ImportPage + use shared formatters

**Files:**
- Modify: `frontend/src/pages/settings/import/ImportPage.vue`

**Step 1: Replace script setup**

1. Import `useImportWizard` from `./model/useImportWizard`
2. Replace local `formatDate` with `formatLocalDate` from `@/shared/lib/format/date` (which formats as "19 февраля 2026")
   - For the date range and preview dates, we need DD.MM.YYYY format — keep a minimal local helper or use Intl directly
   - Actually the existing `formatDate` does `toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })` — this isn't in shared. Add a `formatShortDate` helper inline or just use the Intl call directly through a tiny local function. Keep it minimal.
3. Replace local `formatAmount` with `formatCurrency` from shared (with `showSign: true` option)
   - `formatAmount` does `+1 000` format. `formatCurrency` with `showSign: true` gives `+$1,000` with symbol. We need no symbol. Use `formatCurrency(amount, currency, { showSign: true, showSymbol: false })` — but we don't know the currency in import. Keep `formatAmount` as a 2-line local helper.
4. Destructure from `useImportWizard()`
5. Keep: `goToTransactions`, `goHome` (simple router.push)

New script:
```typescript
import { useRouter } from 'vue-router';
import { AppHeader } from '@/widgets/header';
import { UButton, UIcon, UCard } from '@/shared/ui';
import { navigateBack } from '@/app/router';
import { useImportWizard } from './model/useImportWizard';

const router = useRouter();

const {
  step,
  parseResult,
  importResult,
  parseError,
  importMutation,
  fileInput,
  previewTransactions,
  openFilePicker,
  handleFileChange,
  handleImport,
} = useImportWizard();

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateRange(from: string, to: string): string {
  return `${formatDate(from)} — ${formatDate(to)}`;
}

function formatAmount(amount: number): string {
  const sign = amount >= 0 ? '+' : '';
  return `${sign}${amount.toLocaleString('ru-RU')}`;
}

function goToTransactions() {
  router.push('/history');
}

function goHome() {
  router.push('/');
}
```

Template stays **unchanged**.

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

**Step 3: Verify in dev server**

Navigate to import page, ensure all steps render.

**Step 4: Commit**

```bash
git add frontend/src/pages/settings/import/ImportPage.vue frontend/src/pages/settings/import/model/useImportWizard.ts
git commit -m "refactor(import): wire useImportWizard composable"
```

---

### Task 10: Fix HeroAmount caret bug

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/HeroAmount.vue`

**Step 1: Fix the hidden input**

The problem: `<input>` with `opacity-0` shows the browser caret on the left edge while the displayed number is centered.

Fix: Add `caret-color: transparent` to hide the native caret entirely. The user sees the formatted number updating as they type — no visible caret needed since the input is invisible anyway.

Change line 88 from:
```html
class="absolute inset-0 w-full h-full opacity-0"
```
to:
```html
class="absolute inset-0 w-full h-full opacity-0 caret-transparent"
```

Tailwind v4 has `caret-transparent` utility built-in.

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

**Step 3: Test in dev**

Open add transaction page, verify:
- Numbers appear centered as before
- No visible caret flickering on the left
- Typing works normally

**Step 4: Commit**

```bash
git add frontend/src/features/add-transaction/ui/HeroAmount.vue
git commit -m "fix(add-transaction): hide native caret on HeroAmount hidden input"
```

---

### Task 11: Final verification

**Step 1: Full build check**

Run: `cd frontend && bun run build`
Expected: PASS with no type errors

**Step 2: Manual smoke test**

1. Dashboard — all sections load, quick actions work, pull-to-refresh works
2. History — filters work, search works, balance_after shows, swipe delete works
3. Import — file picker opens, preview renders, import completes
4. Add transaction — amount input works, no caret on left

**Step 3: Update changelog**

Add entry to `frontend/src/features/changelog/model/changelogData.ts`:
- Bump minor version
- Type: `improvement`
- Description: «Исправлен ввод суммы при добавлении транзакции»

**Step 4: Final commit**

```bash
git add -A
git commit -m "refactor: complete page decomposition + fix HeroAmount caret"
```
