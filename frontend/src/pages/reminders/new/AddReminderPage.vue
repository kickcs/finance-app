<script setup lang="ts">
import { computed, inject } from 'vue';
import { useRouter } from 'vue-router';
import type { Ref } from 'vue';
import type { User } from '@/shared/api/composables/useAuth';
import { ReminderForm, useCreateReminder } from '@/features/create-reminder';
import { navigateBack } from '@/app/router';
import { AppHeader } from '@/widgets/header';

const router = useRouter();
const user = inject<Ref<User | null>>('user');

const userId = computed(() => user?.value?.id ?? '');

// Get currency from localStorage
const currency = localStorage.getItem('selectedCurrency') || 'UZS';

// Use the create reminder feature
const { formData, isSubmitting, error, createReminder } = useCreateReminder();

async function handleSubmit() {
  if (!userId.value) {
    error.value = 'Пользователь не авторизован';
    return;
  }

  const reminderId = await createReminder(userId.value);

  if (reminderId) {
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
