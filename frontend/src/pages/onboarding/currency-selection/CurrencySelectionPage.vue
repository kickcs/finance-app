<script setup lang="ts">
import { ref, inject } from 'vue'
import type { Ref } from 'vue'
import type { User } from '@/shared/api/composables/useAuth'
import { useRouter } from 'vue-router'
import { UButton, UIcon, UProgressBar } from '@/shared/ui'
import { CurrencyList } from '@/widgets/currency-list'
import type { Currency } from '@/entities/currency'
import { profileApi } from '@/shared/api/services/profileApi'

const router = useRouter()
const selectedCurrency = ref<Currency | null>(null)

// Get user from provide/inject
const user = inject<Ref<User | null>>('user')

function handleSelect(currency: Currency) {
  selectedCurrency.value = currency
}

async function handleContinue() {
  if (selectedCurrency.value) {
    // Store selected currency in localStorage
    localStorage.setItem('selectedCurrency', selectedCurrency.value.code)

    // Also update in database if user is authenticated
    if (user?.value?.id) {
      try {
        await profileApi.update(user.value.id, { currency: selectedCurrency.value.code })
      } catch (err) {
        console.warn('Failed to save currency to database:', err)
      }
    }

    router.push('/onboarding/first-account')
  }
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark flex flex-col">
    <!-- Header -->
    <header class="px-5 pb-6" :style="{ paddingTop: 'calc(3rem + var(--safe-area-inset-top))' }">
      <div class="flex items-center justify-between mb-6">
        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Шаг 1 из 2
        </span>
        <UButton variant="ghost" size="sm">
          Пропустить
        </UButton>
      </div>

      <UProgressBar :value="50" size="sm" class="mb-8" />

      <h1 class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
        Выберите валюту
      </h1>
      <p class="text-text-secondary-light dark:text-text-secondary-dark">
        Основная валюта для отображения баланса
      </p>
    </header>

    <!-- Currency List -->
    <main class="flex-1 px-5 pb-32 overflow-y-auto">
      <CurrencyList
        :selected-code="selectedCurrency?.code"
        @select="handleSelect"
      />
    </main>

    <!-- Footer -->
    <footer class="fixed bottom-0 left-0 right-0 p-5 pb-10 bg-background-light dark:bg-background-dark">
      <UButton
        variant="primary"
        size="xl"
        full-width
        :disabled="!selectedCurrency"
        @click="handleContinue"
      >
        Продолжить
        <UIcon name="arrow_forward" size="sm" class="ml-2" />
      </UButton>
    </footer>
  </div>
</template>
