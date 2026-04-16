<script setup lang="ts">
import { computed } from 'vue';
import { Skeleton } from '@/shared/ui';
import { formatMasked, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import { useDashboardContext } from '../../model/dashboardContext';
import { STATS_LABEL_CLASS } from './constants';

const {
  currency,
  isHidden,
  avgDailyExpense,
  safeDailyLimit,
  daysRemainingInMonth,
  analyticsLoading,
  ratesLoading,
  nav,
} = useDashboardContext();

const metricsAvailable = computed(
  () => avgDailyExpense.value !== null && safeDailyLimit.value !== null,
);
const statsLoading = computed(() => analyticsLoading.value || ratesLoading.value);
</script>

<template>
  <button
    type="button"
    aria-label="Аналитика расходов"
    class="group rounded-2xl bg-card-light dark:bg-card-dark shadow-sm transition-all duration-300 md:hover:-translate-y-0.5 md:hover:shadow-md overflow-hidden"
    @click="nav.toAnalytics('expense')"
  >
    <div class="grid grid-cols-3 divide-x divide-border-light dark:divide-border-dark">
      <div class="py-3 px-2 text-center">
        <p :class="STATS_LABEL_CLASS">Расход/дн</p>
        <Skeleton v-if="statsLoading" class="h-4 w-14 mx-auto mt-1 rounded" />
        <p
          v-else-if="metricsAvailable"
          class="text-sm font-bold text-warning mt-0.5 tabular-nums truncate"
        >
          {{ formatMasked(avgDailyExpense!, currency, isHidden, COMPACT_FORMAT) }}
        </p>
        <p
          v-else
          class="text-sm font-bold text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5"
        >
          —
        </p>
      </div>
      <div class="py-3 px-2 text-center">
        <p :class="STATS_LABEL_CLASS">Безопасно</p>
        <Skeleton v-if="statsLoading" class="h-4 w-14 mx-auto mt-1 rounded" />
        <p
          v-else-if="metricsAvailable"
          class="text-sm font-bold mt-0.5 tabular-nums truncate"
          :class="safeDailyLimit! >= 0 ? 'text-success' : 'text-danger'"
        >
          {{ formatMasked(safeDailyLimit!, currency, isHidden, COMPACT_FORMAT) }}
        </p>
        <p
          v-else
          class="text-sm font-bold text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5"
        >
          —
        </p>
      </div>
      <div class="py-3 px-2 text-center">
        <p :class="STATS_LABEL_CLASS">Осталось</p>
        <p
          class="text-sm font-bold text-text-primary-light dark:text-text-primary-dark mt-0.5 tabular-nums"
        >
          {{ daysRemainingInMonth }} дн
        </p>
      </div>
    </div>
  </button>
</template>
