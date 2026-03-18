<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { UButton, UIcon, USpinner } from '@/shared/ui';
import DebtForm from '@/features/create-debt/ui/DebtForm.vue';
import { useCreateDebt } from '@/features/create-debt';
import { useAccounts } from '@/entities/account';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { AppHeader } from '@/widgets/header';

const router = useRouter();
const { userId } = useCurrentUser();

// Get accounts for selection (with balances)
const { accounts, isLoading: accountsLoading } = useAccounts(userId);

// Use the create debt feature
const { formData, isSubmitting, error, createDebt } = useCreateDebt();

async function handleSubmit() {
  if (!userId.value) {
    error.value = 'Пользователь не авторизован';
    return;
  }

  const debtId = await createDebt(userId.value);

  if (debtId) {
    router.replace({ name: ROUTE_NAMES.DEBTS_LIST });
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
    <AppHeader title="Новый долг" show-back blur @back="goBack" />

    <!-- Content -->
    <main class="px-5 pt-8 pb-6">
      <!-- Loading State -->
      <div
        v-if="accountsLoading"
        data-testid="accounts-loading"
        class="flex items-center justify-center py-12"
      >
        <USpinner />
      </div>

      <!-- No Accounts State -->
      <div
        v-else-if="accounts.length === 0"
        data-testid="no-accounts-state"
        class="text-center py-12"
      >
        <div
          class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-light dark:bg-surface-dark flex items-center justify-center"
        >
          <UIcon
            name="account_balance_wallet"
            size="xl"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </div>
        <p class="text-text-secondary-light dark:text-text-secondary-dark mb-4">
          Сначала создайте счёт
        </p>
        <UButton variant="primary" @click="router.push({ name: ROUTE_NAMES.NEW_ACCOUNT })">
          Создать счёт
        </UButton>
      </div>

      <!-- Form -->
      <DebtForm
        v-else
        v-model:form-data="formData"
        :accounts="accounts"
        :is-submitting="isSubmitting"
        :error="error"
        @submit="handleSubmit"
      />
    </main>
  </div>
</template>
