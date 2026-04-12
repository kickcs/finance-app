<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { UButton, UIcon } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';
import {
  TransactionForm,
  useTransactionForm,
  useSubmitTransaction,
} from '@/features/add-transaction';
import { useAccounts } from '@/entities/account';
import { useCategories } from '@/entities/category';
import { useProfile } from '@/shared/api';
import { navigateBack } from '@/app/router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useSplitExpense } from '@/features/split-expense';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';

const router = useRouter();
const route = useRoute();
const { userId } = useCurrentUser();

// Get accounts and categories for the current user
const { accounts, isLoading: accountsLoading } = useAccounts(userId);
const { expenseCategories, incomeCategories } = useCategories(userId);
const { defaultAccountId } = useProfile(userId);
const { currency: userCurrency } = useUserCurrency();
const isQuickAction = computed(() => !!route.query.categoryId);

// Use the add transaction feature
const { formData, isValid, setType, updateField } = useTransactionForm();
const { isSubmitting, submit, submitAndWait, rollbackTransaction } = useSubmitTransaction();

// Local validation error (separate from mutation error which is handled via toast)
const validationError = ref<string | null>(null);

// Use split expense feature
const {
  splitData,
  isValid: splitIsValid,
  validationError: splitValidationError,
  addParticipant,
  removeParticipant,
  updateParticipantAmount,
  setMethod: setSplitMethod,
  setMyShare,
  setIsIncluded,
  setEnabled: setSplitEnabled,
  createDebtsForSplit,
  reset: resetSplit,
} = useSplitExpense(() => formData.value.amount);

// Set transaction type from query parameter and reset split data
onMounted(() => {
  // Always reset split data when entering the page
  resetSplit();

  const typeParam = route.query.type as string;
  if (
    typeParam === 'income' ||
    typeParam === 'expense' ||
    typeParam === 'transfer' ||
    typeParam === 'debt'
  ) {
    setType(typeParam);
  }

  // Pre-fill category from quick action preset
  const categoryId = route.query.categoryId as string;
  if (categoryId) {
    updateField('categoryId', categoryId);
  }
});

// Auto-select default account when accounts load
watch(
  [accounts, defaultAccountId],
  ([accs, defaultId]) => {
    if (accs.length > 0 && !formData.value.accountId) {
      // Check for query param override first
      const queryAccountId = route.query.accountId as string;
      const queryAccount = queryAccountId ? accs.find((a) => a.id === queryAccountId) : null;

      // Use query param > default account > first account
      const selectedId = queryAccount
        ? queryAccountId
        : defaultId && accs.some((a) => a.id === defaultId)
          ? defaultId
          : accs[0].id;

      const selectedAccount = accs.find((a) => a.id === selectedId);
      if (selectedAccount && selectedAccount.balances.length > 0) {
        updateField('accountId', selectedId);
        updateField('currency', selectedAccount.balances[0].currency);
      }
    }
  },
  { immediate: true },
);

async function handleSplitSubmit(uid: string): Promise<boolean> {
  if (!formData.value.accountId) {
    validationError.value = 'Выберите счёт для транзакции';
    return false;
  }

  const transactionId = await submitAndWait(uid, formData.value);
  if (!transactionId) return false;

  const success = await createDebtsForSplit(
    transactionId,
    uid,
    formData.value.accountId,
    formData.value.currency,
    formData.value.date,
  );

  if (!success) {
    await rollbackTransaction(transactionId, uid);
    validationError.value = 'Не удалось создать долги для раздельного счёта. Операция отменена.';
    return false;
  }

  return true;
}

async function handleSubmit() {
  validationError.value = null;

  if (formData.value.type === 'debt') {
    // DebtPanel owns its own submit flow and emits `debt-submitted`.
    return;
  }

  if (!userId.value) {
    validationError.value = 'Пользователь не авторизован';
    return;
  }

  if (splitData.value.enabled && !splitIsValid.value) {
    validationError.value = splitValidationError.value || 'Проверьте данные разделения расхода';
    return;
  }

  const isSplit = splitData.value.enabled && splitData.value.participants.length > 0;

  if (isSplit) {
    if (!(await handleSplitSubmit(userId.value))) return;
  } else {
    submit(userId.value, formData.value);
  }

  resetSplit();
  navigateBack();
}
</script>

<template>
  <div class="h-full flex flex-col min-w-0 relative">
    <!-- Mobile Header -->
    <div class="md:hidden shrink-0">
      <AppHeader title="Новая транзакция" show-back blur @back="navigateBack" />
    </div>

    <!-- Desktop Breadcrumbs Header (optional) -->
    <div class="hidden md:flex items-center justify-between px-8 py-6 shrink-0">
      <h1 class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
        Новая транзакция
      </h1>
      <button
        type="button"
        aria-label="Закрыть"
        class="w-10 h-10 rounded-full flex items-center justify-center bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors cursor-pointer text-text-secondary-light dark:text-text-secondary-dark"
        @click="navigateBack"
      >
        <UIcon name="close" size="sm" />
      </button>
    </div>

    <!-- Content -->
    <main class="flex-1 overflow-y-auto px-4 md:px-8 pt-2 md:pt-4 pb-12">
      <div
        class="md:max-w-xl md:mx-auto md:bg-card-light md:dark:bg-card-dark md:rounded-3xl md:shadow-sm md:border md:border-border-light md:dark:border-border-dark md:p-8 md:mt-2"
      >
        <div
          v-if="!accountsLoading && accounts.length === 0"
          data-testid="no-accounts-state"
          class="text-center py-8"
        >
          <UIcon
            name="account_balance_wallet"
            size="lg"
            class="text-text-tertiary-light dark:text-text-tertiary-dark mb-3"
          />
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-3">
            У вас пока нет счетов
          </p>
          <UButton
            variant="primary"
            size="sm"
            @click="router.push({ name: ROUTE_NAMES.NEW_ACCOUNT })"
          >
            Создать счёт
          </UButton>
        </div>

        <TransactionForm
          v-else
          v-model:form-data="formData"
          data-testid="transaction-form"
          :accounts="accounts"
          :expense-categories="expenseCategories"
          :income-categories="incomeCategories"
          :user-currency="userCurrency"
          :default-account-id="defaultAccountId"
          :is-submitting="isSubmitting"
          :is-valid="isValid"
          :error="validationError"
          :split-data="splitData"
          :split-validation-error="splitValidationError"
          :autofocus-amount="isQuickAction"
          @submit="handleSubmit"
          @debt-submitted="navigateBack"
          @add-participant="addParticipant"
          @remove-participant="removeParticipant"
          @update-participant-amount="updateParticipantAmount"
          @set-split-method="setSplitMethod"
          @set-my-share="setMyShare"
          @set-is-included="setIsIncluded"
          @set-split-enabled="setSplitEnabled"
        />
      </div>
    </main>
  </div>
</template>
