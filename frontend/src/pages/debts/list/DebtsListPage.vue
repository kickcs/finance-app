<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useIntersectionObserver } from '@vueuse/core';
import { AppHeader } from '@/widgets/header';
import {
  DebtCard,
  DebtDetailPanel,
  ClosedDebtCard,
  DebtsSummaryCard,
  PersonDebtRow,
} from '@/entities/debt';
import { CloseAllDebtsModal, DeleteDebtModal } from '@/features/close-debt';
import { PartialPaymentModal } from '@/features/partial-payment';
import {
  UButton,
  UIcon,
  UCard,
  USpinner,
  Skeleton,
  EmptyState,
  SectionHeader,
  UTabs,
  MasterDetailLayout,
  SelectChips,
  PullToRefresh,
} from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import { useDebtsPageState } from './useDebtsPageState';

const { trigger } = useHaptics();

const currencyFilterEmptyProps = {
  icon: 'filter_list',
  title: 'Нет долгов в этой валюте',
  description: 'Попробуйте выбрать другую валюту или сбросить фильтр',
  iconBgClass:
    'bg-surface-light dark:bg-surface-dark text-text-tertiary-light dark:text-text-tertiary-dark',
} as const;

// PullToRefresh: find scroll container from MasterDetailLayout
const masterContentRef = ref<HTMLElement | null>(null);
const scrollContainerRef = ref<HTMLElement | null>(null);

onMounted(() => {
  if (masterContentRef.value) {
    let el: HTMLElement | null = masterContentRef.value.parentElement;
    while (el) {
      const style = getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollContainerRef.value = el;
        break;
      }
      el = el.parentElement;
    }
  }
});

// Infinite scroll sentinel
const sentinelRef = ref<HTMLElement | null>(null);

const {
  userId,
  currency,
  isLoading,
  isDesktop,
  statusFilter,
  statusTabs,
  personFilter,
  currencyFilter,
  availableCurrencies,
  selectedDebtId,
  selectedDebt,
  selectedDebtCurrency,
  people,
  allDebtsFromGroups,
  filteredDebts,
  totalGivenDebts,
  totalTakenDebts,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  showCloseAllModal,
  closeAllPersonName,
  closeAllDebtsForPerson,
  isClosing,
  progress,
  total,
  accounts,
  showDeleteModal,
  showPartialPaymentModal,
  isDeleting,
  isPaying,
  goBack,
  handleDebtClick,
  handlePersonClick,
  handleAddDebt,
  clearFilter,
  openCloseAllForPerson,
  handleCloseAll,
  handleDetailPayment,
  handleDetailEdit,
  handleDetailDelete,
  handleDeleteDebt,
  handlePartialPayment,
  handleDetailTogglePrivate,
  handleDetailClose,
  handleRefresh,
  toCurrencyItems,
} = useDebtsPageState();

