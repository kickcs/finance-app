<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import type { Ref } from 'vue'
import type { User } from '@/shared/api/composables/useAuth'
import { UButton, UIcon } from '@/shared/ui'
import { ReminderForm, useCreateReminder } from '@/features/create-reminder'
import { navigateBack } from '@/app/router'

const router = useRouter()
const user = inject<Ref<User | null>>('user')

const userId = computed(() => user?.value?.id ?? '')

// Get currency from localStorage
const currency = localStorage.getItem('selectedCurrency') || 'UZS'

// Use the create reminder feature
const { formData, isSubmitting, error, createReminder } = useCreateReminder()

async function handleSubmit() {
  if (!userId.value) {
    error.value = 'Пользователь не авторизован'
    return
  }

  const reminderId = await createReminder(userId.value)

  if (reminderId) {
    router.push({ name: 'dashboard' })
  }
}

function goBack() {
  navigateBack()
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
    <!-- Header -->
    <header class="sticky top-0 z-30 pt-[var(--safe-area-inset-top)] bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl">
      <div class="flex items-center justify-between px-4 py-4">
        <UButton variant="ghost" size="sm" @click="goBack">
          <UIcon name="arrow_back" size="md" />
        </UButton>
        <h1 class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
          Новая подписка
        </h1>
        <div class="w-10" />
      </div>
    </header>

    <!-- Content -->
    <main class="px-5 pt-8 pb-6">
      <ReminderForm
        v-model:formData="formData"
        :is-submitting="isSubmitting"
        :error="error"
        :currency="currency"
        @submit="handleSubmit"
      />
    </main>
  </div>
</template>
