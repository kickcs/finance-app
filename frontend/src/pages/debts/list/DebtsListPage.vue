<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { AppHeader } from '@/widgets/header';
import { DebtCard, DebtDetailPanel, useDebts, type Debt } from '@/entities/debt';
import { useAccounts } from '@/entities/account';
import { CloseAllDebtsModal, useCloseAllDebts } from '@/features/close-debt';
import { DeleteDebtModal, useCloseDebt } from '@/features/close-debt';
import { PartialPaymentModal, usePartialPayment } from '@/features/partial-payment';
import {
  UButton,
  UIcon,
  UCard,
  Skeleton,
  EmptyState,
  SectionHeader,
  UTabs,
  useToast,
  MasterDetailLayout,
} from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useExchangeRates } from '@/shared/api';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { DEFAULT_CURRENCY } from '@/entities/currency/model/constants';
import { listTransition } from '@/shared/lib/transitions';
const router = useRouter();
const route = useRoute();
const isDesktop = useIsDesktop();

const { userId } = useCurrentUser();
const { currency } = useUserCurrency();
const { toast } = useToast();

// Exchange rates for converting debts to user's main currency
const { convert } = useExchangeRates(currency);

// Use real data from API
const { debts, debtsByPerson, isLoading } = useDebts(userId);

// Filter by person from query params
const personFilter = ref<string | null>(route.query.person as string | null);
const typeFilter = ref<'given' | 'taken' | null>(route.query.type as 'given' | 'taken' | null);

// View mode toggle: grouped by person or flat list
const viewMode = ref<'grouped' | 'flat'>(personFilter.value ? 'flat' : 'grouped');

// Status filter: active or closed
const statusFilter = ref<'active' | 'closed'>('active');
const statusTabs = [
  { id: 'active', label: 'Активные' },
  { id: 'closed', label: 'Закрытые' },
];

// Selected debt for desktop detail panel
const selectedDebtId = ref<string | null>(null);

// Find selected debt for detail panel modals
const selectedDebt = computed<Debt | null>(() => {
  if (!selectedDebtId.value) return null;
  return debts.value.find((d) => d.id === selectedDebtId.value) ?? null;
});

const selectedDebtCurrency = computed(() => selectedDebt.value?.currency || DEFAULT_CURRENCY);

// Clear filter when route changes
watch(
  () => route.query,
  (newQuery) => {
    personFilter.value = newQuery.person as string | null;
    typeFilter.value = newQuery.type as 'given' | 'taken' | null;
    if (personFilter.value) {
      viewMode.value = 'flat';
    }
  },
);

// Filter active debts
const activeDebts = computed(() => {
  let filtered = debts.value.filter((d) => !d.is_closed);

  // Apply person filter if set
  if (personFilter.value) {
    filtered = filtered.filter(
      (d) =>
        (d.person_name || d.name) === personFilter.value &&
        (!typeFilter.value || d.debt_type === typeFilter.value),
    );
  }

  return filtered;
});

// Closed debts
const closedDebts = computed(() => {
  return debts.value.filter((d) => d.is_closed);
});

// Clear filter
function clearFilter() {
  personFilter.value = null;
  typeFilter.value = null;
  router.replace({ path: '/debts' });
}

// Calculate totals - converted to main currency
const totalGivenDebts = computed(() => {
  return activeDebts.value
    .filter((d) => d.debt_type === 'given')
    .reduce((sum, d) => sum + convert(d.remaining_amount, d.currency || DEFAULT_CURRENCY), 0);
});

const totalTakenDebts = computed(() => {
  return activeDebts.value
    .filter((d) => d.debt_type === 'taken')
    .reduce((sum, d) => sum + convert(d.remaining_amount, d.currency || DEFAULT_CURRENCY), 0);
});

function goBack() {
  navigateBack();
}

function handleDebtClick(debt: Debt) {
  if (isDesktop.value) {
    selectedDebtId.value = debt.id;
  } else {
    router.push({ name: ROUTE_NAMES.DEBT_DETAIL, params: { id: debt.id } });
  }
}

function handleAddDebt() {
  router.push({ name: ROUTE_NAMES.NEW_DEBT });
}

// Close all debts for a person
const { accounts } = useAccounts(userId);
const { isClosing, progress, total, closeAllDebts } = useCloseAllDebts();
const showCloseAllModal = ref(false);

async function handleCloseAll(
  accountId: string,
  options: { paymentAmount: number; forgiveRemainder?: boolean; excessCategoryId?: string },
) {
  if (!userId.value) return;
  const success = await closeAllDebts(activeDebts.value, accountId, userId.value, options);
  if (success) {
    showCloseAllModal.value = false;
    toast({
      title:
        options.forgiveRemainder && options.paymentAmount === 0
          ? 'Все долги прощены'
          : options.forgiveRemainder
            ? 'Долги закрыты и прощены'
            : 'Все долги закрыты',
      variant: 'success',
    });
    clearFilter();
  } else {
    toast({ title: 'Ошибка при закрытии долгов', variant: 'error' });
  }
}

