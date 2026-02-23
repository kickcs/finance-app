<script setup lang="ts">
import { inject, computed } from 'vue';
import type { Ref } from 'vue';
import type { User } from '@/shared/api/composables/useAuth';
import { useRouter } from 'vue-router';
import { UButton, UIcon } from '@/shared/ui';
import { AccountForm, useCreateAccount } from '@/features/create-account';
import { queryClient, profileQueryKeys } from '@/shared/api';
import { profileApi } from '@/shared/api/services/profileApi';
import { navigateBack } from '@/app/router';

const router = useRouter();

// Get user from provide/inject
const user = inject<Ref<User | null>>('user');

// Check if this is onboarding or regular account creation
const isOnboarding = computed(() => {
  return localStorage.getItem('onboardingComplete') !== 'true';
});

const {
  formData,
  isSubmitting,
  error,
  primaryCurrency,
  createAccount,
  addCurrency,
  removeCurrency,
  updateBalance,
  updateCurrency,
} = useCreateAccount();

async function handleSubmit() {
  const userId = user?.value?.id;

  if (!userId) {
    console.error('User not authenticated');
    router.push({ name: 'login' });
    return;
  }

  const accountId = await createAccount(userId);

  if (accountId) {
    if (isOnboarding.value) {
      // Mark onboarding as complete and set default account and currency
      try {
        await profileApi.update(userId, {
          has_completed_onboarding: true,
          default_account_id: accountId,
          currency: primaryCurrency.value, // Set primary currency for conversions
        });
      } catch (err) {
        console.warn('Failed to update profile in database:', err);
      }

      // Also store in localStorage for fast access
      localStorage.setItem('onboardingComplete', 'true');
      localStorage.setItem('selectedCurrency', primaryCurrency.value);

      // Invalidate profile cache so router guard sees updated onboarding status
      await queryClient.invalidateQueries({
        queryKey: profileQueryKeys.detail(userId),
      });
    }

    router.push('/');
  }
}

function goBack() {
  navigateBack();
}

function handleFormUpdate(newData: typeof formData.value) {
  Object.assign(formData.value, newData);
}
</script>

<template>
  <div class="h-dvh bg-background-light dark:bg-background-dark flex flex-col overflow-hidden">
    <!-- Header -->
    <header class="px-5 pb-4" :style="{ paddingTop: 'calc(1rem + var(--safe-area-inset-top))' }">
      <div class="flex items-center justify-between mb-4">
        <!-- Back button (shown when not onboarding) -->
        <UButton v-if="!isOnboarding" variant="ghost" size="sm" @click="goBack">
          <UIcon name="arrow_back" size="md" />
        </UButton>
        <div v-else class="w-10" />
        <!-- Spacer for onboarding -->

        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          {{ isOnboarding ? 'Настройка аккаунта' : 'Новый счёт' }}
        </span>
        <div class="w-10" />
        <!-- Spacer -->
      </div>

      <h1 class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
        {{ isOnboarding ? 'Создайте первый счёт' : 'Новый счёт' }}
      </h1>
      <p class="text-text-secondary-light dark:text-text-secondary-dark">
        Добавьте счёт и выберите валюту для учёта финансов
      </p>
    </header>

    <!-- Form -->
    <main class="flex-1 overflow-y-auto px-5 pb-16">
      <AccountForm
        :form-data="formData"
        :is-submitting="isSubmitting"
        :error="error"
        @update:form-data="handleFormUpdate"
        @submit="handleSubmit"
        @add-currency="addCurrency"
        @remove-currency="removeCurrency"
        @update-balance="updateBalance"
        @update-currency="updateCurrency"
      />
    </main>
  </div>
</template>
