<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { UCard, UIcon } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';

const props = defineProps<{
  totalIncome: number;
  totalExpense: number;
  currency: string;
  totalBalance?: number;
}>();

// Animation state
const isAnimated = ref(false);

onMounted(() => {
  setTimeout(() => {
    isAnimated.value = true;
  }, 100);
});

// Savings calculations
const savings = computed(() =>
  props.totalBalance !== undefined
    ? props.totalBalance
    : props.totalIncome - props.totalExpense,
);

const savingsRate = computed(() => {
  if (props.totalIncome <= 0) return 0;
  if (props.totalBalance !== undefined) {
    return (props.totalBalance / props.totalIncome) * 100;
  }
  return ((props.totalIncome - props.totalExpense) / props.totalIncome) * 100;
});

// Clamp savings rate between 0 and 100 for visualization
const displayRate = computed(() =>
  Math.max(0, Math.min(100, savingsRate.value)),
);

// Status zone
type StatusZone = 'critical' | 'normal' | 'good' | 'excellent';

const statusZone = computed<StatusZone>(() => {
  const rate = savingsRate.value;
  if (rate < 10) return 'critical';
  if (rate < 20) return 'normal';
  if (rate < 50) return 'good';
  return 'excellent';
});

const statusConfig = {
  critical: {
    color: '#ef4444', // red
    gradient: 'from-red-500 to-red-600',
    label: 'Критично',
    message: 'Попробуйте сократить расходы',
    icon: 'sentiment_very_dissatisfied',
  },
  normal: {
    color: '#f59e0b', // amber
    gradient: 'from-amber-400 to-amber-500',
    label: 'Норма',
    message: 'Попробуйте увеличить сбережения до 20%',
    icon: 'sentiment_neutral',
  },
  good: {
    color: '#10b981', // green
    gradient: 'from-emerald-400 to-emerald-500',
    label: 'Отлично',
    message: 'Вы откладываете больше 20%!',
    icon: 'sentiment_satisfied',
  },
  excellent: {
    color: '#3b82f6', // blue
    gradient: 'from-blue-400 to-blue-500',
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

// Arc path for semicircle
const arcPath = computed(() => {
  const startAngle = Math.PI; // Left (180 degrees)
  const endAngle = 0; // Right (0 degrees)

  const x1 = centerX + radius * Math.cos(startAngle);
  const y1 = centerY + radius * Math.sin(startAngle);
  const x2 = centerX + radius * Math.cos(endAngle);
  const y2 = centerY + radius * Math.sin(endAngle);

  return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
});

// Progress dash offset
const progressOffset = computed(() => {
  const progress = isAnimated.value ? displayRate.value / 100 : 0;
  return circumference * (1 - progress);
});
</script>

<template>
  <UCard class="p-5">
    <h3
      class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4"
    >
      Норма сбережений
    </h3>

    <!-- Gauge -->
    <div class="flex justify-center mb-4">
      <div class="relative">
        <svg
          :width="size"
          :height="size / 2 + 10"
          :viewBox="`0 0 ${size} ${size / 2 + 10}`"
        >
          <!-- Background arc -->
          <path
            :d="arcPath"
            fill="none"
            :stroke-width="strokeWidth"
            stroke-linecap="round"
            class="stroke-gray-100 dark:stroke-gray-800"
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
            <UIcon
              :name="currentStatus.icon"
              size="lg"
              :style="{ color: currentStatus.color }"
            />
          </div>
          <p class="text-3xl font-bold" :style="{ color: currentStatus.color }">
            {{ Math.min(savingsRate, 999).toFixed(0) }}%
          </p>
          <p
            class="text-sm font-medium"
            :style="{ color: currentStatus.color }"
          >
            {{ currentStatus.label }}
          </p>
        </div>
      </div>
    </div>

    <!-- Stats breakdown - 3 rows layout -->
    <div class="space-y-3 py-3 border-t border-gray-100 dark:border-gray-800">
      <!-- Income row -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center"
          >
            <UIcon name="trending_up" size="sm" class="text-success" />
          </div>
          <span
            class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
          >
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
          <div
            class="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center"
          >
            <UIcon name="trending_down" size="sm" class="text-danger" />
          </div>
          <span
            class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
          >
            Расходы
          </span>
        </div>
        <span class="font-semibold text-danger">
          -{{ formatCurrency(totalExpense, currency, COMPACT_FORMAT) }}
        </span>
      </div>

      <!-- Savings row -->
      <div
        class="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800"
      >
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center"
            :class="savings >= 0 ? 'bg-primary/10' : 'bg-danger/10'"
          >
            <UIcon
              :name="savings >= 0 ? 'savings' : 'warning'"
              size="sm"
              :class="savings >= 0 ? 'text-primary' : 'text-danger'"
            />
          </div>
          <span
            class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
          >
            {{ totalBalance !== undefined ? 'Текущий баланс' : 'Сбережения' }}
          </span>
        </div>
        <span
          class="font-bold text-lg"
          :class="savings >= 0 ? 'text-primary' : 'text-danger'"
        >
          {{ savings >= 0 ? '+' : ''
          }}{{ formatCurrency(savings, currency, COMPACT_FORMAT) }}
        </span>
      </div>
    </div>

    <!-- Motivational message -->
    <div
      class="mt-3 p-3 rounded-xl text-center"
      :style="{ backgroundColor: `${currentStatus.color}10` }"
    >
      <p class="text-sm font-medium" :style="{ color: currentStatus.color }">
        {{ currentStatus.message }}
      </p>
    </div>
  </UCard>
</template>
