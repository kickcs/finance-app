<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, Skeleton } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import { mapExpenseCategoryStats } from '@/features/analytics-filters';
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
import {
  formatFinancialPeriod,
  getCurrentFinancialMonth,
} from '@/shared/lib/utils/financialPeriod';
import { useDashboardContext } from '../../model/dashboardContext';
import {
  SECTION_LABEL_CLASS,
  VIEW_ALL_BTN_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  iconTileStyle,
} from './constants';

const { categoryBreakdown, currency, isHidden, analyticsLoading, nav, convert } =
  useDashboardContext();

const { startDay: financialPeriodStartDay, isCustomPeriod } = useFinancialPeriod();

const periodTitle = computed(() => {
  if (!isCustomPeriod.value) return 'Расходы за месяц';
  const { year, month } = getCurrentFinancialMonth(financialPeriodStartDay.value);
  return formatFinancialPeriod(year, month, financialPeriodStartDay.value);
});

const topExpenses = computed(() =>
  mapExpenseCategoryStats(categoryBreakdown.value, convert).slice(0, 3),
);

const maxAmount = computed(() =>
  topExpenses.value.length > 0 ? topExpenses.value[0].amount || 1 : 1,
);

function barWidth(amount: number): string {
  return `${Math.max(2, (amount / maxAmount.value) * 100)}%`;
}
</script>

<template>
  <section data-testid="compact-top-expenses" :class="SECTION_CARD_CLASS">
    <div :class="SECTION_HEADER_CLASS">
      <p :class="[SECTION_LABEL_CLASS, 'truncate']">
        {{ periodTitle }}
      </p>
      <button
        type="button"
        :class="[VIEW_ALL_BTN_CLASS, 'shrink-0']"
        @click="nav.toAnalytics('expense')"
      >
        Детали
      </button>
    </div>
    <div class="px-3 py-2.5 space-y-2">
      <template v-if="analyticsLoading">
        <div v-for="i in 3" :key="`te-sk-${i}`" class="space-y-1.5">
          <div class="flex items-center gap-2">
            <Skeleton class="w-5 h-5 rounded shrink-0" />
            <Skeleton class="h-3 flex-1 rounded" />
            <Skeleton class="h-3 w-12 rounded" />
          </div>
          <Skeleton class="h-1 rounded-full" />
        </div>
      </template>
      <template v-else-if="isHidden">
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark text-center py-2">
          Данные скрыты
        </p>
      </template>
      <template v-else-if="topExpenses.length === 0">
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark text-center py-2">
          Нет расходов в этом периоде
        </p>
      </template>
      <template v-else>
        <div v-for="cat in topExpenses" :key="cat.id" class="space-y-1">
          <div class="flex items-center gap-2">
            <div
              class="shrink-0 w-5 h-5 rounded-md flex items-center justify-center"
              :style="iconTileStyle(cat.color)"
            >
              <UIcon :name="cat.icon" size="xs" :style="{ color: cat.color }" />
            </div>
            <span
              class="flex-1 text-xs font-semibold truncate text-text-primary-light dark:text-text-primary-dark"
            >
              {{ cat.name }}
            </span>
            <span
              class="text-caption-sm font-medium tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              {{ cat.percent.toFixed(0) }}%
            </span>
            <span
              class="text-xs font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark shrink-0"
            >
              {{ formatCurrency(cat.amount, currency, COMPACT_FORMAT) }}
            </span>
          </div>
          <div class="h-1 rounded-full overflow-hidden bg-surface-light dark:bg-surface-dark">
            <div
              class="h-full rounded-full transition-all duration-300"
              :style="{ width: barWidth(cat.amount), backgroundColor: cat.color }"
            />
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
