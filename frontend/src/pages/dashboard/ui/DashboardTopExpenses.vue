<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/shared/config/routeNames';
import type { CategoryBreakdown } from '@/entities/transaction';
import { mapExpenseCategoryStats } from '@/features/analytics-filters';
import { TopCategories } from '@/widgets/analytics/top-categories';
import { SectionHeader, Skeleton, EmptyState, UCard, UIcon } from '@/shared/ui';
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
import {
  formatFinancialPeriod,
  getCurrentFinancialMonth,
} from '@/shared/lib/utils/financialPeriod';

const props = defineProps<{
  categoryBreakdown: CategoryBreakdown[];
  currency: string;
  loading: boolean;
  isHidden: boolean;
}>();

const emit = defineEmits<{
  'configure-period': [];
}>();
const router = useRouter();
const { startDay, isCustomPeriod } = useFinancialPeriod();

const periodTitle = computed(() => {
  if (!isCustomPeriod.value) return 'Расходы за месяц';
  const { year, month } = getCurrentFinancialMonth(startDay.value);
  return formatFinancialPeriod(year, month, startDay.value);
});

const topExpenses = computed(() => mapExpenseCategoryStats(props.categoryBreakdown));

function goToAnalytics() {
  router.push({ name: ROUTE_NAMES.ANALYTICS });
}
</script>

<template>
  <div>
    <SectionHeader
      :title="periodTitle"
      :show-add="false"
      view-all-text="Детали"
      @view-all="goToAnalytics"
    />

    <!-- Hint: suggest changing the period start day -->
    <button
      v-if="!isCustomPeriod && !loading"
      class="flex items-center gap-1 mt-1 text-[0.65rem] text-text-tertiary-light dark:text-text-tertiary-dark hover:text-primary transition-colors"
      @click="emit('configure-period')"
    >
      <UIcon name="calendar_month" size="xs" class="opacity-60" />
      <span>Зарплата не 1-го? Настройте начало месяца</span>
    </button>

    <div class="mt-3">
      <!-- Loading skeleton -->
      <UCard v-if="loading" padding="lg" variant="bordered" class="shadow-sm">
        <div class="space-y-4">
          <div v-for="i in 3" :key="i" class="space-y-2">
            <div class="flex items-center gap-3">
              <Skeleton class="w-5 h-5 rounded" />
              <Skeleton class="w-8 h-8 rounded-lg" />
              <Skeleton class="flex-1 h-4 rounded" />
              <Skeleton class="w-16 h-4 rounded" />
            </div>
            <Skeleton class="h-1.5 rounded-full" />
          </div>
        </div>
      </UCard>

      <!-- Hidden state -->
      <UCard v-else-if="isHidden" padding="lg" variant="bordered" class="shadow-sm">
        <p class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark text-center py-2">
          Данные скрыты
        </p>
      </UCard>

      <!-- Empty state -->
      <UCard v-else-if="topExpenses.length === 0" padding="lg" variant="bordered" class="shadow-sm">
        <EmptyState
          icon="category"
          title="Нет расходов"
          description="В этом месяце нет расходов"
          variant="inline"
        />
      </UCard>

      <!-- Data -->
      <TopCategories v-else :categories="topExpenses" :currency="currency" :limit="3" />
    </div>
  </div>
</template>
