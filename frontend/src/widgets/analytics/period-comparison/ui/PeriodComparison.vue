<script setup lang="ts">
import { computed } from 'vue';
import { UCard, UIcon, Skeleton } from '@/shared/ui';
import { formatCurrency, formatPercentage, COMPACT_FORMAT } from '@/shared/lib/format/currency';

const props = defineProps<{
  currentExpense: number;
  previousExpense: number;
  currentIncome: number;
  previousIncome: number;
  currentSavingsRate: number;
  previousSavingsRate: number;
  currency: string;
  loading?: boolean;
  noData?: boolean;
}>();

interface ComparisonRow {
  label: string;
  current: number;
  previous: number;
  delta: number;
  isPositiveGood: boolean; // true = increase is green, false = decrease is green (expenses)
  isCurrency: boolean;
}

const rows = computed<ComparisonRow[]>(() => [
  {
    label: 'Расходы',
    current: props.currentExpense,
    previous: props.previousExpense,
    delta: calcDelta(props.currentExpense, props.previousExpense),
    isPositiveGood: false, // less expense = good
    isCurrency: true,
  },
  {
    label: 'Доходы',
    current: props.currentIncome,
    previous: props.previousIncome,
    delta: calcDelta(props.currentIncome, props.previousIncome),
    isPositiveGood: true,
    isCurrency: true,
  },
  {
    label: 'Сбережения',
    current: props.currentSavingsRate,
    previous: props.previousSavingsRate,
    delta: props.currentSavingsRate - props.previousSavingsRate,
    isPositiveGood: true,
    isCurrency: false,
  },
]);

function calcDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function isImprovement(row: ComparisonRow): boolean {
  if (row.isPositiveGood) return row.delta > 0;
  return row.delta < 0;
}

function deltaColor(row: ComparisonRow): string {
  if (row.delta === 0) return 'text-text-secondary-light dark:text-text-secondary-dark';
  return isImprovement(row) ? 'text-success' : 'text-danger';
}

function deltaIcon(row: ComparisonRow): string {
  if (row.delta === 0) return 'remove';
  return row.delta > 0 ? 'arrow_upward' : 'arrow_downward';
}
</script>

<template>
  <UCard class="p-5">
    <h3 class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
      Сравнение с прошлым периодом
    </h3>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="flex items-center justify-between">
        <Skeleton class="h-4 w-20 rounded" />
        <div class="flex items-center gap-3">
          <Skeleton class="h-4 w-24 rounded" />
          <Skeleton class="h-5 w-16 rounded" />
        </div>
      </div>
    </div>

    <!-- No data -->
    <div
      v-else-if="noData"
      class="py-4 text-center text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      Недостаточно данных для сравнения
    </div>

    <!-- Comparison rows -->
    <div v-else class="space-y-4">
      <div v-for="row in rows" :key="row.label" class="flex items-center justify-between">
        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          {{ row.label }}
        </span>
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{
              row.isCurrency
                ? formatCurrency(row.current, currency, COMPACT_FORMAT)
                : formatPercentage(row.current, 0)
            }}
          </span>
          <div class="flex items-center gap-0.5 min-w-[72px] justify-end" :class="deltaColor(row)">
            <UIcon :name="deltaIcon(row)" size="xs" />
            <span class="text-sm font-semibold">
              {{ formatPercentage(Math.abs(row.delta), 0) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
