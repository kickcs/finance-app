<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { USpinner, NotFoundState } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';
import { useDebts, DebtDetailContent, useDebtTransactions, type Debt } from '@/entities/debt';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { useAccounts } from '@/entities/account';
import { DeleteDebtModal, useCloseDebt } from '@/features/close-debt';
import { PartialPaymentModal, usePartialPayment } from '@/features/partial-payment';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';

const router = useRouter();
const route = useRoute();
const { userId } = useCurrentUser();
const debtId = computed(() => route.params.id as string);

// Get debts and accounts
const { debts, isLoading } = useDebts(userId);
const { accounts } = useAccounts(userId);

// Load transactions for this debt
const { transactions, isLoading: transactionsLoading } = useDebtTransactions(debtId);

// Find current debt
const debt = computed<Debt | null>(() => {
  return debts.value.find((d) => d.id === debtId.value) ?? null;
});

// Modal states
const showDeleteModal = ref(false);
const showPartialPaymentModal = ref(false);

// Close debt logic
const { isDeleting, deleteDebt } = useCloseDebt();

// Partial payment logic
const { isPaying, makePartialPayment } = usePartialPayment();

async function handleDeleteDebt() {
  if (!debt.value || !userId.value) return;

  const success = await deleteDebt(debt.value, userId.value);
  if (success) {
    showDeleteModal.value = false;
    router.replace({ name: ROUTE_NAMES.DEBTS_LIST });
  }
}

async function handlePartialPayment(
  amount: number,
  accountId: string,
  options: { forgiveRemainder?: boolean; excessCategoryId?: string } = {},
) {
  if (!debt.value || !userId.value) return;

  const willClose = amount >= debt.value.remaining_amount || options.forgiveRemainder;
  const success = await makePartialPayment(debt.value, amount, accountId, userId.value, options);
  if (success) {
    showPartialPaymentModal.value = false;
    if (willClose) {
      router.replace({ name: ROUTE_NAMES.DEBTS_LIST });
    }
  }
}

function goBack() {
  navigateBack();
}
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark pb-28 md:pb-8 overflow-y-auto"
  >
    <!-- Header -->
    <AppHeader :title="debt?.person_name || debt?.name || 'Долг'" show-back blur @back="goBack" />

    <!-- Content -->
    <main class="px-5 pt-8 pb-6">
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
        @payment="showPartialPaymentModal = true"
        @delete="showDeleteModal = true"
      />
    </main>

    <!-- Delete Debt Modal -->
    <DeleteDebtModal
      v-model="showDeleteModal"
      :debt="debt"
      :currency="debt?.currency || DEFAULT_CURRENCY"
      :is-deleting="isDeleting"
      @confirm="handleDeleteDebt"
    />

    <!-- Partial Payment Modal -->
    <PartialPaymentModal
      v-model="showPartialPaymentModal"
      :debt="debt"
      :accounts="accounts"
      :is-paying="isPaying"
      @confirm="handlePartialPayment"
    />
  </div>
</template>
