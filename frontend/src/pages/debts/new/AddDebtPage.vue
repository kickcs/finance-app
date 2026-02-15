<script setup lang="ts">
import { computed, inject } from 'vue';
import { useRouter } from 'vue-router';
import type { Ref } from 'vue';
import type { User } from '@/shared/api/composables/useAuth';
import { UButton, UIcon } from '@/shared/ui';
import { DebtForm, useCreateDebt } from '@/features/create-debt';
import { useAccounts } from '@/entities/account';
import { navigateBack } from '@/app/router';

const router = useRouter();
const user = inject<Ref<User | null>>('user');

const userId = computed(() => user?.value?.id ?? '');

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
    router.push({ name: 'dashboard' });
  }
}

function goBack() {
  navigateBack();
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
    <!-- Header -->
    <header
      class="sticky top-0 z-30 pt-[var(--safe-area-inset-top)] bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl"
    >
      <div class="flex items-center justify-between px-4 py-4">
        <UButton variant="ghost" size="sm" @click="goBack">
          <UIcon name="arrow_back" size="md" />
        </UButton>
        <h1
          class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          Новый долг
        </h1>
        <div class="w-10" />
      </div>
    </header>

    <!-- Content -->
    <main class="px-5 pt-8 pb-6">
      <!-- Loading State -->
      <div
        v-if="accountsLoading"
        class="flex items-center justify-center py-12"
      >
        <div
          class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
        />
      </div>

      <!-- No Accounts State -->
      <div v-else-if="accounts.length === 0" class="text-center py-12">
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
        <UButton
          variant="primary"
          @click="router.push({ name: 'new-account' })"
        >
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
