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
  useTransactionsSummary,
  useGroupedTransactions,
  useHashtags,
  stripHash,
} from '@/entities/transaction';
import type { BulkAction, Transaction, TransactionFilters } from '@/entities/transaction';
import { useCategories } from '@/entities/category';
import { SearchInput, useSearchTerm } from '@/features/search-transactions';
import {
  EditTransactionModal,
  DeleteTransactionModal,
  useTransactionEditFlow,
} from '@/features/edit-transaction';
import {
  BulkDock,
  BulkSelectionBar,
  BulkEditSheet,
  useBulkSelection,
  useBulkEditFlow,
  useDeferredBulkDelete,
  buildScopeChips,
  formatTotals,
  selectionTotals,
} from '@/features/bulk-edit-transactions';
import { useAccounts } from '@/entities/account';
import { UTabs, UIcon, UButton, MasterDetailLayout } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useSuppressBottomNav } from '@/shared/lib/composables/useSuppressBottomNav';
import { useExchangeRates } from '@/shared/api';
import { ImportInboxBanner } from '@/widgets/ImportInboxBanner';

// Page composables
import { useHistoryFilters, TYPE_FILTER_ITEMS } from './model/useHistoryFilters';
import type { FacetName } from './model/facets';
import { useBalanceAfter } from './model/useBalanceAfter';
import { useHistoryBulk } from './model/useHistoryBulk';
import { computeDayTotal } from './lib/computeDayTotal';
import { periodLabel } from './lib/historyPeriod';
import HistoryFacetRail from './ui/HistoryFacetRail.vue';
import HistoryFacetSheet from './ui/HistoryFacetSheet.vue';

const router = useRouter();
const isDesktop = useIsDesktop();

const { userId } = useCurrentUser();
const { currency } = useUserCurrency();
const { convert } = useExchangeRates(currency);
const { accounts } = useAccounts(userId);

// Filters
const {
  activeTypeFilter,
  period,
  facetValues,
  serverFilters,
  hasActiveFilters,
  usedCategories,
  handleTypeFilterChange,
  showAfterCategoryMove,
  showAfterTransfer,
  clearFacet,
  resetAll,
} = useHistoryFilters(userId);

const { searchTerm, debouncedTerm, isSearchActive, setQuery, clearSearch } = useSearchTerm();

// Строка управления морфится: поиск занимает её целиком. Поиск идёт мимо вкладок
// и чипов, поэтому их не показываем — иначе они выглядели бы рабочими, не будучи такими.
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

// Чип, открытый в шторке выбора
const openFacet = ref<FacetName | null>(null);

// Один фильтр на ленту, итог и «Изменить все»: разойдись они — правка задела бы не то, что на экране.
const activeFilters = computed<TransactionFilters>(() =>
  isSearchActive.value ? { search: debouncedTerm.value } : serverFilters.value,
);

const {
  transactions: displayedTransactions,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  isFetching,
  fetchNextPage,
} = useInfiniteTransactions(userId, activeFilters);

// Итог выборки: плашка внизу и «Показать N операций» в шторке чипа
const {
  summary,
  isPlaceholderData: isSummaryStale,
  refetch: refetchSummary,
} = useTransactionsSummary(userId, activeFilters);

// Group transactions by date
const groupedTransactions = useGroupedTransactions(displayedTransactions, {
  sortGroups: true,
  sortTransactions: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  computeTotal: (txs) => computeDayTotal(txs, currency.value, convert),
});

const isEmpty = computed(() => {
  const hasFilters = searchTerm.value.trim() !== '' || hasActiveFilters.value;
  return hasFilters && displayedTransactions.value.length === 0 && !isLoading.value;
});

function resetEverything() {
  clearSearch();
  isSearchOpen.value = false;
  resetAll();
}

// Balance after
const isFilterActive = computed(() => isSearchActive.value || hasActiveFilters.value);
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

