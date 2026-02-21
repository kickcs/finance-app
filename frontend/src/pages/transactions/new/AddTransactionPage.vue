<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { UButton, UIcon, USpinner } from '@/shared/ui';
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
const { isSubmitting, submit, submitAndWait, rollbackTransaction } =
  useSubmitTransaction();

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
  updateParticipantName,
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
    typeParam === 'transfer'
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
      const queryAccount = queryAccountId
        ? accs.find((a) => a.id === queryAccountId)
        : null;

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

async function handleSubmit() {
  validationError.value = null;

  if (!userId.value) {
    validationError.value = 'Пользователь не авторизован';
    return;
  }

  // Validate split expense if enabled
  if (splitData.value.enabled && !splitIsValid.value) {
    validationError.value =
      splitValidationError.value || 'Проверьте данные разделения расхода';
    return;
  }

  const isSplit =
    splitData.value.enabled && splitData.value.participants.length > 0;

  if (isSplit) {
    if (!formData.value.accountId) {
      validationError.value = 'Выберите счёт для транзакции';
      return;
    }

    // Split expense: must wait for transactionId to create debts
    const transactionId = await submitAndWait(userId.value, formData.value);

    if (!transactionId) {
      // submitAndWait failed — error toast already shown by mutation
      return;
    }

    const success = await createDebtsForSplit(
      transactionId,
      userId.value,
      formData.value.accountId,
      formData.value.currency,
    );

    if (!success) {
      await rollbackTransaction(transactionId, userId.value);
      validationError.value =
        'Не удалось создать долги для раздельного счёта. Операция отменена.';
      return;
    }

    resetSplit();
    router.push({ name: 'dashboard' });
  } else {
    // Regular transaction: fire-and-forget with optimistic update
    submit(userId.value, formData.value);
    resetSplit();
    router.push({ name: 'dashboard' });
  }
}
</script>

<template>
  <div
    class="h-dvh flex flex-col bg-background-light dark:bg-background-dark overflow-hidden"
  >
    <!-- Header -->
    <AppHeader title="Новая транзакция" show-back blur @back="navigateBack" />

    <!-- Content -->
    <main class="flex-1 overflow-y-auto px-4 pt-2 pb-4">
      <div v-if="accountsLoading" class="flex items-center justify-center py-8">
        <USpinner size="sm" />
      </div>

      <div v-else-if="accounts.length === 0" class="text-center py-8">
        <UIcon
          name="account_balance_wallet"
          size="lg"
          class="text-text-tertiary-light dark:text-text-tertiary-dark mb-3"
        />
        <p
          class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-3"
        >
          У вас пока нет счетов
        </p>
        <UButton
          variant="primary"
          size="sm"
          @click="router.push({ name: 'new-account' })"
        >
          Создать счёт
        </UButton>
      </div>

      <TransactionForm
        v-else
        v-model:form-data="formData"
        :accounts="accounts"
        :expense-categories="expenseCategories"
        :income-categories="incomeCategories"
        :user-currency="userCurrency"
        :is-submitting="isSubmitting"
        :is-valid="isValid"
        :error="validationError"
        :split-data="splitData"
        :split-validation-error="splitValidationError"
        :autofocus-amount="isQuickAction"
        @submit="handleSubmit"
        @add-participant="addParticipant"
        @remove-participant="removeParticipant"
        @update-participant-amount="updateParticipantAmount"
        @update-participant-name="updateParticipantName"
        @set-split-method="setSplitMethod"
        @set-my-share="setMyShare"
        @set-is-included="setIsIncluded"
        @set-split-enabled="setSplitEnabled"
      />
    </main>
  </div>
</template>