// Detail panel modals
const showDeleteModal = ref(false);
const showPartialPaymentModal = ref(false);

const { isDeleting, deleteDebt } = useCloseDebt();
const { isPaying, makePartialPayment } = usePartialPayment();

function handleDetailPayment() {
  showPartialPaymentModal.value = true;
}

function handleDetailEdit() {
  if (selectedDebtId.value) {
    router.push({ name: ROUTE_NAMES.DEBT_DETAIL, params: { id: selectedDebtId.value } });
  }
}

function handleDetailDelete() {
  showDeleteModal.value = true;
}

async function handleDeleteDebt() {
  if (!selectedDebt.value || !userId.value) return;

  const success = await deleteDebt(selectedDebt.value, userId.value);
  if (success) {
    showDeleteModal.value = false;
    selectedDebtId.value = null;
  }
}

async function handlePartialPayment(
  amount: number,
  accountId: string,
  options: { forgiveRemainder?: boolean; excessCategoryId?: string } = {},
) {
  if (!selectedDebt.value || !userId.value) return;

  const willClose = amount >= selectedDebt.value.remaining_amount || options.forgiveRemainder;
  const success = await makePartialPayment(
    selectedDebt.value,
    amount,
    accountId,
    userId.value,
    options,
  );
  if (success) {
    showPartialPaymentModal.value = false;
    if (willClose) {
      selectedDebtId.value = null;
    }
  }
}

