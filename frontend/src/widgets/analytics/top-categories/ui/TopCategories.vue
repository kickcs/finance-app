<script setup lang="ts">
import { computed } from 'vue';
import { UCard, EmptyState, IconBadge } from '@/shared/ui';
import { formatMasked, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import type { CategoryStat } from '@/features/analytics-filters';

const props = defineProps<{
  categories: CategoryStat[];
  currency: string;
  limit?: number;
  hidden?: boolean;
}>();

// Get top N categories
const topCategories = computed(() => {
  const limit = props.limit || 3;
  return props.categories.slice(0, limit);
});

// Max amount for relative bar width
const maxAmount = computed(() => {
  if (topCategories.value.length === 0) return 1;
  return topCategories.value[0].amount || 1;
});

function getBarWidth(amount: number): string {
  return `${(amount / maxAmount.value) * 100}%`;
}
</script>

<template>
  <UCard padding="lg" variant="bordered" class="shadow-sm">
    <div v-if="topCategories.length > 0" class="space-y-4">
      <div v-for="(category, index) in topCategories" :key="category.id" class="w-full text-left">
        <div class="flex items-center gap-3 mb-2">
          <!-- Rank -->
          <span
            class="w-5 h-5 shrink-0 rounded text-xs font-semibold flex items-center justify-center"
            :class="[
              index === 0
                ? 'bg-primary-light text-primary'
                : 'bg-surface-light dark:bg-surface-dark text-text-tertiary-light dark:text-text-tertiary-dark',
            ]"
          >
            {{ index + 1 }}
          </span>

          <!-- Category icon -->
          <IconBadge :icon="category.icon" size="sm" :color="category.color" class="shrink-0" />

          <!-- Category name: ужимается первым, потому что номер и сумма
               сокращению не подлежат -->
          <span
            class="flex-1 min-w-0 truncate text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
          >
            {{ category.name }}
          </span>

          <!-- Amount and percent -->
          <div class="shrink-0 text-right">
            <p
              class="text-sm font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark"
            >
              {{ formatMasked(category.amount, currency, hidden ?? false, COMPACT_FORMAT) }}
            </p>
            <p class="text-xs tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark">
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
      </div>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else
      icon="category"
      title="Нет данных"
      description="В этом периоде нет транзакций по категориям"
    />
  </UCard>
</template>
