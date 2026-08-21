<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { USpinner, NotFoundState, UButton, UIcon, useToast } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';
import {
  useDebts,
  DebtDetailContent,
  DebtActionsSheet,
  useDebtTransactions,
  findClosingRecords,
  getDebtDisplayName,
  type Debt,
} from '@/entities/debt';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { useAccounts } from '@/entities/account';
import {
  DeleteDebtModal,
  ReopenDebtModal,
  useCloseDebt,
  useReopenDebt,
} from '@/features/close-debt';
import { useDebtPaymentFlow, PaymentDrawer } from '@/features/partial-payment';
import { EditDebtDrawer } from '@/features/edit-debt';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';

const router = useRouter();
const route = useRoute();
const { userId } = useCurrentUser();
const { trigger } = useHaptics();
const { toast } = useToast();
const debtId = computed(() => route.params.id as string);

// Get debts and accounts
const { debts, isLoading, updateDebt } = useDebts(userId);
const { accounts } = useAccounts(userId);

// Load transactions for this debt
const { transactions, isLoading: transactionsLoading } = useDebtTransactions(debtId);

// Find current debt
const debt = computed<Debt | null>(() => {
  return debts.value.find((d) => d.id === debtId.value) ?? null;
});

// Скрытый долг прячет имя человека везде, где оно показано (карточки списка,
// десктопная панель). Раньше маскировкой занимался DebtHero — теперь имя есть
// только в шапке, и маскировать его должна она.
const headerTitle = computed(() => {
  if (!debt.value) return 'Долг';
  return debt.value.is_private ? '•••' : getDebtDisplayName(debt.value);
});

// Modal states
const showDeleteModal = ref(false);
const showReopenModal = ref(false);

// Close debt logic
const { isDeleting, deleteDebt } = useCloseDebt();

// Payment drawer: общий поток шторки-платежа, шаренный с DebtsListPage
const {
  isOpen: isPaymentOpen,
  draft: paymentDraft,
  open: openPayment,
  submit: submitPayment,
} = useDebtPaymentFlow({
  userId,
  debt,
  onClosed: () => router.replace({ name: ROUTE_NAMES.DEBTS_LIST }),
});

async function handleDeleteDebt() {
  if (!debt.value || !userId.value) return;

  const success = await deleteDebt(debt.value, userId.value);
  if (success) {
    showDeleteModal.value = false;
    router.replace({ name: ROUTE_NAMES.DEBTS_LIST });
  }
}

// Отмена закрытия: единственный способ поправить долг, закрытый не тем способом
const { isReopening, reopenDebt } = useReopenDebt();

const closingRecords = computed(() => findClosingRecords(debt.value, transactions.value));

async function handleReopenDebt() {
  if (!debt.value || !userId.value) return;
  const success = await reopenDebt(debt.value.id, userId.value);
  if (success) showReopenModal.value = false;
}

const showEditDrawer = ref(false);
function handleEdit() {
  trigger('selection');
  showEditDrawer.value = true;
}

async function handleTogglePrivate(value: boolean) {
  if (!debt.value) return;
  try {
    await updateDebt(debt.value.id, { is_private: value });
  } catch {
    // updateDebt (useDebts) уже откатывает оптимистичный патч кэша сама — здесь только тост.
    toast({ title: 'Не удалось обновить', variant: 'error' });
  }
}

function goBack() {
  navigateBack();
}

// «Ещё» — шторка действий: «Редактировать» стоит своей кнопкой рядом
const isActionsOpen = ref(false);

function openActions() {
  trigger('selection');
  isActionsOpen.value = true;
}
</script>

<template>
  <div
    class="h-full flex flex-col overflow-hidden bg-background-light dark:bg-background-dark relative"
  >
    <!-- Header -->
    <AppHeader :title="headerTitle" show-back blur @back="goBack">
      <template v-if="debt" #actions>
        <UButton
          v-if="!debt.is_closed"
          variant="ghost"
          size="sm"
          class="!p-2"
          aria-label="Редактировать"
          @click="handleEdit"
        >
          <UIcon name="edit" size="sm" />
        </UButton>
        <UButton
          variant="ghost"
          size="sm"
          class="!p-2"
          aria-label="Ещё"
          data-testid="debt-more-btn"
          @click="openActions"
        >
          <UIcon name="more_horiz" size="sm" />
        </UButton>
      </template>
    </AppHeader>

    <!-- Content -->
    <main class="flex-1 overflow-y-auto">
      <div class="px-5 pt-4 pb-28 lg:pb-8">
        <!-- Loading State -->
        <div
          v-if="isLoading"
          data-testid="debt-loading"
          class="flex items-center justify-center py-12"
        >
          <USpinner />
        </div>

        <!-- Not Found State -->
        <NotFoundState v-else-if="!debt" data-testid="not-found" message="Долг не найден" />

        <!-- Debt Details -->
        <DebtDetailContent
          v-else
          :debt="debt"
          :transactions="transactions"
          :accounts="accounts"
          :transactions-loading="transactionsLoading"
          @payment="openPayment"
        />
      </div>
    </main>

    <!-- Actions Sheet -->
    <DebtActionsSheet
      v-if="debt"
      v-model="isActionsOpen"
      :debt="debt"
      @delete="showDeleteModal = true"
      @reopen="showReopenModal = true"
      @toggle-private="handleTogglePrivate"
    />

    <!-- Reopen Debt Modal -->
    <ReopenDebtModal
      v-model="showReopenModal"
      :debt="debt"
      :closing-records="closingRecords"
      :accounts="accounts"
      :is-reopening="isReopening"
      @confirm="handleReopenDebt"
    />

    <!-- Delete Debt Modal -->
    <DeleteDebtModal
      v-model="showDeleteModal"
      :debt="debt"
      :currency="debt?.currency || DEFAULT_CURRENCY"
      :is-deleting="isDeleting"
      @confirm="handleDeleteDebt"
    />

    <!-- Payment Drawer -->
    <PaymentDrawer
      v-model="isPaymentOpen"
      :debt="debt"
      :accounts="accounts"
      :draft="paymentDraft"
      @confirm="submitPayment"
    />

    <!-- Edit Debt Drawer -->
    <EditDebtDrawer
      :open="showEditDrawer"
      :debt="debt"
      @update:open="showEditDrawer = $event"
      @saved="showEditDrawer = false"
    />
  </div>
</template>
