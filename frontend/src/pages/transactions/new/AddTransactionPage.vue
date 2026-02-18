<script setup lang="ts">
import { computed, inject, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { Ref } from 'vue';
import type { User } from '@/shared/api/composables/useAuth';
import { UButton, UIcon } from '@/shared/ui';
import { TransactionForm, useAddTransaction } from '@/features/add-transaction';
import { useAccounts, accountQueryKeys } from '@/entities/account';
import { useCategories } from '@/entities/category';
import { useProfile, queryClient } from '@/shared/api';
import { transactionsApi } from '@/entities/transaction';
import { navigateBack } from '@/app/router';
import { useSplitExpense } from '@/features/split-expense';
import { transactionQueryKeys } from '@/entities/transaction';

const router = useRouter();
const route = useRoute();
const user = inject<Ref<User | null>>('user');

// Get accounts and categories for the current user
const userId = computed(() => user?.value?.id ?? null);
const { accounts, isLoading: accountsLoading } = useAccounts(userId);
const {
  expenseCategories,
  incomeCategories,
  isLoading: categoriesLoading,
} = useCategories(userId);
const { profile, defaultAccountId } = useProfile(userId);
const userCurrency = computed(() => profile.value?.currency || 'UZS');
const isQuickAction = computed(() => !!route.query.categoryId);
const _isLoading = computed(
  () => accountsLoading.value || categoriesLoading.value,
);

// Use the add transaction feature
const { formData, isSubmitting, error, addTransaction, setType, updateField } =
  useAddTransaction();

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
  if (!userId.value) {
    error.value = 'Пользователь не авторизован';
    return;
  }

  // Validate split expense if enabled
  if (splitData.value.enabled && !splitIsValid.value) {
    error.value =
      splitValidationError.value || 'Проверьте данные разделения расхода';
    return;
  }

  const transactionId = await addTransaction(userId.value);

  if (transactionId) {
    // Create debts for split expense if enabled
    if (
      splitData.value.enabled &&
      splitData.value.participants.length > 0 &&
      formData.value.accountId
    ) {
      const success = await createDebtsForSplit(
        transactionId,
        userId.value,
        formData.value.accountId,
        formData.value.currency,
      );

      // Rollback transaction if debt creation failed
      if (!success) {
        await rollbackTransaction(
          transactionId,
          userId.value,
          formData.value.accountId,
          formData.value.currency,
        );
        error.value =
          'Не удалось создать долги для раздельного счёта. Операция отменена.';
        return;
      }
    }

    resetSplit();
    router.push({ name: 'dashboard' });
  }
}

// Rollback a transaction if split debt creation fails
async function rollbackTransaction(
  transactionId: string,
  userId: string,
  _accountId: string,
  _currency: string,
) {
  try {
    // Delete the transaction (backend automatically reverses balance)
    await transactionsApi.delete(transactionId);

    // Invalidate caches
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: transactionQueryKeys.list(userId),
      }),
      queryClient.invalidateQueries({
        queryKey: accountQueryKeys.list(userId),
      }),
    ]);
  } catch (e) {
    console.error('Failed to rollback transaction:', e);
  }
}

function goBack() {
  navigateBack();
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-24">
    <!-- Header -->
    <header
      class="sticky top-0 z-30 pt-[var(--safe-area-inset-top)] bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl"
    >
      <div class="flex items-center justify-between px-4 py-3">
        <UButton variant="ghost" size="sm" @click="goBack">
          <UIcon name="arrow_back" size="md" />
        </UButton>
        <h1
          class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          Новая транзакция
        </h1>
        <div class="w-10" />
      </div>
    </header>

    <!-- Content -->
    <main class="px-4 pt-4 pb-4">
      <div v-if="accountsLoading" class="flex items-center justify-center py-8">
        <div
          class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"
        />
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
        :error="error"
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
        @set-split-enabled="setSplitEnabled"
      />
    </main>
  </div>
</template>
