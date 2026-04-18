<script setup lang="ts">
import { computed } from 'vue';
import { type BudgetCurrentResponse, useBudgetProgress } from '@/entities/budget';
import { EmptyState, IconBadge } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';
import BudgetSectionSkeleton from './BudgetSectionSkeleton.vue';

const props = defineProps<{
  budget: BudgetCurrentResponse | null;
  loading: boolean;
  hidden: boolean;
}>();

defineEmits<{
  setup: [];
  edit: [];
}>();

const {
  percentage,
  isOverspent,
  barColor: progressBarColor,
  barWidth: progressBarWidth,
} = useBudgetProgress(() => props.budget);

const remainingColor = computed(() => (isOverspent.value ? 'text-danger' : 'text-success'));
</script>

<template>
  <!-- Loading state -->
  <BudgetSectionSkeleton v-if="loading" />

  <!-- Empty state (no budget set) -->
  <EmptyState
    v-else-if="!budget"
    variant="inline"
    icon="savings"
    title="Нет бюджета на месяц"
    description="Контролируйте свои траты"
    icon-bg-class="bg-surface-light dark:bg-surface-dark"
    :action="{ label: 'Установить лимит расходов', onClick: () => $emit('setup') }"
  />

  <!-- Active/Overspent state -->
  <div
    v-else
    class="rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-4 space-y-3"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <IconBadge
          icon="savings"
          size="sm"
          bg-class="bg-surface-light dark:bg-surface-dark"
          icon-class="text-text-secondary-light dark:text-text-secondary-dark"
        />
        <span class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
          Бюджет на месяц
        </span>
      </div>
      <button
        type="button"
        class="text-xs font-medium text-primary hover:opacity-75 transition-opacity"
        @click="$emit('edit')"
      >
        Изменить
      </button>
    </div>

    <!-- Amount line -->
    <div class="flex items-baseline gap-1">
      <span class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
        {{ formatMasked(budget.spent, budget.budget.currency, hidden) }}
      </span>
      <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        из {{ formatMasked(budget.budget.amount, budget.budget.currency, hidden) }}
      </span>
    </div>

    <!-- Progress bar -->
    <div class="w-full h-2 rounded-full overflow-hidden bg-surface-light dark:bg-surface-dark">
      <div
        class="h-full rounded-full transition-all duration-500"
        :style="{
          width: progressBarWidth,
          backgroundColor: progressBarColor,
        }"
      />
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between">
      <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
        Потрачено {{ percentage }}%
      </span>
      <span class="text-xs font-medium" :class="remainingColor">
        <template v-if="isOverspent">
          Перерасход {{ formatMasked(Math.abs(budget.remaining), budget.budget.currency, hidden) }}
        </template>
        <template v-else>
          Осталось {{ formatMasked(budget.remaining, budget.budget.currency, hidden) }}
        </template>
      </span>
    </div>
  </div>
</template>
