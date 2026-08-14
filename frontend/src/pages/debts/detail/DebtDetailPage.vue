<script setup lang="ts">
import { ref, computed } from 'vue';
import { onClickOutside, onKeyStroke } from '@vueuse/core';
import { useRouter, useRoute } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { USpinner, NotFoundState, UButton, UIcon, UToggle, useToast } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';
import {
  useDebts,
  DebtDetailContent,
  useDebtTransactions,
  getDebtDisplayName,
  type Debt,
} from '@/entities/debt';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { useAccounts } from '@/entities/account';
import { DeleteDebtModal, useCloseDebt } from '@/features/close-debt';
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

const showEditDrawer = ref(false);
function handleEdit() {
  trigger('selection');
  isMoreMenuOpen.value = false;
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

// «Ещё»-меню шапки: «Редактировать» — своя кнопка, здесь — скрыть сумму и удаление
const isMoreMenuOpen = ref(false);
// Меню висит поверх контента, поэтому закрывается как оверлей, а не только повторным тапом
const moreMenuRef = ref<HTMLElement | null>(null);
onClickOutside(moreMenuRef, () => (isMoreMenuOpen.value = false));
onKeyStroke('Escape', () => (isMoreMenuOpen.value = false));

function handleDeleteFromMenu() {
  trigger('selection');
  isMoreMenuOpen.value = false;
  showDeleteModal.value = true;
}
</script>

<template>
  <div
    class="h-full flex flex-col overflow-hidden bg-background-light dark:bg-background-dark relative"
  >
    <!-- Header -->
    <div ref="moreMenuRef" class="relative">
      <AppHeader :title="headerTitle" show-back blur @back="goBack">
        <template v-if="debt && !debt.is_closed" #actions>
          <UButton
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
            aria-controls="debt-detail-more-menu"
            :aria-expanded="isMoreMenuOpen"
            data-testid="debt-more-btn"
            @click="(trigger('selection'), (isMoreMenuOpen = !isMoreMenuOpen))"
          >
            <UIcon name="more_horiz" size="sm" />
          </UButton>
        </template>
      </AppHeader>

      <!-- Выпадает поверх контента, а не внутри потока — иначе открытие меню двигало бы всю страницу -->
      <div
        v-if="isMoreMenuOpen && debt && !debt.is_closed"
        id="debt-detail-more-menu"
        class="absolute inset-x-5 top-full z-20 mt-2 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark shadow-lg p-1"
      >
        <div class="flex items-center justify-between gap-4 px-3 py-2.5">
          <span class="flex items-center gap-2.5">
            <UIcon
              name="visibility_off"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark"
            />
            <span class="text-body-sm text-text-primary-light dark:text-text-primary-dark">
              Скрыть сумму
            </span>
          </span>
          <UToggle :model-value="debt.is_private" @update:model-value="handleTogglePrivate" />
        </div>

        <button
          type="button"
          data-testid="delete-debt-btn"
          class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-body-sm text-danger transition-colors hover:bg-surface-light dark:hover:bg-surface-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          @click="handleDeleteFromMenu"
        >
          <UIcon name="delete" size="sm" />
          Удалить долг
        </button>
      </div>
    </div>

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
          @delete="showDeleteModal = true"
          @toggle-private="handleTogglePrivate"
        />
      </div>
    </main>

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
