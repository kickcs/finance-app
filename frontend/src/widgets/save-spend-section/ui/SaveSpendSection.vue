<script setup lang="ts">
import { computed } from 'vue';
import { UCard, UIcon, UButton } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';

const props = defineProps<{
  savedAmount: number;
  spentAmount: number;
  currency: string;
  period?: string;
  loading?: boolean;
  hidden?: boolean;
}>();

defineEmits<{
  'income-click': [];
  'expense-click': [];
}>();

const hasData = computed(() => props.savedAmount > 0 || props.spentAmount > 0);
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2
        class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
      >
        {{ period || 'Этот месяц' }}
      </h2>
      <UButton
        v-if="hasData && !loading"
        variant="ghost"
        size="xs"
        @click="$emit('income-click')"
      >
        Детали
        <UIcon name="chevron_right" size="xs" />
      </UButton>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="grid grid-cols-2 gap-3">
      <UCard v-for="i in 2" :key="i" padding="md">
        <div
          class="h-4 w-20 rounded bg-surface-light dark:bg-surface-dark animate-shimmer mb-2"
        />
        <div
          class="h-6 w-24 rounded bg-surface-light dark:bg-surface-dark animate-shimmer"
        />
      </UCard>
    </div>

    <!-- Empty state — compact -->
    <UCard v-else-if="!hasData" padding="md">
      <div class="flex items-center gap-3 py-1">
        <div
          class="w-9 h-9 shrink-0 rounded-lg bg-surface-light dark:bg-surface-dark flex items-center justify-center"
        >
          <UIcon name="trending_up" size="sm" class="text-text-tertiary-light dark:text-text-tertiary-dark" />
        </div>
        <div>
          <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            Нет данных за месяц
          </p>
          <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            Добавьте доходы и расходы
          </p>
        </div>
      </div>
    </UCard>

    <!-- Content — two side-by-side cards -->
    <div v-else class="grid grid-cols-2 gap-3">
      <!-- Earned Card -->
      <UCard
        padding="md"
        class="cursor-pointer hover:ring-1 hover:ring-success/30 transition-all"
        @click="$emit('income-click')"
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-md bg-success-light flex items-center justify-center"
          >
            <UIcon name="trending_up" size="xs" class="text-success" />
          </div>
          <span
            class="text-body-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
          >
            Заработано
          </span>
        </div>
        <p class="text-h3 font-semibold text-success">
          {{ hidden ? '••••' : formatCurrency(savedAmount, currency, COMPACT_FORMAT) }}
        </p>
      </UCard>

      <!-- Spent Card -->
      <UCard
        padding="md"
        class="cursor-pointer hover:ring-1 hover:ring-danger/30 transition-all"
        @click="$emit('expense-click')"
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-md bg-danger-light flex items-center justify-center"
          >
            <UIcon name="trending_down" size="xs" class="text-danger" />
          </div>
          <span
            class="text-body-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
          >
            Потрачено
          </span>
        </div>
        <p class="text-h3 font-semibold text-danger">
          {{ hidden ? '••••' : formatCurrency(spentAmount, currency, COMPACT_FORMAT) }}
        </p>
      </UCard>
    </div>
  </div>
</template>