// --- Массовая правка -------------------------------------------------------
const {
  isSelecting,
  selectedIds,
  selectedCount,
  start: startSelection,
  toggle: toggleSelection,
  selectAll,
  isAllSelected,
  selectableCount: countSelectable,
  prune: pruneSelection,
  exit: exitSelection,
} = useBulkSelection();
// Панель выбора встаёт на место навигации: переход по вкладке молча потерял бы отметки.
useSuppressBottomNav(isSelecting);
const { scheduleDelete } = useDeferredBulkDelete(userId);
const { expenseCategories, incomeCategories } = useCategories(userId);
const { hashtags } = useHashtags(userId);

const targetCategories = computed(() => [...expenseCategories.value, ...incomeCategories.value]);
const hashtagNames = computed(() => hashtags.value.map((h) => stripHash(h.tag)));

const selectedRows = computed(() =>
  displayedTransactions.value.filter((tx) => selectedIds.value.has(tx.id)),
);
const selectableCount = computed(() => countSelectable(displayedTransactions.value));
const selectionTotalsLabel = computed(() =>
  selectedRows.value.length > 0 ? formatTotals(selectionTotals(selectedRows.value)) : '',
);

// Ушедшие из списка строки (правка, фильтр) не должны попасть в запрос.
watch(displayedTransactions, (rows) => pruneSelection(rows));

/**
 * После правки показываем, куда операции переехали: иначе отфильтрованный список просто опустеет.
 * В поиске чипы не действуют, а найденное правкой не теряется — остаёмся в нём.
 */
function followAppliedAction(action: BulkAction) {
  if (isSearchActive.value) return;
  if (action.kind === 'category') showAfterCategoryMove(action.category_id);
  else if (action.kind === 'transfer') showAfterTransfer(action.to_account_id);
}

const bulkFlow = useBulkEditFlow({
  userId,
  filters: () => activeFilters.value,
  summary: () => summary.value,
  refetchSummary: async () => (await refetchSummary()).data,
  selectedIds: () => [...selectedIds.value],
  scheduleDelete,
  onApplied: followAppliedAction,
  onFinished: exitSelection,
});

// Плашку прячет только поиск без запроса: лента под ним ещё отфильтрована скрытыми чипами.
const showBulkDock = computed(() => !isSearchOpen.value || isSearchActive.value);
const isBulkFiltered = computed(() => isSearchActive.value || hasActiveFilters.value);
const bulkScopeChips = computed(() =>
  buildScopeChips({
    filters: activeFilters.value,
    periodLabel: periodLabel(period.value),
    categories: usedCategories.value,
    accounts: accounts.value,
  }),
);

const { categoryTypes: bulkCategoryTypes, sourceCategoryIds: bulkSourceCategoryIds } =
  useHistoryBulk({
    mode: bulkFlow.mode,
    filters: () => activeFilters.value,
    selectedRows: () => selectedRows.value,
    categories: () => usedCategories.value,
  });

function handleLongPress(tx: Transaction) {
  if (!isSelecting.value) startSelection(tx);
}

// Смена фильтра или запроса даёт другой список — прокрутку возвращаем в начало,
// иначе пользователь остаётся на позиции, которой в новых данных уже нет
// (а липкий заголовок дня показывает день из старого набора).
const listRef = ref<InstanceType<typeof VirtualGroupedTransactionList> | null>(null);

