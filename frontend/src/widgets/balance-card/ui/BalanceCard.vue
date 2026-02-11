<script setup lang="ts">
import { UIcon, UCard } from '@/shared/ui'
import { formatCurrency } from '@/shared/lib/format/currency'

defineProps<{
  totalBalance: number
  currency: string
  percentChange?: number
  loading?: boolean
}>()

defineEmits<{
  'income-click': []
  'expense-click': []
}>()
</script>

<template>
  <UCard class="p-6">
    <!-- Balance Section -->
    <div class="text-center mb-8">
      <p class="text-xs font-medium tracking-wide text-text-secondary-light dark:text-text-secondary-dark mb-2">
        Общий баланс
      </p>

      <!-- Loading skeleton -->
      <div v-if="loading" class="h-12 w-48 mx-auto rounded-lg bg-surface-light dark:bg-surface-dark animate-shimmer" />

      <!-- Balance amount - clean typography with fade-in -->
      <Transition
        enter-active-class="transition-opacity duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
      >
        <h1
          v-if="!loading"
          class="text-4xl sm:text-5xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark"
        >
          {{ formatCurrency(totalBalance, currency) }}
        </h1>
      </Transition>

      <!-- Trend indicator - minimal -->
      <div
        v-if="percentChange !== undefined && !loading"
        :class="[
          'inline-flex items-center gap-1 mt-3 px-2.5 py-1 rounded-md text-xs font-medium',
          percentChange >= 0
            ? 'bg-success-light text-success'
            : 'bg-danger-light text-danger'
        ]"
      >
        <UIcon
          :name="percentChange >= 0 ? 'trending_up' : 'trending_down'"
          size="xs"
        />
        <span>{{ percentChange >= 0 ? '+' : '' }}{{ percentChange.toFixed(1) }}%</span>
        <span class="text-text-tertiary-light dark:text-text-tertiary-dark ml-0.5">vs прошлый месяц</span>
      </div>
    </div>

    <!-- Quick Actions - flat buttons -->
    <div class="flex gap-3">
      <!-- Income Button -->
      <button
        class="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg
               bg-surface-light dark:bg-surface-dark
               border border-border-light dark:border-border-dark
               hover:border-success/40 hover:bg-success-light
               active:opacity-80
               focus:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2
               transition-all duration-150"
        @click="$emit('income-click')"
      >
        <div
          class="w-8 h-8 rounded-lg bg-success-light flex items-center justify-center"
        >
          <UIcon name="add" size="sm" class="text-success" />
        </div>
        <span class="font-medium text-sm text-text-primary-light dark:text-text-primary-dark">
          Доход
        </span>
      </button>

      <!-- Expense Button -->
      <button
        class="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg
               bg-surface-light dark:bg-surface-dark
               border border-border-light dark:border-border-dark
               hover:border-danger/40 hover:bg-danger-light
               active:opacity-80
               focus:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2
               transition-all duration-150"
        @click="$emit('expense-click')"
      >
        <div
          class="w-8 h-8 rounded-lg bg-danger-light flex items-center justify-center"
        >
          <UIcon name="remove" size="sm" class="text-danger" />
        </div>
        <span class="font-medium text-sm text-text-primary-light dark:text-text-primary-dark">
          Расход
        </span>
      </button>
    </div>
  </UCard>
</template>