useIntersectionObserver(
  sentinelRef,
  ([{ isIntersecting }]) => {
    if (isIntersecting && hasNextPage.value && !isFetchingNextPage.value) {
      fetchNextPage();
    }
  },
  { rootMargin: '200px' },
);
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark pb-28 lg:pb-8 overflow-hidden"
  >
    <!-- Header -->
    <AppHeader blur show-back title="Долги" @back="goBack">
      <template #actions>
        <UButton
          variant="ghost"
          size="sm"
          class="!p-2"
          aria-label="Добавить долг"
          data-testid="add-debt-btn"
          @click="(trigger('selection'), handleAddDebt())"
        >
          <UIcon name="add" size="sm" />
        </UButton>
      </template>
    </AppHeader>

    <MasterDetailLayout
      :selected="selectedDebtId"
      empty-icon="handshake"
      empty-text="Выберите долг для просмотра деталей"
      @close="handleDetailClose"
    >
      <template #master>
        <PullToRefresh :on-refresh="handleRefresh" :container-ref="scrollContainerRef">
          <div ref="masterContentRef" class="pt-8 space-y-6">
            <!-- Status Tabs -->
            <UTabs
              v-model="statusFilter"
              :items="statusTabs"
              size="sm"
              @update:model-value="trigger('selection')"
            />

            <!-- Loading Skeleton -->
            <template v-if="isLoading">
              <template v-if="statusFilter === 'active'">
                <div data-testid="debt-loading" class="grid grid-cols-2 gap-3">
                  <Skeleton class="h-20 rounded-2xl" />
                  <Skeleton class="h-20 rounded-2xl" />
                </div>
                <div class="space-y-3">
                  <Skeleton class="h-6 w-32" />
                  <Skeleton class="h-16 rounded-xl" />
                  <Skeleton class="h-16 rounded-xl" />
                  <Skeleton class="h-16 rounded-xl" />
                </div>
              </template>
              <div v-else class="space-y-3">
                <Skeleton class="h-6 w-40" />
                <Skeleton class="h-16 rounded-xl" />
                <Skeleton class="h-16 rounded-xl" />
              </div>
            </template>

            <!-- Active Debts Tab -->
            <template v-else-if="statusFilter === 'active'">
              <DebtsSummaryCard
                v-if="allDebtsFromGroups.length > 0"
                :total-given="totalGivenDebts"
                :total-taken="totalTakenDebts"
                :currency="currency"
              />

              <!-- Currency Filter Chips -->
              <SelectChips
                v-if="availableCurrencies.length > 1"
                v-model="currencyFilter"
                :items="toCurrencyItems(availableCurrencies)"
                all-label="Все валюты"
              />

              <!-- Debts List -->
              <div class="space-y-3">
                <!-- Person Filter Indicator -->
                <div v-if="personFilter" class="flex items-center gap-2 px-1">
                  <div
                    class="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm"
                  >
                    <span>{{ personFilter }}</span>
                    <button
                      type="button"
                      class="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30"
                      :aria-label="`Сбросить фильтр по ${personFilter}`"
                      data-testid="clear-filter-btn"
                      @click="clearFilter"
                    >
                      <UIcon name="close" size="xs" />
                    </button>
                  </div>
                </div>

                <SectionHeader
                  :title="personFilter ? `Долги: ${personFilter}` : 'По людям'"
                  :show-add="false"
                  :show-view-all="false"
                />

                <!-- People: one row per person, netted -->
                <div
                  v-if="!personFilter && people.length > 0"
                  class="rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark overflow-hidden divide-y divide-border-light dark:divide-border-dark"
                >
                  <PersonDebtRow
                    v-for="person in people"
                    :key="person.personName"
                    :person="person"
                    :currency="currency"
                    :selected="isDesktop && person.debts.some((d) => d.id === selectedDebtId)"
                    @click="(trigger('selection'), handlePersonClick(person))"
                  />
                </div>

                <!-- Filtered by person: their debts, flat -->
                <div v-else-if="personFilter && filteredDebts.length > 0" class="space-y-2">
                  <DebtCard
                    v-for="debt in filteredDebts"
                    :key="debt.id"
                    :debt="debt"
                    :class="
                      isDesktop &&
                      selectedDebtId === debt.id &&
                      'ring-2 ring-primary ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark'
                    "
                    @click="(trigger('selection'), handleDebtClick(debt))"
                  />
                  <UButton
                    v-if="filteredDebts.length > 1"
                    variant="secondary"
                    full-width
                    data-testid="close-all-btn"
                    @click="(trigger('selection'), openCloseAllForPerson(personFilter))"
                  >
                    <UIcon name="check_circle" size="sm" />
                    Закрыть все долги
                  </UButton>
                </div>

                <!-- Empty State: filtered by currency -->
                <UCard v-else-if="currencyFilter" data-testid="empty-state-filtered" class="py-4">
                  <EmptyState v-bind="currencyFilterEmptyProps" />
                </UCard>

                <!-- Empty State: no debts at all -->
                <UCard v-else data-testid="empty-state" class="py-4">
                  <EmptyState
                    icon="celebration"
                    title="Вы без долгов!"
                    description="Отличная финансовая дисциплина"
                    icon-bg-class="bg-success/10 text-success"
                    :action="{ label: 'Создать долг', onClick: handleAddDebt }"
                  />
                </UCard>
              </div>
            </template>

            <!-- Closed Debts Tab -->
            <template v-else-if="statusFilter === 'closed'">
              <!-- Currency Filter Chips -->
              <SelectChips
                v-if="availableCurrencies.length > 1"
                v-model="currencyFilter"
                :items="toCurrencyItems(availableCurrencies)"
                all-label="Все валюты"
              />
              <div v-if="allDebtsFromGroups.length > 0" class="space-y-3">
                <SectionHeader title="Погашенные долги" :show-add="false" :show-view-all="false" />
                <div class="space-y-1.5">
                  <ClosedDebtCard
                    v-for="debt in allDebtsFromGroups"
                    :key="debt.id"
                    :debt="debt"
                    :user-currency="currency"
                    :class="
                      isDesktop &&
                      selectedDebtId === debt.id &&
                      'ring-2 ring-primary ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark'
                    "
                    @click="(trigger('selection'), handleDebtClick(debt))"
                  />
                </div>
              </div>
              <!-- Empty State: filtered by currency -->
              <UCard
                v-else-if="currencyFilter"
                data-testid="closed-empty-state-filtered"
                class="py-4"
              >
                <EmptyState v-bind="currencyFilterEmptyProps" />
              </UCard>
              <UCard v-else data-testid="closed-empty-state" class="py-4">
                <EmptyState
                  icon="history"
                  title="Нет закрытых долгов"
                  description="Здесь будут погашенные долги"
                  icon-bg-class="bg-surface-light dark:bg-surface-dark text-text-tertiary-light dark:text-text-tertiary-dark"
                />
              </UCard>
            </template>

            <!-- Infinite scroll sentinel (shared across tabs) -->
            <div ref="sentinelRef" class="h-1" />
            <div v-if="isFetchingNextPage" class="flex justify-center py-4">
              <USpinner size="sm" />
            </div>
          </div>
        </PullToRefresh>
      </template>

      <template #detail>
        <DebtDetailPanel
          v-if="selectedDebtId && userId"
          :debt-id="selectedDebtId"
          :user-id="userId"
          @payment="handleDetailPayment"
          @edit="handleDetailEdit"
          @delete="handleDetailDelete"
          @toggle-private="handleDetailTogglePrivate"
        />
      </template>
    </MasterDetailLayout>

    <!-- Modals -->
    <CloseAllDebtsModal
      v-model="showCloseAllModal"
      :debts="closeAllDebtsForPerson"
      :person-name="closeAllPersonName || personFilter || ''"
      :accounts="accounts"
      :is-closing="isClosing"
      :progress="progress"
      :total="total"
      @confirm="handleCloseAll"
    />
    <DeleteDebtModal
      v-model="showDeleteModal"
      :debt="selectedDebt"
      :currency="selectedDebtCurrency"
      :is-deleting="isDeleting"
      @confirm="handleDeleteDebt"
    />
    <PartialPaymentModal
      v-model="showPartialPaymentModal"
      :debt="selectedDebt"
      :accounts="accounts"
      :is-paying="isPaying"
      @confirm="handlePartialPayment"
    />
  </div>
</template>
