<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { ReminderForm, useCreateReminder } from '@/features/create-reminder';
import { navigateBack } from '@/app/router';
import { AppHeader } from '@/widgets/header';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';

const router = useRouter();
const { userId } = useCurrentUser();

// Get user currency (profile-first, falls back to localStorage)
const { currency } = useUserCurrency();

// Use the create reminder feature
const { formData, isSubmitting, error, createReminder } = useCreateReminder();

async function handleSubmit() {
  if (!userId.value) {
    error.value = 'Пользователь не авторизован';
    return;
  }

  const reminderId = await createReminder(userId.value);

  if (reminderId) {
    router.push({ name: ROUTE_NAMES.DASHBOARD });
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
    <AppHeader title="Новая подписка" show-back blur @back="goBack" />

    <!-- Content -->
    <main class="px-5 pt-8 pb-6">
      <ReminderForm
        v-model:form-data="formData"
        :is-submitting="isSubmitting"
        :error="error"
        :currency="currency"
        @submit="handleSubmit"
      />
    </main>
  </div>
</template>
