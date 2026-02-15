<script setup lang="ts">
import { computed } from 'vue';
import { UCard, UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';

const props = defineProps<{
  totalExpense: number;
  totalIncome: number;
  daysInPeriod: number;
  daysRemainingInMonth: number;
  currency: string;
}>();

// Average daily expense
const avgDailyExpense = computed(() => {
  if (props.daysInPeriod <= 0) return 0;
  return props.totalExpense / props.daysInPeriod;
});

// Safe daily spending (how much can be spent per remaining day)
const safeDaily = computed(() => {
  if (props.daysRemainingInMonth <= 0) return 0;
  const remaining = props.totalIncome - props.totalExpense;
  return remaining / props.daysRemainingInMonth;
});

// Status for safe daily spending
const safeDailyStatus = computed<'good' | 'warning' | 'danger'>(() => {
  if (safeDaily.value <= 0) return 'danger';
  if (safeDaily.value < avgDailyExpense.value) return 'warning';
  return 'good';
});

const statusConfig = {
  good: {
    bg: 'bg-success-light',
    text: 'text-success',
    icon: 'check_circle',
    message: 'Отличный результат! Вы в плюсе',
  },
  warning: {
    bg: 'bg-warning-light',
    text: 'text-warning',
    icon: 'warning',
    message: 'Осторожно! Расходы превышают норму',
  },
  danger: {
    bg: 'bg-danger-light',
    text: 'text-danger',
    icon: 'error',
    message: 'Внимание! Расходы превысили доходы',
  },
};
</script>

<template>
  <div class="space-y-3">
    <!-- Average Daily Expense Card -->
    <UCard padding="md">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center"
          >
            <UIcon name="calendar_today" size="sm" class="text-primary" />
          </div>
          <div>
            <p
              class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              Средний расход
            </p>
            <p
              class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              за {{ daysInPeriod }} дн.
            </p>
          </div>
        </div>
        <div class="text-right">
          <p
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            {{ formatCurrency(avgDailyExpense, currency) }}
          </p>
          <p
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            /день
          </p>
        </div>
      </div>
    </UCard>

    <!-- Safe Daily Spending Card -->
    <UCard padding="md">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-9 h-9 rounded-lg flex items-center justify-center"
            :class="statusConfig[safeDailyStatus].bg"
          >
            <UIcon
              name="savings"
              size="sm"
              :class="statusConfig[safeDailyStatus].text"
            />
          </div>
          <div>
            <p
              class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              Безопасный остаток
            </p>
            <p
              class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              осталось {{ daysRemainingInMonth }} дн.
            </p>
          </div>
        </div>
        <div class="text-right">
          <p
            class="text-base font-semibold"
            :class="statusConfig[safeDailyStatus].text"
          >
            {{ formatCurrency(Math.max(0, safeDaily), currency) }}
          </p>
          <p
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            /день
          </p>
        </div>
      </div>

      <!-- Status indicator -->
      <div
        class="mt-3 pt-3 border-t border-border-light dark:border-border-dark flex items-center gap-2 text-xs"
        :class="statusConfig[safeDailyStatus].text"
      >
        <UIcon :name="statusConfig[safeDailyStatus].icon" size="xs" />
        <span>{{ statusConfig[safeDailyStatus].message }}</span>
      </div>
    </UCard>
  </div>
</template>
