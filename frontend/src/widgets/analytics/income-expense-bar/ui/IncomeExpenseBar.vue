<script setup lang="ts">
import { computed } from 'vue';
import { UCard, Skeleton } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';

const props = defineProps<{
  income: number;
  expense: number;
  currency: string;
  loading?: boolean;
}>();

const maxValue = computed(() => Math.max(props.income, props.expense, 1));

const incomeWidth = computed(() => Math.max(4, (props.income / maxValue.value) * 100));
const expenseWidth = computed(() => Math.max(4, (props.expense / maxValue.value) * 100));

const balance = computed(() => props.income - props.expense);
</script>

<template>
  <UCard class="p-5 space-y-4">
    <!-- Loading -->
    <template v-if="loading">
      <div v-for="i in 2" :key="i" class="space-y-2">
        <div class="flex justify-between">
          <Skeleton class="h-4 w-16 rounded" />
          <Skeleton class="h-5 w-28 rounded" />
        </div>
        <Skeleton class="h-3 rounded-full" />
      </div>
      <div class="flex justify-between pt-3 border-t border-border-light dark:border-border-dark">
        <Skeleton class="h-4 w-16 rounded" />
        <Skeleton class="h-6 w-32 rounded" />
      </div>
    </template>

    <template v-else>
      <!-- Income bar -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Доходы
          </span>
          <span class="text-base font-semibold text-success">
            +{{ formatCurrency(income, currency, COMPACT_FORMAT) }}
          </span>
        </div>
        <div class="h-2.5 bg-surface-light dark:bg-surface-dark rounded-full overflow-hidden">
          <div
            class="h-full bg-success rounded-full transition-all duration-500 ease-out"
            :style="{ width: `${incomeWidth}%` }"
          />
        </div>
      </div>

      <!-- Expense bar -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Расходы
          </span>
          <span class="text-base font-semibold text-danger">
            -{{ formatCurrency(expense, currency, COMPACT_FORMAT) }}
          </span>
        </div>
        <div class="h-2.5 bg-surface-light dark:bg-surface-dark rounded-full overflow-hidden">
          <div
            class="h-full bg-danger rounded-full transition-all duration-500 ease-out"
            :style="{ width: `${expenseWidth}%` }"
          />
        </div>
      </div>

      <!-- Balance -->
      <div
        class="flex items-center justify-between pt-3 border-t border-border-light dark:border-border-dark"
      >
        <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          Баланс
        </span>
        <span class="text-lg font-bold" :class="balance >= 0 ? 'text-primary' : 'text-danger'">
          {{ balance >= 0 ? '+' : '' }}{{ formatCurrency(balance, currency, COMPACT_FORMAT) }}
        </span>
      </div>
    </template>
  </UCard>
</template>
