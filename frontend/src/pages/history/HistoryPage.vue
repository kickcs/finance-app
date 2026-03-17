<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { AppHeader } from '@/widgets/header';
import {
  VirtualGroupedTransactionList,
  TransactionGroupSkeleton,
  TransactionDetailPanel,
  useInfiniteTransactions,
  useGroupedTransactions,
} from '@/entities/transaction';
import type { Transaction } from '@/entities/transaction';
import { SearchInput, useServerSearch } from '@/features/search-transactions';
import {
  EditTransactionModal,
  DeleteTransactionModal,
  useTransactionEditFlow,
} from '@/features/edit-transaction';
import { useAccounts, AccountSelector } from '@/entities/account';
import { CategoryChips } from '@/entities/category';
import { UTabs, UIcon, UButton, MasterDetailLayout } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useExchangeRates } from '@/shared/api';

// Page composables
import { useHistoryFilters, TYPE_FILTER_ITEMS } from './model/useHistoryFilters';
import { useBalanceAfter } from './model/useBalanceAfter';
import { computeDayTotal } from './lib/computeDayTotal';

const router = useRouter();
const isDesktop = useIsDesktop();

const { userId } = useCurrentUser();
const { currency } = useUserCurrency();
const { convert } = useExchangeRates(currency);
const { accounts } = useAccounts(userId);

// Filters
const {
  activeTypeFilter,
  selectedAccountId,
  selectedCategoryId,
  isFiltersCollapsed,
  activeFiltersCount,
  serverFilters,
  usedCategories,
  handleTypeFilterChange,
  resetAll,
} = useHistoryFilters(userId);

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

// Main transactions query with infinite scroll
const { transactions, isLoading, hasNextPage, isFetchingNextPage, isFetching, fetchNextPage } =
  useInfiniteTransactions(userId, serverFilters);

// Use search results when searching, otherwise use main transactions
const displayedTransactions = computed(() =>
  isSearchActive.value ? searchResults.value : transactions.value,
);

// Group transactions by date
const groupedTransactions = useGroupedTransactions(displayedTransactions, {
  sortGroups: true,
  sortTransactions: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  computeTotal: (txs) => computeDayTotal(txs, currency.value, convert),
});

// Loading and pagination state
const currentIsLoading = computed(() =>
  isSearchActive.value ? isSearchLoading.value : isLoading.value,
);
const currentHasNextPage = computed(() =>
  isSearchActive.value ? searchHasNextPage.value : hasNextPage.value,
);
const currentIsFetchingNextPage = computed(() =>
  isSearchActive.value ? searchIsFetchingNextPage.value : isFetchingNextPage.value,
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
  return hasFilters && displayedTransactions.value.length === 0 && !currentIsLoading.value;
});

// Balance after
const isFilterActive = computed(
  () => isSearchActive.value || activeTypeFilter.value !== 'all' || activeFiltersCount.value > 0,
);
const { getBalanceAfter } = useBalanceAfter(
  accounts,
  displayedTransactions,
  currency,
  isFilterActive,
);

// Edit transaction modal state
const {
  selectedTransaction,
  hasSplitDebts,
  showEditModal,
  showDeleteModal,
  isUpdating,
  isDeleting,
  editError,
  handleTransactionClick,
  handleUpdateTransaction,
  handleDeleteTransaction,
  handleDeleteClick,
  handleSwipeDelete,
  closeEditModal,
} = useTransactionEditFlow(userId);

// Desktop: selected transaction for detail panel
const selectedTransactionId = ref<string | null>(null);

const selectedDetailTransaction = computed(() => {
  if (!selectedTransactionId.value) return null;
  return displayedTransactions.value.find((t) => t.id === selectedTransactionId.value) ?? null;
});

// Reset selection when transactions change and selected one is no longer in the list
watch(displayedTransactions, (txs) => {
  if (!selectedTransactionId.value) return;
  if (!txs.find((t) => t.id === selectedTransactionId.value)) {
    selectedTransactionId.value = null;
  }
});

function onTransactionClick(transaction: Transaction) {
  if (isDesktop.value) {
    selectedTransactionId.value = transaction.id;
  } else {
    handleTransactionClick(transaction);
  }
}

function handleDetailEdit() {
  if (!selectedDetailTransaction.value) return;
  handleTransactionClick(selectedDetailTransaction.value);
}

function handleDetailDelete() {
  if (!selectedDetailTransaction.value) return;
  selectedTransaction.value = selectedDetailTransaction.value;
  showDeleteModal.value = true;
}

async function handleDeleteTransactionAndClear() {
  await handleDeleteTransaction();
  selectedTransactionId.value = null;
}

function handleAddTransaction() {
  router.push({ name: ROUTE_NAMES.NEW_TRANSACTION });
}

function getAccountName(accountId: string | null): string {
  if (!accountId) return '';
  const account = accounts.value.find((a) => a.id === accountId);
  return account?.name ?? '';
}

const isRefreshing = ref(false);
async function handleRefresh() {
  const uid = userId.value;
  if (!uid) return;
  isRefreshing.value = true;
  try {
    await Promise.all([
      invalidateTransactionRelated(queryClient, uid),
      invalidateAccountRelated(queryClient, uid),
    ]);
  } finally {
    isRefreshing.value = false;
  }
}
</script>

