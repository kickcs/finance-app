<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { useRouter } from 'vue-router';
import { queryClient } from '@/shared/api/queryClient';
import { AppHeader } from '@/widgets/header';
import { BottomNav } from '@/widgets/bottom-nav';
import {
  VirtualGroupedTransactionList,
  TransactionGroupSkeleton,
  useInfiniteTransactions,
  useGroupedTransactions,
  type Transaction,
  type TransactionFilters,
} from '@/entities/transaction';
import { SearchInput, useServerSearch } from '@/features/search-transactions';
import {
  EditTransactionModal,
  DeleteTransactionModal,
  useEditTransaction,
  useTransactionSelection,
} from '@/features/edit-transaction';
import { useAccounts, AccountSelector } from '@/entities/account';
import {
  ALL_CATEGORIES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  DEBT_CATEGORIES,
  TRANSFER_CATEGORY,
  useCategories,
  CategoryChips,
} from '@/entities/category';
import { UTabs, UIcon, UButton } from '@/shared/ui';
import { useExchangeRates } from '@/shared/api';

const router = useRouter();

const { userId } = useCurrentUser();
const { currency } = useUserCurrency();

// Exchange rates for currency conversion
const { convert } = useExchangeRates(currency);

// Accounts for filtering
const { accounts } = useAccounts(userId);

// Type filter
const typeFilterItems = [
  { id: 'all', label: 'Все' },
  { id: 'expense', label: 'Расходы' },
  { id: 'income', label: 'Доходы' },
  { id: 'transfer', label: 'Переводы' },
  { id: 'debt', label: 'Долги' },
];
const activeTypeFilter = ref<
  'all' | 'income' | 'expense' | 'transfer' | 'debt'
>('all');

// Collapse state
const isFiltersCollapsed = ref(false);

function handleTypeFilterChange(val: string) {
  activeTypeFilter.value = val as typeof activeTypeFilter.value;
  selectedCategoryId.value = null;
}

// Additional filters

const selectedAccountId = ref<string | null>(null);
const selectedCategoryId = ref<string | null>(null);

// Count of active additional filters
const activeFiltersCount = computed(() => {
  let count = 0;
  if (selectedAccountId.value) count++;
  if (selectedCategoryId.value) count++;
  return count;
});

// Server-side search
const {
  searchTerm,
  results: searchResults,
  isSearchActive,
  isLoading: isSearchLoading,
  hasNextPage: searchHasNextPage,
  isFetchingNextPage: searchIsFetchingNextPage,
  isFetching: searchIsFetching,
  fetchNextPage: fetchNextSearchPage,
  setQuery,
  clearSearch,
} = useServerSearch(userId);

// Build filters for server-side query
const serverFilters = computed<TransactionFilters>(() => ({
  type: activeTypeFilter.value !== 'all' ? activeTypeFilter.value : undefined,
  accountId: selectedAccountId.value ?? undefined,
  categoryId: selectedCategoryId.value ?? undefined,
}));

// Main transactions query with infinite scroll
const {
  transactions,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  isFetching,
  fetchNextPage,
} = useInfiniteTransactions(userId, serverFilters);

// Use search results when searching, otherwise use main transactions
const displayedTransactions = computed(() =>
  isSearchActive.value ? searchResults.value : transactions.value,
);

