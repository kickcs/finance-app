<script setup lang="ts">
import { computed } from 'vue'
import { UCard, UIcon } from '@/shared/ui'
import { formatCurrency } from '@/shared/lib/format/currency'
import type { CategoryStat } from '@/features/analytics-filters'

const props = defineProps<{
  categories: CategoryStat[]
  currency: string
  limit?: number
}>()

const emit = defineEmits<{
  'category-click': [category: CategoryStat]
}>()

// Get top N categories
const topCategories = computed(() => {
  const limit = props.limit || 3
  return props.categories.slice(0, limit)
})

// Max amount for relative bar width
const maxAmount = computed(() => {
  if (topCategories.value.length === 0) return 1
  return topCategories.value[0].amount || 1
})

function getBarWidth(amount: number): string {
  return `${(amount / maxAmount.value) * 100}%`
}
</script>

<template>
  <UCard padding="lg">
    <h3 class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark mb-5">
      Топ категории расходов
    </h3>

    <div
      v-if="topCategories.length > 0"
      class="space-y-4"
    >
      <button
        v-for="(category, index) in topCategories"
        :key="category.id"
        class="w-full text-left group"
        @click="emit('category-click', category)"
      >
        <div class="flex items-center gap-3 mb-2">
          <!-- Rank -->
          <span
            class="w-5 h-5 rounded text-caption-sm font-semibold flex items-center justify-center"
            :class="[
              index === 0
                ? 'bg-primary-light text-primary'
                : 'bg-surface-light dark:bg-surface-dark text-text-tertiary-light dark:text-text-tertiary-dark',
            ]"
          >
            {{ index + 1 }}
          </span>

          <!-- Category icon -->
          <div
            class="w-7 h-7 rounded-lg flex items-center justify-center"
            :style="{ backgroundColor: `${category.color}15` }"
          >
            <UIcon
              :name="category.icon"
              size="xs"
              :style="{ color: category.color }"
            />
          </div>

          <!-- Category name -->
          <span class="flex-1 text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ category.name }}
          </span>

          <!-- Amount and percent -->
          <div class="text-right">
            <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              {{ formatCurrency(category.amount, currency) }}
            </p>
            <p class="text-caption-sm text-text-tertiary-light dark:text-text-tertiary-dark">
              {{ category.percent.toFixed(1) }}%
            </p>
          </div>
        </div>

        <!-- Progress bar - thin and flat -->
        <div class="h-1.5 bg-surface-light dark:bg-surface-dark rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-200 ease-out"
            :style="{
              width: getBarWidth(category.amount),
              backgroundColor: category.color,
            }"
          />
        </div>
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="py-8 text-center"
    >
      <UIcon
        name="category"
        size="xl"
        class="text-text-tertiary-light dark:text-text-tertiary-dark mb-2"
      />
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        Нет данных о расходах
      </p>
    </div>
  </UCard>
</template>