<template>
  <div
    class="h-full flex flex-col overflow-hidden bg-background-light dark:bg-background-dark relative"
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
              data-testid="active-filters-dot"
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
            <UIcon name="refresh" size="sm" :class="{ 'animate-spin': isRefreshing }" />
          </UButton>
        </div>
      </template>
    </AppHeader>

    <!-- Master-Detail Layout -->
    <MasterDetailLayout
      :selected="selectedTransactionId"
      empty-icon="receipt_long"
      empty-text="Выберите транзакцию для просмотра деталей"
      @close="selectedTransactionId = null"
    >
      <template #master>
        <!-- Wrapper creates flex column context so flex-1 children get proper heights.
             Without this, MasterDetailLayout's slot container (overflow-y-auto, not flex)
             makes flex-1/shrink-0 ineffective, causing the virtualizer's height:100%
             to resolve to auto — rendering ALL items and cascading fetchNextPage. -->
        <div class="h-full flex flex-col overflow-hidden">
          <!-- Fixed Controls -->
          <div class="pt-4 shrink-0 lg:pr-0">
            <!-- Type Filter Tabs (Always Visible) -->
            <UTabs
              :model-value="activeTypeFilter"
              :items="TYPE_FILTER_ITEMS"
              size="sm"
              @update:model-value="handleTypeFilterChange"
            />
          </div>

          <!-- Collapsible Filters -->
          <div
            id="filters-container"
            class="shrink-0"
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
                  @select="selectedAccountId = $event === selectedAccountId ? null : $event"
                />
                <CategoryChips
                  v-if="usedCategories.length > 0"
                  :categories="usedCategories"
                  :selected-id="selectedCategoryId ?? ''"
                  label="Категории"
                  @select="selectedCategoryId = $event === selectedCategoryId ? null : $event"
                />
              </div>
            </div>
          </div>

          <!-- Content Area: flex column so virtualizer height is set by flex, not by % of padded parent -->
          <div class="flex-1 min-h-0 pt-4 flex flex-col">
            <!-- Loading State with Skeleton -->
            <div
              v-if="currentIsLoading && displayedTransactions.length === 0"
              data-testid="history-loading"
              class="flex-1 space-y-4 overflow-hidden"
            >
              <TransactionGroupSkeleton v-for="i in 3" :key="i" :count="3" />
            </div>

            <!-- Virtualized Transaction Groups: flex-1 wrapper ensures virtualizer gets definite height from flex, not from % -->
            <div
              v-else-if="groupedTransactions.length > 0"
              data-testid="history-transaction-list"
              :class="[
                'flex-1 min-h-0 transition-opacity duration-300',
                {
                  'opacity-50 pointer-events-none':
                    currentIsFetching &&
                    !currentIsFetchingNextPage &&
                    displayedTransactions.length > 0,
                },
              ]"
            >
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
                @transaction-click="onTransactionClick"
                @transaction-edit="onTransactionClick"
                @transaction-delete="handleSwipeDelete"
              />
            </div>

            <!-- Empty State -->
            <div
              v-else
              data-testid="history-empty-state"
              class="py-16 text-center flex flex-col items-center"
            >
              <div
                class="w-16 h-16 mb-4 rounded-full bg-surface-light dark:bg-surface-dark flex items-center justify-center"
              >
                <UIcon
                  name="receipt_long"
                  size="lg"
                  class="text-text-tertiary-light dark:text-text-tertiary-dark"
                />
              </div>
              <p class="text-text-secondary-light dark:text-text-secondary-dark mb-2 font-medium">
                {{ isEmpty ? 'Ничего не найдено' : 'Нет транзакций' }}
              </p>
              <p class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark mb-6">
                {{
                  isEmpty
                    ? 'Попробуйте изменить параметры поиска'
                    : 'Добавьте свою первую транзакцию, чтобы начать вести учет'
                }}
              </p>
              <UButton
                v-if="isEmpty"
                variant="secondary"
                data-testid="reset-filters-btn"
                @click="
                  () => {
                    clearSearch();
                    resetAll();
                  }
                "
              >
                Сбросить фильтры
              </UButton>
              <UButton
                v-else
                variant="primary"
                data-testid="add-transaction-btn"
                @click="handleAddTransaction"
              >
                Добавить транзакцию
              </UButton>
            </div>

            <!-- Spacer for fixed BottomNav — sits outside the flex-1 blocks so the virtualizer height excludes it -->
            <div class="shrink-0 h-20 lg:h-0" />
          </div>
        </div>
      </template>

      <template #detail>
        <TransactionDetailPanel
          v-if="selectedDetailTransaction"
          :transaction="selectedDetailTransaction"
          :currency="currency"
          :account-name="getAccountName(selectedDetailTransaction.account_id)"
          :to-account-name="getAccountName(selectedDetailTransaction.to_account_id ?? null)"
          @edit="handleDetailEdit"
          @delete="handleDetailDelete"
        />
      </template>
    </MasterDetailLayout>

    <!-- Edit Transaction Modal -->
    <EditTransactionModal
      v-model="showEditModal"
      :transaction="selectedTransaction"
      :accounts="accounts"
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
      @confirm="handleDeleteTransactionAndClear"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>
