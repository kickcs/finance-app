<script setup lang="ts">
import { computed, ref } from 'vue';
import { useIntersectionObserver, useScroll } from '@vueuse/core';
import { AppHeader } from '@/widgets/header';
import {
  DebtCard,
  DebtDetailPanel,
  ClosedDebtCard,
  DebtsSummaryCard,
  PersonDebtRow,
  MutualDebtCard,
} from '@/entities/debt';
import { CloseAllDebtsDrawer, DeleteDebtModal, ReopenDebtModal } from '@/features/close-debt';
import { OffsetDebtsModal } from '@/features/offset-debts';
import { PaymentDrawer } from '@/features/partial-payment';
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
  filteredPerson,
  mutualPositions,
  allDebtsFromGroups,
  filteredDebts,
  totalGivenDebts,
  totalTakenDebts,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  showOffsetModal,
  offsetPosition,
  isOffsetting,
  showCloseAllDrawer,
  closeAllPersonName,
  closeAllDebtsForPerson,
  isClosing,
  progress,
  total,
  accounts,
  showDeleteModal,
  showReopenModal,
  reopenClosingRecords,
  isReopening,
  isPaymentOpen,
  paymentDraft,
  isDeleting,
  goBack,
  handleDebtClick,
  handlePersonClick,
  handleAddDebt,
  clearFilter,
  openCloseAllForPerson,
  handleCloseAll,
  openOffset,
  handleOffset,
  handleDetailPayment,
  handleDetailEdit,
  handleDetailDelete,
  handleDeleteDebt,
  handleDetailReopen,
  handleReopenDebt,
  submitPayment,
  handleDetailTogglePrivate,
  handleDetailClose,
  handleRefresh,
  toCurrencyItems,
} = useDebtsPageState();

/**
 * Единственный скроллер страницы живёт внутри MasterDetailLayout и отдаётся
 * наружу через expose — раньше страница искала его обходом parentElement в
 * onMounted, и любая правка вёрстки макета молча ломала pull-to-refresh.
 *
 * По нему же панель фильтров понимает, уехал ли под неё контент: разделитель
 * появляется только когда есть что отделять.
 */
const layoutRef = ref<InstanceType<typeof MasterDetailLayout> | null>(null);
const scrollEl = computed<HTMLElement | null>(() => layoutRef.value?.masterScrollEl ?? null);
const { y: scrollY } = useScroll(scrollEl);
const isScrolled = computed(() => scrollY.value > 4);

const showCurrencyChips = computed(() => availableCurrencies.value.length > 1);

// Infinite scroll sentinel
const sentinelRef = ref<HTMLElement | null>(null);

useIntersectionObserver(
  sentinelRef,
  ([{ isIntersecting }]) => {
    if (isIntersecting && hasNextPage.value && !isFetchingNextPage.value) {
      fetchNextPage();
    }
  },
  // Догружаем за экран до конца списка: на длинных списках людей спиннер внизу
  // при таком запасе просто не успевает показаться.
  { rootMargin: '400px' },
);
</script>