// Group transactions by date (client-side grouping of loaded data)
// Uses currency conversion and debt-aware logic for the daily total.
const groupedTransactions = useGroupedTransactions(displayedTransactions, {
  sortGroups: true,
  // Within group: sort by created_at descending for consistent ordering
  sortTransactions: (a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  // Multi-currency, debt-aware total computation
  computeTotal: (txs) =>
    txs.reduce((sum, tx) => {
      // Исключаем долговые транзакции, КРОМЕ выдачи/взятия долгов и возвратов
      // debt_given и debt_taken влияют на реальный money flow (деньги уходят/приходят)
      // Возвраты долгов также влияют на реальный money flow
      const isDebtGivenOrTaken =
        tx.category_id === 'debt_given' || tx.category_id === 'debt_taken';
      const isDebtReturn =
        tx.category_id === 'debt_return_to_me' ||
        tx.category_id === 'debt_return_from_me';
      if (tx.is_debt_related && !isDebtGivenOrTaken && !isDebtReturn)
        return sum;

      // Для расходов используем net_amount (с учётом возвратов)
      // Это учитывает частичные возвраты долгов
      const baseAmount =
        tx.type === 'expense' && tx.net_amount !== undefined
          ? tx.net_amount
          : tx.amount;

      // Конвертируем в базовую валюту, если другая
      const amount =
        tx.currency !== currency.value
          ? convert(baseAmount, tx.currency)
          : baseAmount;

      // Долговые операции обрабатываем явно по category_id
      // debt_given: дал в долг -> деньги ушли -> минус
      if (tx.category_id === 'debt_given') {
        return sum - amount;
      }
      // debt_taken: взял в долг -> деньги пришли -> плюс
      if (tx.category_id === 'debt_taken') {
        return sum + amount;
      }
      // debt_return_to_me и debt_return_from_me: НЕ учитываем в дневной сумме,
      // т.к. их эффект уже отражён в net_amount связанных транзакций
      if (
        tx.category_id === 'debt_return_to_me' ||
        tx.category_id === 'debt_return_from_me'
      ) {
        return sum;
      }

      if (tx.type === 'transfer') return sum;
      return sum + (tx.type === 'income' ? amount : -amount);
    }, 0),
});

// Loading and pagination state
const currentIsLoading = computed(() =>
  isSearchActive.value ? isSearchLoading.value : isLoading.value,
);
const currentHasNextPage = computed(() =>
  isSearchActive.value ? searchHasNextPage.value : hasNextPage.value,
);
const currentIsFetchingNextPage = computed(() =>
  isSearchActive.value
    ? searchIsFetchingNextPage.value
    : isFetchingNextPage.value,
);

const currentIsFetching = computed(() =>
  isSearchActive.value ? searchIsFetching.value : isFetching.value,
);

function handleLoadMore() {
  if (isSearchActive.value) {
    fetchNextSearchPage();
  } else {
    fetchNextPage();
  }
}

const isEmpty = computed(() => {
  const hasFilters =
    searchTerm.value.trim() !== '' ||
    activeTypeFilter.value !== 'all' ||
    activeFiltersCount.value > 0;
  return (
    hasFilters &&
    displayedTransactions.value.length === 0 &&
    !currentIsLoading.value
  );
});

// Edit transaction modal state
const showDeleteModal = ref(false);

const {
  selectedTransaction,
  hasSplitDebts,
  showEditModal,
  select: handleTransactionClick,
  close: closeEditModal,
} = useTransactionSelection(userId);

const {
  isUpdating,
  isDeleting,
  error: editError,
  update: updateTransactionFn,
  remove: removeTransactionFn,
} = useEditTransaction(userId.value);

async function handleUpdateTransaction(updates: Partial<Transaction>) {
  if (!selectedTransaction.value) return;
  const success = await updateTransactionFn(selectedTransaction.value, updates);
  if (success) {
    closeEditModal();
  }
}

async function handleDeleteTransaction() {
  if (!selectedTransaction.value) return;
  const success = await removeTransactionFn(selectedTransaction.value);
  if (success) {
    showDeleteModal.value = false;
    closeEditModal();
    selectedTransaction.value = null;
  }
}

function handleDeleteClick() {
  closeEditModal();
  showDeleteModal.value = true;
}

function handleAddTransaction() {
  router.push('/transactions/new');
}

// Clear additional filters
function clearAdditionalFilters() {
  selectedAccountId.value = null;
  selectedCategoryId.value = null;
}

// User categories from API + fallback to static
const {
  allCategories: userCategories,
  expenseCategories: userExpenseCategories,
  incomeCategories: userIncomeCategories,
  isLoading: isLoadingCategories,
} = useCategories(userId);

const usedCategories = computed(() => {
  const useDefaults = isLoadingCategories.value || (!userId.value && userCategories.value.length === 0);

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

// Helper to get account name by id
function getAccountName(accountId: string | null): string {
  if (!accountId) return '';
  const account = accounts.value.find((a) => a.id === accountId);
  return account?.name ?? '';
}

// Compute balance_after for each transaction by walking backwards from current balance.
// Key: `${accountId}_${currency}` to handle multi-currency accounts.
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

// Balance is only meaningful when all transactions are displayed without filters.
// With filters active, the algorithm walks an incomplete set and produces wrong results.
const balanceAfterEnabled = computed(
  () =>
    !isSearchActive.value &&
    activeTypeFilter.value === 'all' &&
    activeFiltersCount.value === 0,
);

function getBalanceAfter(txId: string): number | undefined {
  if (!balanceAfterEnabled.value) return undefined;
  return balanceAfterMap.value.get(txId);
}

// Handle swipe delete action
function handleSwipeDelete(transaction: Transaction) {
  selectedTransaction.value = transaction;
  showDeleteModal.value = true;
}

// Refresh all data
const isRefreshing = ref(false);
async function handleRefresh() {
  isRefreshing.value = true;
  try {
    await queryClient.invalidateQueries();
  } finally {
    isRefreshing.value = false;
  }
}
</script>

<template>
  <div
    class="h-dvh flex flex-col overflow-hidden bg-background-light dark:bg-background-dark"
  >
    <!-- Header -->
    <AppHeader title="История">
      <template #actions>
        <div class="flex items-center gap-1">
          <!-- Toggle Filters Button -->
          <div class="relative">
            <UButton
              variant="ghost"
              size="sm"
              class="!p-2"
              :aria-label="isFiltersCollapsed ? 'Показать фильтры' : 'Скрыть фильтры'"
              :aria-expanded="!isFiltersCollapsed"
              aria-controls="filters-container"
              @click="isFiltersCollapsed = !isFiltersCollapsed"
            >
              <UIcon
                :name="isFiltersCollapsed ? 'tune' : 'filter_list'"
                size="sm"
                :class="!isFiltersCollapsed ? 'text-primary' : ''"
              />
            </UButton>
            <!-- Active filters indicator dot -->
            <span
              v-if="isFiltersCollapsed && (searchTerm || selectedAccountId || selectedCategoryId)"
              aria-hidden="true"
              class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background-light dark:ring-background-dark"
            />
          </div>

          <!-- Refresh Button -->
          <UButton
            variant="ghost"
            size="sm"
            class="!p-2"
            :disabled="isRefreshing"
            aria-label="Обновить"
            @click="handleRefresh"
          >
            <UIcon
              name="refresh"
              size="sm"
              :class="{ 'animate-spin': isRefreshing }"
            />
          </UButton>
        </div>
      </template>
    </AppHeader>

    <!-- Fixed Controls -->
    <div class="px-5 pt-4 shrink-0">
      <!-- Type Filter Tabs (Always Visible) -->
      <UTabs
        :model-value="activeTypeFilter"
        :items="typeFilterItems"
        size="sm"
        @update:model-value="handleTypeFilterChange"
      />
    </div>

    <!-- Collapsible Filters -->
    <div
      id="filters-container"
      class="px-5 shrink-0"
      :class="isFiltersCollapsed ? 'hidden' : 'block'"
      :inert="isFiltersCollapsed || undefined"
    >
      <div class="space-y-4 pt-4 pb-2">
        <!-- Search -->
        <div>
          <SearchInput
            :model-value="searchTerm"
            placeholder="Поиск транзакций..."
            @update:model-value="setQuery"
            @clear="clearSearch"
          />
        </div>

        <!-- Quick Filters -->
        <div class="space-y-3">
          <AccountSelector
            v-if="accounts.length > 0"
            :accounts="accounts"
            :selected-id="selectedAccountId"
            label="Счета"
            @select="
              selectedAccountId = $event === selectedAccountId ? null : $event
            "
          />
          <CategoryChips
            v-if="usedCategories.length > 0"
            :categories="usedCategories"
            :selected-id="selectedCategoryId ?? ''"
            label="Категории"
            @select="
              selectedCategoryId = $event === selectedCategoryId ? null : $event
            "
          />
        </div>
      </div>
    </div>

    <!-- Content Area: flex column so virtualizer height is set by flex, not by % of padded parent -->
    <div class="flex-1 min-h-0 px-5 pt-4 flex flex-col">
      <!-- Loading State with Skeleton -->
      <div
        v-if="currentIsLoading && displayedTransactions.length === 0"
        class="flex-1 space-y-4 overflow-y-auto"
      >
        <TransactionGroupSkeleton v-for="i in 3" :key="i" :count="3" />
      </div>

      <!-- Virtualized Transaction Groups: flex-1 wrapper ensures virtualizer gets definite height from flex, not from % -->
      <div v-else-if="groupedTransactions.length > 0" :class="['flex-1 min-h-0 transition-opacity duration-300', { 'opacity-50 pointer-events-none': currentIsFetching && displayedTransactions.length > 0 }]">
        <VirtualGroupedTransactionList
          :groups="groupedTransactions"
          :currency="currency"
          :has-next-page="currentHasNextPage"
          :is-fetching-next-page="currentIsFetchingNextPage"
          :get-account-name="getAccountName"
          :get-balance-after="getBalanceAfter"
          swipe-enabled
          height="100%"
          @load-more="handleLoadMore"
          @transaction-click="handleTransactionClick"
          @transaction-edit="handleTransactionClick"
          @transaction-delete="handleSwipeDelete"
        />
      </div>

      <!-- Empty State -->
      <div v-else class="py-16 text-center flex flex-col items-center">
        <div
          class="w-16 h-16 mb-4 rounded-full bg-surface-light dark:bg-surface-dark flex items-center justify-center"
        >
          <UIcon
            name="receipt_long"
            size="lg"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </div>
        <p
          class="text-text-secondary-light dark:text-text-secondary-dark mb-2 font-medium"
        >
          {{ isEmpty ? 'Ничего не найдено' : 'Нет транзакций' }}
        </p>
        <p
          class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark mb-6"
        >
          {{
            isEmpty
              ? 'Попробуйте изменить параметры поиска'
              : 'Добавьте свою первую транзакцию, чтобы начать вести учет'
          }}
        </p>
        <UButton
          v-if="isEmpty"
          variant="secondary"
          @click="
            () => {
              clearSearch();
              clearAdditionalFilters();
              activeTypeFilter = 'all';
            }
          "
        >
          Сбросить фильтры
        </UButton>
        <UButton v-else variant="primary" @click="handleAddTransaction">
          Добавить транзакцию
        </UButton>
      </div>

      <!-- Spacer for fixed BottomNav — sits outside the flex-1 blocks so the virtualizer height excludes it -->
      <div class="shrink-0 h-20" />
    </div>

    <!-- Edit Transaction Modal -->
    <EditTransactionModal
      v-model="showEditModal"
      :transaction="selectedTransaction"
      :currency="currency"
      :is-updating="isUpdating"
      :error="editError"
      :has-split-debts="hasSplitDebts"
      @confirm="handleUpdateTransaction"
      @cancel="closeEditModal"
      @delete="handleDeleteClick"
    />

    <!-- Delete Confirmation Modal -->
    <DeleteTransactionModal
      v-model="showDeleteModal"
      :transaction="selectedTransaction"
      :currency="currency"
      :is-deleting="isDeleting"
      @confirm="handleDeleteTransaction"
      @cancel="showDeleteModal = false"
    />

    <!-- Bottom Navigation -->
    <BottomNav @add-click="handleAddTransaction" />
  </div>
</template>