function handleDetailClose() {
  selectedDebtId.value = null;
}
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
        <!-- Content -->
        <div class="pt-8 space-y-6">
          <!-- Status Tabs -->
          <UTabs v-model="statusFilter" :items="statusTabs" size="sm" />

          <!-- Loading Skeleton -->
          <template v-if="isLoading">
            <template v-if="statusFilter === 'active'">
              <div class="grid grid-cols-2 gap-3">
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

          <template v-else-if="statusFilter === 'active'">
            <!-- Debt Summary Cards (converted to main currency) -->
            <div v-if="activeDebts.length > 0" class="grid grid-cols-2 gap-3">
              <!-- Given debts (people owe you) -->
              <UCard class="p-4 relative overflow-hidden" variant="bordered">
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

              <!-- Taken debts (you owe others) -->
              <UCard class="p-4 relative overflow-hidden" variant="bordered">
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

            <!-- Debts List -->
            <div class="space-y-3">
              <!-- Filter indicator -->
              <div v-if="personFilter" class="flex items-center gap-2 px-1">
                <div
                  class="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm"
                >
                  <span>{{ personFilter }}</span>
                  <button
                    type="button"
                    class="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30"
                    :aria-label="`Сбросить фильтр по ${personFilter}`"
                    @click="clearFilter"
                  >
                    <UIcon name="close" size="xs" />
                  </button>
                </div>
              </div>

              <div class="flex items-center justify-between">
                <SectionHeader
                  :title="personFilter ? `Долги: ${personFilter}` : 'Активные долги'"
                  :show-add="false"
                  :show-view-all="false"
                />
                <!-- View Mode Toggle (hidden when filtering by person) -->
                <div
                  v-if="activeDebts.length > 0 && !personFilter"
                  role="group"
                  aria-label="Режим отображения долгов"
                  class="flex gap-1 bg-surface-light dark:bg-surface-dark rounded-lg p-1"
                >
                  <button
                    type="button"
                    :aria-pressed="viewMode === 'grouped'"
                    class="px-3 py-1 text-sm font-medium rounded-md transition-colors"
                    :class="
                      viewMode === 'grouped'
                        ? 'bg-card-light dark:bg-card-dark text-text-primary-light dark:text-text-primary-dark shadow-sm'
                        : 'text-text-secondary-light dark:text-text-secondary-dark'
                    "
                    @click="viewMode = 'grouped'"
                  >
                    По людям
                  </button>
                  <button
                    type="button"
                    :aria-pressed="viewMode === 'flat'"
                    class="px-3 py-1 text-sm font-medium rounded-md transition-colors"
                    :class="
                      viewMode === 'flat'
                        ? 'bg-card-light dark:bg-card-dark text-text-primary-light dark:text-text-primary-dark shadow-sm'
                        : 'text-text-secondary-light dark:text-text-secondary-dark'
                    "
                    @click="viewMode = 'flat'"
                  >
                    Все
                  </button>
                </div>
              </div>

              <!-- Grouped View (by person) -->
              <div v-if="activeDebts.length > 0 && viewMode === 'grouped'" class="space-y-4">
                <div v-for="group in debtsByPerson" :key="group.personName" class="space-y-2">
                  <!-- Person Header -->
                  <div class="flex items-center justify-between px-1">
                    <div class="flex items-center gap-2">
                      <div
                        class="w-8 h-8 rounded-full flex items-center justify-center"
                        :class="
                          group.debtType === 'given'
                            ? 'bg-debt-given-light'
                            : 'bg-debt-received-light'
                        "
                      >
                        <UIcon
                          name="person"
                          size="sm"
                          :class="
                            group.debtType === 'given' ? 'text-debt-given' : 'text-debt-received'
                          "
                        />
                      </div>
                      <div>
                        <p
                          class="font-semibold text-text-primary-light dark:text-text-primary-dark"
                        >
                          {{ group.personName }}
                        </p>
                        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                          {{ group.debtType === 'given' ? 'Вам должны' : 'Вы должны' }}
                        </p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p
                        class="font-bold"
                        :class="
                          group.debtType === 'given' ? 'text-debt-given' : 'text-debt-received'
                        "
                      >
                        {{ formatCurrency(group.totalRemaining, currency) }}
                      </p>
                      <p v-if="group.totalPaid > 0" class="text-xs text-success">
                        Выплачено: {{ formatCurrency(group.totalPaid, currency) }}
                      </p>
                    </div>
                  </div>

                  <!-- Debts for this person -->
                  <div class="space-y-2 ml-10">
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
                  </div>
                </div>
              </div>

              <!-- Flat View (all debts) -->
              <TransitionGroup
                v-else-if="activeDebts.length > 0 && viewMode === 'flat'"
                tag="div"
                class="space-y-2"
                :enter-active-class="listTransition.enterActiveClass"
                :leave-active-class="listTransition.leaveActiveClass"
                :enter-from-class="listTransition.enterFromClass"
                :leave-to-class="listTransition.leaveToClass"
                :move-class="listTransition.moveClass"
              >
                <DebtCard
                  v-for="debt in activeDebts"
                  :key="debt.id"
                  :debt="debt"
                  :class="
                    isDesktop &&
                    selectedDebtId === debt.id &&
                    'ring-2 ring-primary ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark'
                  "
                  @click="handleDebtClick(debt)"
                />
              </TransitionGroup>

              <!-- Close All Button (when filtering by person) -->
              <UButton
                v-if="personFilter && activeDebts.length > 1"
                variant="primary"
                full-width
                @click="showCloseAllModal = true"
              >
                <UIcon name="check_circle" size="sm" />
                Закрыть все долги
              </UButton>

              <!-- Empty State -->
              <UCard v-if="activeDebts.length === 0" class="py-4">
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

          <!-- Closed Debts -->
          <template v-else-if="statusFilter === 'closed'">
            <div v-if="closedDebts.length > 0" class="space-y-3">
              <SectionHeader title="Погашенные долги" :show-add="false" :show-view-all="false" />

              <TransitionGroup
                tag="div"
                class="space-y-2"
                :enter-active-class="listTransition.enterActiveClass"
                :leave-active-class="listTransition.leaveActiveClass"
                :enter-from-class="listTransition.enterFromClass"
                :leave-to-class="listTransition.leaveToClass"
                :move-class="listTransition.moveClass"
              >
                <DebtCard
                  v-for="debt in closedDebts"
                  :key="debt.id"
                  :debt="debt"
                  :class="
                    isDesktop &&
                    selectedDebtId === debt.id &&
                    'ring-2 ring-primary ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark'
                  "
                  @click="handleDebtClick(debt)"
                />
              </TransitionGroup>
            </div>

            <UCard v-else class="py-4">
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
        />
      </template>
    </MasterDetailLayout>

    <!-- Close All Debts Modal -->
    <CloseAllDebtsModal
      v-model="showCloseAllModal"
      :debts="activeDebts"
      :person-name="personFilter || ''"
      :accounts="accounts"
      :is-closing="isClosing"
      :progress="progress"
      :total="total"
      @confirm="handleCloseAll"
    />

    <!-- Delete Debt Modal (for detail panel) -->
    <DeleteDebtModal
      v-model="showDeleteModal"
      :debt="selectedDebt"
      :currency="selectedDebtCurrency"
      :is-deleting="isDeleting"
      @confirm="handleDeleteDebt"
    />

    <!-- Partial Payment Modal (for detail panel) -->
    <PartialPaymentModal
      v-model="showPartialPaymentModal"
      :debt="selectedDebt"
      :accounts="accounts"
      :is-paying="isPaying"
      @confirm="handlePartialPayment"
    />
  </div>
</template>
