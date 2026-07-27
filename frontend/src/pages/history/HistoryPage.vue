<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
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
import { useAccounts } from '@/entities/account';
import { UTabs, UIcon, UButton, MasterDetailLayout } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useExchangeRates } from '@/shared/api';
import { ImportInboxBanner } from '@/widgets/ImportInboxBanner';

// Page composables
import { useHistoryFilters, TYPE_FILTER_ITEMS } from './model/useHistoryFilters';
import { useBalanceAfter } from './model/useBalanceAfter';
import { computeDayTotal } from './lib/computeDayTotal';
import HistoryFiltersSheet from './ui/HistoryFiltersSheet.vue';

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
  activeFiltersCount,
  serverFilters,
  usedCategories,
  handleTypeFilterChange,
  clearAdditionalFilters,
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

// Строка управления морфится: поиск занимает её целиком. Пока идёт поиск, фильтр
// по типу всё равно не применяется (поиск ходит на сервер без фильтров), поэтому
// вкладки не показываем — иначе они выглядели бы рабочими, не будучи такими.
const isSearchOpen = ref(false);
const searchInputRef = ref<InstanceType<typeof SearchInput> | null>(null);
const searchButtonRef = ref<InstanceType<typeof UButton> | null>(null);

function openSearch() {
  isSearchOpen.value = true;
  nextTick(() => searchInputRef.value?.focus());
}

function closeSearch() {
  isSearchOpen.value = false;
  clearSearch();
  // Кнопка поиска в шапке только что вернулась в разметку — возвращаем на неё
  // фокус, иначе он падает на body и Tab начинается с начала страницы.
  nextTick(() => (searchButtonRef.value?.$el as HTMLElement | undefined)?.focus());
}

// Filters sheet
const isFiltersSheetOpen = ref(false);

/** Чип активного фильтра: `icon` — категория, без него — точка цвета счёта */
interface ActiveFilterChip {
  key: string;
  label: string;
  ariaLabel: string;
  color: string;
  icon?: string;
  clear: () => void;
}

const activeFilterChips = computed<ActiveFilterChip[]>(() => {
  const chips: ActiveFilterChip[] = [];

  const account = accounts.value.find((a) => a.id === selectedAccountId.value);
  if (account) {
    chips.push({
      key: 'account',
      label: account.name,
      ariaLabel: `Убрать фильтр по счёту: ${account.name}`,
      color: account.color,
      clear: () => (selectedAccountId.value = null),
    });
  }

  const category = usedCategories.value.find((c) => c.id === selectedCategoryId.value);
  if (category) {
    chips.push({
      key: 'category',
      label: category.name,
      ariaLabel: `Убрать фильтр по категории: ${category.name}`,
      color: category.color,
      icon: category.icon,
      clear: () => (selectedCategoryId.value = null),
    });
  }

  return chips;
});

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

function resetEverything() {
  clearSearch();
  isSearchOpen.value = false;
  resetAll();
}

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
  showEditModal,
  showDeleteModal,
  isUpdating,
  isDeleting,
  editError,
  handleTransactionClick,
  saveTransaction,
  handleDeleteTransaction,
  handleDeleteClick,
  handleSwipeDelete,
  closeEditModal,
} = useTransactionEditFlow(userId);

// Смена фильтра или запроса даёт другой список — прокрутку возвращаем в начало,
// иначе пользователь остаётся на позиции, которой в новых данных уже нет
// (а липкий заголовок дня показывает день из старого набора).
const listRef = ref<InstanceType<typeof VirtualGroupedTransactionList> | null>(null);