<template>
  <div
    class="h-full flex flex-col overflow-hidden bg-background-light dark:bg-background-dark relative"
  >
    <!-- Header -->
    <AppHeader blur show-back title="Долги" class="shrink-0" @back="goBack">
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
      ref="layoutRef"
      :selected="selectedDebtId"
      empty-icon="handshake"
      empty-text="Выберите долг для просмотра деталей"
      @close="handleDetailClose"
    >
      <template #master>
        <PullToRefresh :on-refresh="handleRefresh" :container-ref="scrollEl">
          <div :class="isDesktop ? 'pb-8' : 'pb-[calc(7rem+var(--safe-area-inset-bottom))]'">
            <!-- Панель управления липнет к верху скроллера: на длинном списке
                 людей переключатель «Активные/Закрытые» и фильтр валют раньше
                 уезжали вверх и возвращались только полной прокруткой назад.
                 Отрицательные поля растягивают подложку на всю ширину, чтобы
                 контент затекал под размытие, а не под пустое поле. -->
            <div
              :class="[
                'sticky top-0 z-10 pt-3 pb-3 space-y-2.5',
                'bg-background-light dark:bg-background-dark',
                'border-b transition-colors duration-150',
                isScrolled ? 'border-border-light dark:border-border-dark' : 'border-transparent',
                isDesktop ? '-ml-8 pl-8 -mr-4 pr-4' : '-mx-5 px-5',
              ]"
            >
              <UTabs
                v-model="statusFilter"
                :items="statusTabs"
                size="sm"
                @update:model-value="trigger('selection')"
              />

              <SelectChips
                v-if="showCurrencyChips"
                v-model="currencyFilter"
                :items="toCurrencyItems(availableCurrencies)"
                all-label="Все валюты"
              />
            </div>

            <div class="pt-4 space-y-5">
              <!-- Loading Skeleton -->
              <template v-if="isLoading">
                <template v-if="statusFilter === 'active'">
                  <div data-testid="debt-loading" class="space-y-5">
                    <Skeleton class="h-40 rounded-2xl" />
                    <div class="space-y-3">
                      <Skeleton class="h-6 w-32" />
                      <Skeleton class="h-[212px] rounded-2xl" />
                    </div>
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
                <!-- У встречных долгов карточка зачёта заменяет сводку: числа те же,
                     но она ещё и объясняет, что с ними можно сделать. -->
                <template v-if="mutualPositions.length > 0">
                  <MutualDebtCard
                    v-for="position in mutualPositions"
                    :key="position.currency"
                    :position="position"
                    :masked="filteredPerson?.hasPrivate"
                    :show-currency="mutualPositions.length > 1"
                    :is-offsetting="isOffsetting && offsetPosition?.currency === position.currency"
                    @offset="(trigger('selection'), openOffset(position))"
                  />
                </template>
                <DebtsSummaryCard
                  v-else-if="allDebtsFromGroups.length > 0"
                  :total-given="totalGivenDebts"
                  :total-taken="totalTakenDebts"
                  :currency="currency"
                  :title="personFilter ? `Итог: ${personFilter}` : 'Итог по всем'"
                />

                <!-- Debts List -->
                <div class="space-y-3">
                  <SectionHeader
                    :title="personFilter ? `Долги: ${personFilter}` : 'По людям'"
                    :count="personFilter ? filteredDebts.length : people.length"
                    :show-add="false"
                    :show-view-all="false"
                  >
                    <!-- Сброс фильтра переехал в заголовок секции: отдельная
                         плашка над ним дублировала имя человека, которое уже
                         стоит и в заголовке, и в сводке. -->
                    <template #badge>
                      <button
                        v-if="personFilter"
                        type="button"
                        class="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-2 text-caption text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        :aria-label="`Сбросить фильтр по ${personFilter}`"
                        data-testid="clear-filter-btn"
                        @click="clearFilter"
                      >
                        Все люди
                        <UIcon name="close" size="xs" />
                      </button>
                    </template>
                  </SectionHeader>

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
                      class="mt-3"
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
                <div v-if="allDebtsFromGroups.length > 0" class="space-y-3">
                  <SectionHeader
                    title="Погашенные долги"
                    :count="allDebtsFromGroups.length"
                    :show-add="false"
                    :show-view-all="false"
                  />
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
          @reopen="handleDetailReopen"
          @toggle-private="handleDetailTogglePrivate"
        />
      </template>
    </MasterDetailLayout>

    <!-- Modals -->
    <CloseAllDebtsDrawer
      v-model="showCloseAllDrawer"
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
    <ReopenDebtModal
      v-model="showReopenModal"
      :debt="selectedDebt"
      :closing-records="reopenClosingRecords"
      :accounts="accounts"
      :is-reopening="isReopening"
      @confirm="handleReopenDebt"
    />
    <OffsetDebtsModal
      v-model="showOffsetModal"
      :person-name="personFilter || ''"
      :position="offsetPosition"
      :masked="filteredPerson?.hasPrivate"
      :is-offsetting="isOffsetting"
      @confirm="handleOffset"
    />
    <PaymentDrawer
      v-model="isPaymentOpen"
      :debt="selectedDebt"
      :accounts="accounts"
      :draft="paymentDraft"
      @confirm="submitPayment"
    />
  </div>
</template>
