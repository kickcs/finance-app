<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { UCard, UIcon, Skeleton } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';

const props = defineProps<{
  totalIncome: number;
  totalExpense: number;
  availableBalance: number;
  currency: string;
  loading?: boolean;
}>();

// Animation state
const isAnimated = ref(false);

useTimeoutFn(() => {
  isAnimated.value = true;
}, 100);

// Balance-aware availableBalance rate:
// totalAvailable = startBalance + income = (currentBalance - income + expense) + income = currentBalance + expense
// retentionRate = currentBalance / totalAvailable
const availableBalanceRate = computed(() => {
  const totalAvailable = props.availableBalance + props.totalExpense;
  if (totalAvailable <= 0) return 0;
  return (props.availableBalance / totalAvailable) * 100;
});

// Clamp availableBalance rate between 0 and 100 for visualization
const displayRate = computed(() => Math.max(0, Math.min(100, availableBalanceRate.value)));

// Status zone
type StatusZone = 'critical' | 'normal' | 'good' | 'excellent';

const statusZone = computed<StatusZone>(() => {
  const rate = availableBalanceRate.value;
  if (rate < 10) return 'critical';
  if (rate < 20) return 'normal';
  if (rate < 50) return 'good';
  return 'excellent';
});

const statusConfig = {
  critical: {
    color: 'var(--color-danger)',
    label: 'Критично',
    message: 'Попробуйте сократить расходы',
    icon: 'sentiment_very_dissatisfied',
  },
  normal: {
    color: 'var(--color-warning)',
    label: 'Норма',
    message: 'Попробуйте увеличить сбережения до 20%',
    icon: 'sentiment_neutral',
  },
  good: {
    color: 'var(--color-success)',
    label: 'Отлично',
    message: 'Вы откладываете больше 20%!',
    icon: 'sentiment_satisfied',
  },
  excellent: {
    color: 'var(--color-primary)',
    label: 'Супер',
    message: 'Превосходный результат! Более 50%',
    icon: 'sentiment_very_satisfied',
  },
};

const currentStatus = computed(() => statusConfig[statusZone.value]);

// SVG gauge configuration
const size = 200;
const strokeWidth = 20;
const radius = (size - strokeWidth) / 2;
const circumference = Math.PI * radius; // Half circle
const centerX = size / 2;
const centerY = size / 2;

// Arc path for semicircle (static — no reactive deps)
const x1 = centerX + radius * Math.cos(Math.PI);
const y1 = centerY + radius * Math.sin(Math.PI);
const x2 = centerX + radius;
const y2 = centerY;
const arcPath = `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;

// Progress dash offset
const progressOffset = computed(() => {
  const progress = isAnimated.value ? displayRate.value / 100 : 0;
  return circumference * (1 - progress);
});
</script>

<template>
  <UCard class="p-5">
    <h3 class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
      Норма сбережений
    </h3>

    <template v-if="loading">
      <div class="flex flex-col items-center gap-4">
        <Skeleton class="h-[110px] w-[200px] rounded-t-full" />
        <div class="w-full space-y-3">
          <div v-for="i in 3" :key="i" class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Skeleton class="w-8 h-8 rounded-lg" />
              <Skeleton class="h-4 w-16 rounded" />
            </div>
            <Skeleton class="h-5 w-24 rounded" />
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <!-- Gauge -->
      <div class="flex justify-center mb-4">
        <div class="relative">
          <svg :width="size" :height="size / 2 + 10" :viewBox="`0 0 ${size} ${size / 2 + 10}`">
            <!-- Background arc -->
            <path
              :d="arcPath"
              fill="none"
              :stroke-width="strokeWidth"
              stroke-linecap="round"
              class="stroke-surface-light dark:stroke-surface-dark"
            />

            <!-- Progress arc -->
            <path
              :d="arcPath"
              fill="none"
              :stroke="currentStatus.color"
              :stroke-width="strokeWidth"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="progressOffset"
              class="transition-all duration-1000 ease-out"
            />
          </svg>

          <!-- Center content -->
          <div class="absolute inset-x-0 bottom-0 text-center">
            <div class="flex items-center justify-center gap-2 mb-1">
              <UIcon :name="currentStatus.icon" size="lg" :style="{ color: currentStatus.color }" />
            </div>
            <p class="text-3xl font-bold" :style="{ color: currentStatus.color }">
              {{ Math.min(availableBalanceRate, 999).toFixed(0) }}%
            </p>
            <p class="text-sm font-medium" :style="{ color: currentStatus.color }">
              {{ currentStatus.label }}
            </p>
          </div>
        </div>
      </div>

      <!-- Stats breakdown - 3 rows layout -->
      <div class="space-y-3 py-3 border-t border-border-light dark:border-border-dark">
        <!-- Income row -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-success-light flex items-center justify-center">
              <UIcon name="trending_up" size="sm" class="text-success" />
            </div>
            <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Доходы
            </span>
          </div>
          <span class="font-semibold text-success">
            +{{ formatCurrency(totalIncome, currency, COMPACT_FORMAT) }}
          </span>
        </div>

        <!-- Expense row -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-danger-light flex items-center justify-center">
              <UIcon name="trending_down" size="sm" class="text-danger" />
            </div>
            <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Расходы
            </span>
          </div>
          <span class="font-semibold text-danger">
            -{{ formatCurrency(totalExpense, currency, COMPACT_FORMAT) }}
          </span>
        </div>

        <!-- Savings row -->
        <div
          class="flex items-center justify-between pt-2 border-t border-border-light dark:border-border-dark"
        >
          <div class="flex items-center gap-2">
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center"
              :class="availableBalance >= 0 ? 'bg-primary-light' : 'bg-danger-light'"
            >
              <UIcon
                :name="availableBalance >= 0 ? 'availableBalance' : 'warning'"
                size="sm"
                :class="availableBalance >= 0 ? 'text-primary' : 'text-danger'"
              />
            </div>
            <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              Сбережения
            </span>
          </div>
          <span
            class="font-bold text-lg"
            :class="availableBalance >= 0 ? 'text-primary' : 'text-danger'"
          >
            {{ availableBalance >= 0 ? '+' : ''
            }}{{ formatCurrency(availableBalance, currency, COMPACT_FORMAT) }}
          </span>
        </div>
      </div>

      <!-- Motivational message -->
      <div class="mt-3 p-3 rounded-xl text-center bg-surface-light dark:bg-surface-dark">
        <p class="text-sm font-medium" :style="{ color: currentStatus.color }">
          {{ totalIncome <= 0 ? 'Нет дохода за период' : currentStatus.message }}
        </p>
      </div>
    </template>
  </UCard>
</template>
