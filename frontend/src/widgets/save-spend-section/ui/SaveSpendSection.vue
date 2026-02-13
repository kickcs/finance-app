<script setup lang="ts">
import { computed } from 'vue'
import { UCard, UIcon, EmptyState } from '@/shared/ui'
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency'

const props = defineProps<{
  savedAmount: number
  spentAmount: number
  currency: string
  period?: string
  loading?: boolean
}>()

const total = computed(() => props.savedAmount + props.spentAmount)

const savedPercent = computed(() => {
  if (total.value === 0) return 50
  return Math.min((props.savedAmount / total.value) * 100, 100)
})

const spentPercent = computed(() => {
  if (total.value === 0) return 50
  return Math.min((props.spentAmount / total.value) * 100, 100)
})

const hasData = computed(() => props.savedAmount > 0 || props.spentAmount > 0)

defineEmits<{
  'income-click': []
  'expense-click': []
}>()
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-2">
      <h2 class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
        {{ period || 'Этот месяц' }}
      </h2>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="flex flex-col gap-3">
      <UCard v-for="i in 2" :key="i" padding="md">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-surface-light dark:bg-surface-dark animate-shimmer" />
            <div class="h-4 w-20 rounded bg-surface-light dark:bg-surface-dark animate-shimmer" />
          </div>
          <div class="h-6 w-24 rounded bg-surface-light dark:bg-surface-dark animate-shimmer" />
        </div>
        <div class="h-1.5 rounded-full bg-surface-light dark:bg-surface-dark animate-shimmer" />
      </UCard>
    </div>

    <!-- Empty state -->
    <UCard v-else-if="!hasData" padding="md">
      <EmptyState
        icon="trending_up"
        title="Нет данных за месяц"
        description="Добавьте доходы и расходы для отслеживания статистики"
        :animated="true"
      />
    </UCard>

    <!-- Content -->
    <div v-else class="flex flex-col gap-3">
      <!-- Earned Card -->
      <UCard padding="md" class="animate-fadeInUp cursor-pointer hover:ring-1 hover:ring-success/30 transition-all" style="animation-delay: 0.03s;" @click="$emit('income-click')">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-success-light flex items-center justify-center">
              <UIcon name="trending_up" size="sm" class="text-success" />
            </div>
            <span class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
              Заработано
            </span>
          </div>
          <p class="text-xl font-semibold text-success">
            +{{ formatCurrency(savedAmount, currency, COMPACT_FORMAT) }}
          </p>
        </div>

        <!-- Progress bar - flat -->
        <div class="h-1.5 rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden">
          <div
            class="h-full rounded-full bg-success transition-all duration-200"
            :style="{ width: `${savedPercent}%` }"
          />
        </div>
      </UCard>

      <!-- Spent Card -->
      <UCard padding="md" class="animate-fadeInUp cursor-pointer hover:ring-1 hover:ring-danger/30 transition-all" style="animation-delay: 0.06s;" @click="$emit('expense-click')">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-danger-light flex items-center justify-center">
              <UIcon name="trending_down" size="sm" class="text-danger" />
            </div>
            <span class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
              Потрачено
            </span>
          </div>
          <p class="text-xl font-semibold text-danger">
            -{{ formatCurrency(spentAmount, currency, COMPACT_FORMAT) }}
          </p>
        </div>

        <!-- Progress bar - flat -->
        <div class="h-1.5 rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden">
          <div
            class="h-full rounded-full bg-danger transition-all duration-200"
            :style="{ width: `${spentPercent}%` }"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>
