<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue';
import { UCard, UProgressBar, Skeleton } from '@/shared/ui';
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

function useAnimatedValue(getter: () => number) {
  const animated = ref(getter());
  let rafId = 0;

  watch(
    getter,
    (to) => {
      const from = animated.value;
      if (from === to) return;

      cancelAnimationFrame(rafId);
      const start = performance.now();
      const duration = 400;

      function tick(now: number) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        animated.value = from + (to - from) * eased;
        if (t < 1) rafId = requestAnimationFrame(tick);
      }

      rafId = requestAnimationFrame(tick);
    },
    { immediate: true },
  );

  onUnmounted(() => cancelAnimationFrame(rafId));

  return animated;
}

const animatedIncome = useAnimatedValue(() => props.income);
const animatedExpense = useAnimatedValue(() => props.expense);
const animatedBalance = computed(() => animatedIncome.value - animatedExpense.value);
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
            +{{ formatCurrency(animatedIncome, currency, COMPACT_FORMAT) }}
          </span>
        </div>
        <UProgressBar :value="incomeWidth" color="success" size="lg" />
      </div>

      <!-- Expense bar -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Расходы
          </span>
          <span class="text-base font-semibold text-danger">
            -{{ formatCurrency(animatedExpense, currency, COMPACT_FORMAT) }}
          </span>
        </div>
        <UProgressBar :value="expenseWidth" color="danger" size="lg" />
      </div>

      <!-- Balance -->
      <div
        class="flex items-center justify-between pt-3 border-t border-border-light dark:border-border-dark"
      >
        <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          Баланс
        </span>
        <span class="text-lg font-bold" :class="balance >= 0 ? 'text-primary' : 'text-danger'">
          {{ animatedBalance >= 0 ? '+' : ''
          }}{{ formatCurrency(animatedBalance, currency, COMPACT_FORMAT) }}
        </span>
      </div>
    </template>
  </UCard>
</template>
