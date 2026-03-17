<script setup lang="ts">
import { AppHeader } from '@/widgets/header';
import { DebtCard, DebtDetailPanel, ClosedDebtCard, DEBT_DIRECTION_DISPLAY } from '@/entities/debt';
import { CloseAllDebtsModal, DeleteDebtModal } from '@/features/close-debt';
import { PartialPaymentModal } from '@/features/partial-payment';
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from 'reka-ui';
import {
  UButton,
  UIcon,
  UCard,
  Skeleton,
  EmptyState,
  SectionHeader,
  UTabs,
  MasterDetailLayout,
  SelectChips,
} from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import { getInitial } from '@/shared/lib/format/text';
import { useDebtsPageState } from './useDebtsPageState';

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
  availableClosedCurrencies,
  selectedDebtId,
  selectedDebt,
  selectedDebtCurrency,
  activeDebts,
  closedDebts,
  debtsByPerson,
  totalGivenDebts,
  totalTakenDebts,
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
  handleAddDebt,
  clearFilter,
  isGroupDefaultOpen,
  openCloseAllForPerson,
  handleCloseAll,
  handleDetailPayment,
  handleDetailEdit,
  handleDetailDelete,
  handleDeleteDebt,
  handlePartialPayment,
  handleDetailTogglePrivate,
  handleDetailClose,
} = useDebtsPageState();
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark pb-28 md:pb-8 overflow-hidden"
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
          @click="handleAddDebt"
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
        <div class="pt-8 space-y-6">
          <!-- Status Tabs -->
          <UTabs v-model="statusFilter" :items="statusTabs" size="sm" />

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
            <!-- Summary Cards -->
            <div v-if="activeDebts.length > 0" class="grid grid-cols-2 gap-3">
              <UCard
                data-testid="summary-given"
                class="p-4 relative overflow-hidden"
                variant="bordered"
              >
                <div
                  class="absolute -right-4 -top-4 w-16 h-16 bg-debt-given/10 rounded-full blur-xl pointer-events-none"
                />
                <p
                  class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1"
                >
                  Вам должны
                </p>
                <p class="text-lg font-bold text-debt-given tracking-tight">
                  {{ formatCurrency(totalGivenDebts, currency) }}
                </p>
              </UCard>
              <UCard
                data-testid="summary-taken"
                class="p-4 relative overflow-hidden"
                variant="bordered"
              >
                <div
                  class="absolute -right-4 -top-4 w-16 h-16 bg-debt-received/10 rounded-full blur-xl pointer-events-none"
                />
                <p
                  class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1"
                >
                  Вы должны
                </p>
                <p class="text-lg font-bold text-debt-received tracking-tight">
                  {{ formatCurrency(totalTakenDebts, currency) }}
                </p>
              </UCard>
            </div>

            <!-- Currency Filter Chips -->
            <SelectChips
              v-if="availableCurrencies.length > 1"
              v-model="currencyFilter"
              :items="availableCurrencies.map((c) => ({ id: c, label: c }))"
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
                :title="personFilter ? `Долги: ${personFilter}` : 'Активные долги'"
                :show-add="false"
                :show-view-all="false"
              />

              <!-- Groups by Person -->
              <div v-if="activeDebts.length > 0" class="space-y-2">
                <template
                  v-for="group in debtsByPerson"
                  :key="`${group.personName}_${group.debtType}`"
                >
                  <!-- Single debt — flat card -->
                  <DebtCard
                    v-if="group.debts.length === 1"
                    :debt="group.debts[0]"
                    :class="
                      isDesktop &&
                      selectedDebtId === group.debts[0].id &&
                      'ring-2 ring-primary ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark'
                    "
                    @click="handleDebtClick(group.debts[0])"
                  />

                  <!-- Multiple debts — collapsible -->
                  <CollapsibleRoot
                    v-else
                    v-slot="{ open }"
                    :default-open="isGroupDefaultOpen(group)"
                  >
                    <CollapsibleTrigger
                      class="flex items-center gap-2.5 w-full p-3 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark cursor-pointer hover:bg-surface-light dark:hover:bg-surface-dark transition-colors text-left"
                    >
                      <UIcon
                        name="chevron_right"
                        size="xs"
                        class="text-text-tertiary-light dark:text-text-tertiary-dark transition-transform duration-200 shrink-0"
                        :class="open ? 'rotate-90' : ''"
                      />
                      <div
                        class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                        :class="
                          group.debtType === 'given'
                            ? 'bg-debt-given-light text-debt-given'
                            : 'bg-debt-received-light text-debt-received'
                        "
                      >
                        {{ getInitial(group.personName) }}
                      </div>
                      <div class="flex-1 min-w-0">
                        <p
                          class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
                        >
                          {{ group.personName }}
                        </p>
                        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                          {{ group.debts.length }}
                          {{ pluralize(group.debts.length, 'долг', 'долга', 'долгов') }} ·
                          {{ DEBT_DIRECTION_DISPLAY[group.debtType] }}
                        </p>
                      </div>
                      <p
                        class="text-sm font-bold shrink-0"
                        :class="
                          group.debtType === 'given' ? 'text-debt-given' : 'text-debt-received'
                        "
                      >
                        {{
                          group.hasPrivate
                            ? '••••'
                            : `${group.totalRemainingDisplay.approximate ? '≈ ' : ''}${formatCurrency(group.totalRemainingDisplay.amount, group.totalRemainingDisplay.currency)}`
                        }}
                      </p>
                    </CollapsibleTrigger>

                    <CollapsibleContent class="CollapsibleContent">
                      <div
                        class="ml-5 pl-3 border-l-2 border-border-light dark:border-border-dark mt-1 space-y-1"
                      >
                        <DebtCard
                          v-for="debt in group.debts"
                          :key="debt.id"
                          :debt="debt"
                          compact
                          :class="
                            isDesktop &&
                            selectedDebtId === debt.id &&
                            'ring-2 ring-primary ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark'
                          "
                          @click="handleDebtClick(debt)"
                        />
                        <UButton
                          variant="secondary"
                          size="sm"
                          full-width
                          @click="openCloseAllForPerson(group.personName)"
                        >
                          <UIcon name="check_circle" size="xs" />
                          Закрыть все долги
                        </UButton>
                      </div>
                    </CollapsibleContent>
                  </CollapsibleRoot>
                </template>
              </div>

              <!-- Close All (person filter) -->
              <UButton
                v-if="personFilter && activeDebts.length > 1"
                variant="primary"
                full-width
                data-testid="close-all-btn"
                @click="showCloseAllModal = true"
              >
                <UIcon name="check_circle" size="sm" />
                Закрыть все долги
              </UButton>

              <!-- Empty State -->
              <UCard v-if="activeDebts.length === 0" data-testid="empty-state" class="py-4">
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
              v-if="availableClosedCurrencies.length > 1"
              v-model="currencyFilter"
              :items="availableClosedCurrencies.map((c) => ({ id: c, label: c }))"
              all-label="Все валюты"
            />
            <div v-if="closedDebts.length > 0" class="space-y-3">
              <SectionHeader title="Погашенные долги" :show-add="false" :show-view-all="false" />
              <div class="space-y-2">
                <ClosedDebtCard
                  v-for="debt in closedDebts"
                  :key="debt.id"
                  :debt="debt"
                  :user-currency="currency"
                  :class="
                    isDesktop &&
                    selectedDebtId === debt.id &&
                    'ring-2 ring-primary ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark'
                  "
                  @click="handleDebtClick(debt)"
                />
              </div>
            </div>
            <UCard v-else data-testid="closed-empty-state" class="py-4">
              <EmptyState
                icon="history"
                title="Нет закрытых долгов"
                description="Здесь будут погашенные долги"
                icon-bg-class="bg-surface-light dark:bg-surface-dark text-text-tertiary-light dark:text-text-tertiary-dark"
              />
            </UCard>
          </template>
        </div>
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

<style scoped>
.CollapsibleContent {
  overflow: hidden;
}
.CollapsibleContent[data-state='open'] {
  animation: slideDown 200ms ease-out;
}
.CollapsibleContent[data-state='closed'] {
  animation: slideUp 200ms ease-out;
}

@keyframes slideDown {
  from {
    height: 0;
  }
  to {
    height: var(--reka-collapsible-content-height);
  }
}
@keyframes slideUp {
  from {
    height: var(--reka-collapsible-content-height);
  }
  to {
    height: 0;
  }
}
</style>