watch([serverFilters, searchTerm], () => {
  nextTick(() => listRef.value?.scrollToTop());
});

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
  handleSwipeDelete(selectedDetailTransaction.value);
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
        <!-- Поиск и фильтры живут в шапке: строке управления нужна вся ширина,
             иначе пятая вкладка («Долги») не помещается на узком экране -->
        <UButton
          v-if="!isSearchOpen"
          ref="searchButtonRef"
          variant="ghost"
          size="sm"
          class="!p-2"
          aria-label="Поиск транзакций"
          data-testid="open-search-btn"
          @click="openSearch"
        >
          <UIcon name="search" size="sm" />
        </UButton>

        <div class="relative">
          <UButton
            variant="ghost"
            size="sm"
            class="!p-2"
            :aria-label="
              activeFiltersCount > 0 ? `Фильтры, активно: ${activeFiltersCount}` : 'Фильтры'
            "
            data-testid="open-filters-btn"
            @click="isFiltersSheetOpen = true"
          >
            <UIcon name="tune" size="sm" :class="activeFiltersCount > 0 ? 'text-primary' : ''" />
          </UButton>
          <span
            v-if="activeFiltersCount > 0"
            data-testid="active-filters-count"
            aria-hidden="true"
            class="absolute top-0 right-0 min-w-[16px] h-[16px] px-1 bg-primary text-white text-caption-xs font-semibold rounded-full flex items-center justify-center ring-2 ring-background-light dark:ring-background-dark"
          >
            {{ activeFiltersCount }}
          </span>
        </div>

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
          <!-- Pending imports banner (Telegram).
               empty:hidden — баннер рисуется только при неподтверждённых импортах,
               иначе обёртка съедала бы отступ впустую на каждом заходе. -->
          <div class="shrink-0 pt-3 empty:hidden">
            <ImportInboxBanner />
          </div>

          <!-- Строка управления -->
          <div class="shrink-0 pt-3 flex items-center gap-2">
            <template v-if="isSearchOpen">
              <SearchInput
                ref="searchInputRef"
                size="sm"
                :model-value="searchTerm"
                placeholder="Поиск транзакций..."
                @update:model-value="setQuery"
                @clear="clearSearch"
              />
              <UButton variant="ghost" size="sm" class="shrink-0 !px-2" @click="closeSearch">
                Отмена
              </UButton>
            </template>

            <UTabs
              v-else
              class="flex-1 min-w-0"
              :model-value="activeTypeFilter"
              :items="TYPE_FILTER_ITEMS"
              size="sm"
              @update:model-value="handleTypeFilterChange"
            />
          </div>

          <!-- Активные фильтры: состояние видно, не открывая шторку -->
          <div
            v-if="activeFilterChips.length > 0"
            data-testid="active-filter-chips"
            class="shrink-0 flex items-center gap-1.5 pt-2 overflow-x-auto no-scrollbar"
          >
            <button
              v-for="chip in activeFilterChips"
              :key="chip.key"
              type="button"
              class="shrink-0 inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg bg-surface-light dark:bg-surface-dark text-xs text-text-primary-light dark:text-text-primary-dark"
              :aria-label="chip.ariaLabel"
              @click="chip.clear()"
            >
              <UIcon v-if="chip.icon" :name="chip.icon" size="xs" :style="{ color: chip.color }" />
              <span
                v-else
                class="w-2 h-2 rounded-full shrink-0"
                :style="{ backgroundColor: chip.color }"
              />
              {{ chip.label }}
              <UIcon
                name="close"
                size="xs"
                class="text-text-tertiary-light dark:text-text-tertiary-dark"
              />
            </button>

            <button
              v-if="activeFilterChips.length > 1"
              type="button"
              class="shrink-0 px-2 py-1 text-xs text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark"
              @click="clearAdditionalFilters"
            >
              Сбросить
            </button>
          </div>

          <!-- Content Area: flex column so virtualizer height is set by flex, not by % of padded parent -->
          <div class="flex-1 min-h-0 pt-2 flex flex-col">
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
                ref="listRef"
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
              class="flex-1 min-h-0 py-10 text-center flex flex-col items-center justify-center"
            >
              <div
                class="w-12 h-12 mb-3 rounded-full bg-surface-light dark:bg-surface-dark flex items-center justify-center"
              >
                <UIcon
                  name="receipt_long"
                  size="md"
                  class="text-text-tertiary-light dark:text-text-tertiary-dark"
                />
              </div>
              <p
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-1 font-medium"
              >
                {{ isEmpty ? 'Ничего не найдено' : 'Нет транзакций' }}
              </p>
              <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mb-4">
                {{
                  isEmpty
                    ? 'Попробуйте изменить параметры поиска'
                    : 'Добавьте свою первую транзакцию, чтобы начать вести учет'
                }}
              </p>
              <UButton
                v-if="isEmpty"
                variant="secondary"
                size="sm"
                data-testid="reset-filters-btn"
                @click="resetEverything"
              >
                Сбросить фильтры
              </UButton>
              <UButton
                v-else
                variant="primary"
                size="sm"
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

    <!-- Filters Sheet -->
    <HistoryFiltersSheet
      v-model:open="isFiltersSheetOpen"
      :accounts="accounts"
      :categories="usedCategories"
      :selected-account-id="selectedAccountId"
      :selected-category-id="selectedCategoryId"
      :active-count="activeFiltersCount"
      @update:selected-account-id="selectedAccountId = $event"
      @update:selected-category-id="selectedCategoryId = $event"
      @reset="clearAdditionalFilters"
    />

    <!-- Edit Transaction Modal -->
    <EditTransactionModal
      v-model="showEditModal"
      :transaction="selectedTransaction"
      :accounts="accounts"
      :currency="currency"
      :is-updating="isUpdating"
      :error="editError"
      :on-save="saveTransaction"
      @saved="closeEditModal"
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