// Поиск входит в фильтр после дебаунса — список не дёргается наверх на каждом нажатии.
watch(activeFilters, () => {
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
  if (isSelecting.value) {
    toggleSelection(transaction);
    return;
  }
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
        <!-- Поиск живёт в шапке: строке управления нужна вся ширина,
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
             to resolve to auto — rendering ALL items and cascading fetchNextPage.
             Без overflow-hidden: плашка итога выходит на 10 px в поля скроллера. -->
        <div class="h-full flex flex-col">
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

          <!-- Чипы фильтров: состояние видно, не открывая шторку. Поиск идёт мимо них,
               поэтому пока он открыт, чипы скрыты вместе с вкладками.
               На телефоне лента выходит в край экрана сквозь px-5 мастер-колонки. -->
          <HistoryFacetRail
            v-if="!isSearchOpen"
            :class="cn(!isDesktop && '-mx-5 px-5')"
            :values="facetValues"
            :hide-category="activeTypeFilter === 'transfer'"
            @open="openFacet = $event"
            @clear="clearFacet"
          />

          <!-- Content Area: flex column so virtualizer height is set by flex, not by % of padded parent -->
          <div class="flex-1 min-h-0 pt-2 flex flex-col">
            <!-- Loading State with Skeleton -->
            <div
              v-if="isLoading && displayedTransactions.length === 0"
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
                    isFetching && !isFetchingNextPage && displayedTransactions.length > 0,
                },
              ]"
            >
              <VirtualGroupedTransactionList
                ref="listRef"
                :groups="groupedTransactions"
                :currency="currency"
                :has-next-page="hasNextPage"
                :is-fetching-next-page="isFetchingNextPage"
                :get-account-name="getAccountName"
                :get-balance-after="getBalanceAfter"
                swipe-enabled
                selectable
                :select-mode="isSelecting"
                :selected-ids="selectedIds"
                height="100%"
                @load-more="fetchNextPage()"
                @transaction-click="onTransactionClick"
                @transaction-edit="onTransactionClick"
                @transaction-delete="handleSwipeDelete"
                @transaction-long-press="handleLongPress"
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

            <!-- Плашка итога и панель ручного выбора: над навигацией, вне виртуального списка -->
            <BulkSelectionBar
              v-if="isSelecting"
              class="shrink-0"
              :selected-count="selectedCount"
              :selectable-count="selectableCount"
              :all-selected="isAllSelected(displayedTransactions)"
              :totals-label="selectionTotalsLabel"
              @exit="exitSelection"
              @toggle-all="selectAll(displayedTransactions)"
              @category="bulkFlow.openManual('pickCategory')"
              @transfer="bulkFlow.openManual('pickTransferAccount')"
              @account="bulkFlow.openManual('pickAccount')"
              @more="bulkFlow.openManual('verbs')"
            />
            <BulkDock
              v-else-if="showBulkDock"
              class="shrink-0"
              :summary="summary"
              :is-filtered="isBulkFiltered"
              :stale="isSummaryStale"
              :select-disabled="selectableCount === 0"
              @select="startSelection()"
              @edit-all="bulkFlow.openAll()"
            />

            <!-- Spacer for fixed BottomNav — sits outside the flex-1 blocks so the virtualizer height excludes it -->
            <div
              v-if="!isDesktop"
              :class="cn('shrink-0', isSelecting ? 'h-[env(safe-area-inset-bottom,0px)]' : 'h-20')"
            />
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
          :accounts="accounts"
          @edit="handleDetailEdit"
          @delete="handleDetailDelete"
        />
      </template>
    </MasterDetailLayout>

    <!-- Шторка выбора значений чипа -->
    <HistoryFacetSheet
      v-model:facet="openFacet"
      v-model:values="facetValues"
      :categories="usedCategories"
      :accounts="accounts"
      :hashtags="hashtags"
      :result-count="summary?.count"
      @clear="clearFacet"
    />

    <BulkEditSheet
      :flow="bulkFlow"
      :scope-chips="bulkScopeChips"
      :summary="summary"
      :categories="targetCategories"
      :category-types="bulkCategoryTypes"
      :source-category-ids="bulkSourceCategoryIds"
      :accounts="accounts"
      :hashtags="hashtagNames"
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
      :accounts="accounts"
      :currency="currency"
      :is-deleting="isDeleting"
      @confirm="handleDeleteTransactionAndClear"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>
