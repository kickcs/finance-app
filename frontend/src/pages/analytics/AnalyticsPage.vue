<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, useTemplateRef } from 'vue';
import { useRoute } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { AppHeader } from '@/widgets/header';
import {
  IncomeExpenseBar,
  DailyStatsCards,
  SavingsGauge,
  DonutChart,
  DailyExpenseChart,
  PeriodComparison,
  SpendingPaceChart,
  type DonutSegment,
} from '@/widgets/analytics';
import { PageContainer, UTabs, UCard, EmptyState, Skeleton } from '@/shared/ui';
import { useDailyStats, transactionQueryKeys } from '@/entities/transaction';
import { useBudget } from '@/entities/budget';
import { useAccounts } from '@/entities/account';
import { toLocalISODate } from '@/shared/lib/date';
import {
  FilterChips,
  SwipeablePeriodHeader,
  useAnalyticsFilters,
  useConvertedAnalytics,
  usePeriodNavigation,
  mapCategoryStats,
  type PeriodScale,
} from '@/features/analytics-filters';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
import { useHaptics } from '@/shared/lib/haptics/haptics';

const route = useRoute();
const queryClient = useQueryClient();
const { userId } = useCurrentUser();
const { currency } = useUserCurrency();
const { trigger } = useHaptics();

// --- Period navigation ---
const {
  scale,
  offset,
  dateRange,
  comparisonDateRange,
  label,
  sublabel,
  isCurrentPeriod,
  canGoNext,
  canGoPrev,
  daysInPeriod,
  setScale,
  next,
  prev,
  goToday,
} = usePeriodNavigation();

// --- Account filters ---
const { filters, toggleAccount, clearAccountFilters } = useAnalyticsFilters();

const { accounts } = useAccounts(userId);

const accountChips = computed(() =>
  accounts.value.map((acc) => ({
    id: acc.id,
    name: acc.name,
    icon: acc.icon,
    color: acc.color,
  })),
);

const showAccountFilter = computed(() => accountChips.value.length > 1);

// --- Scale tabs ---
const scaleItems = [
  { id: 'day', label: 'День' },
  { id: 'month', label: 'Месяц' },
  { id: 'year', label: 'Год' },
];

// --- Main analytics data ---
const startDateStr = computed(() => dateRange.value.startDate);
const endDateStr = computed(() => dateRange.value.endDate);

const analyticsOptions = {
  startDate: startDateStr,
  endDate: endDateStr,
  accountIds: computed(() => filters.value.selectedAccountIds),
};

const {
  convertedIncome,
  convertedExpense,
  savingsRate,
  categoryBreakdown,
  convertAmount,
  isLoading: analyticsLoading,
  isFetching: analyticsFetching,
} = useConvertedAnalytics(analyticsOptions, currency);

// --- Comparison data (previous period) ---
const {
  convertedExpense: prevExpense,
  convertedIncome: prevIncome,
  savingsRate: prevSavingsRate,
  isLoading: prevLoading,
} = useConvertedAnalytics(
  {
    startDate: computed(() => comparisonDateRange.value.startDate),
    endDate: computed(() => comparisonDateRange.value.endDate),
    accountIds: computed(() => filters.value.selectedAccountIds),
  },
  currency,
);

const comparisonPercent = computed(() => {
  if (prevLoading.value || prevExpense.value === 0) return undefined;
  const diff = convertedExpense.value - prevExpense.value;
  return (diff / prevExpense.value) * 100;
});

// --- Available balance ---
const availableBalance = computed(() => {
  const selectedIds = filters.value.selectedAccountIds;
  const filtered =
    selectedIds.length > 0
      ? accounts.value.filter((a) => selectedIds.includes(a.id))
      : accounts.value.filter((a) => a.type === 'basic');

  return filtered.reduce((sum, acc) => {
    return (
      sum +
      acc.balances.reduce((bSum, b) => {
        const bal = acc.type === 'credit_card' ? Math.max(0, b.balance) : b.balance;
        return bSum + convertAmount(bal, b.currency);
      }, 0)
    );
  }, 0);
});

// --- Spending Pace (Month scale only, for viewed month) ---
const { daysRemaining: financialDaysRemaining } = useFinancialPeriod();
const { budget, isLoading: budgetLoading } = useBudget(userId);

const showPace = computed(() => scale.value === 'month' && (!!budget.value || budgetLoading.value));

const paceTodayIndex = computed(() => {
  if (!isCurrentPeriod.value) return daysInPeriod.value;
  const start = new Date(dateRange.value.startDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = today.getTime() - start.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
});

const { entries: paceRaw, isLoading: paceStatsLoading } = useDailyStats({
  startDate: computed(() => (showPace.value ? startDateStr.value : null)),
  endDate: computed(() => (showPace.value ? endDateStr.value : null)),
  accountIds: computed(() => filters.value.selectedAccountIds),
  groupBy: 'day',
});

const paceLoading = computed(() => paceStatsLoading.value || budgetLoading.value);

function convertExpenseByCurrency(byCurrency: Record<string, number>): number {
  return Object.entries(byCurrency).reduce((sum, [c, a]) => sum + convertAmount(a, c), 0);
}

const paceBudgetAmount = computed(() => {
  if (!budget.value) return 0;
  const { amount, currency: budgetCurrency } = budget.value.budget;
  if (budgetCurrency === currency.value) return amount;
  return convertAmount(amount, budgetCurrency);
});

const paceEntries = computed(() => {
  if (paceRaw.value.length === 0) return [];

  const amount = paceBudgetAmount.value;
  const days = daysInPeriod.value;
  const todayIdx = paceTodayIndex.value;

  const expenseMap = new Map<string, number>();
  for (const e of paceRaw.value) {
    expenseMap.set(e.date, convertExpenseByCurrency(e.expense_by_currency));
  }

  let cum = 0;
  const result: { day: number; actual: number; ideal: number; date: string }[] = [];
  const start = new Date(dateRange.value.startDate + 'T00:00:00');

  for (let i = 0; i <= todayIdx; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const ds = toLocalISODate(d);
    cum += expenseMap.get(ds) ?? 0;
    result.push({
      day: i + 1,
      actual: cum,
      ideal: amount > 0 ? (amount / days) * (i + 1) : 0,
      date: ds,
    });
  }

  return result;
});

// --- Conditional widget visibility ---
const showDailyStats = computed(() => scale.value === 'month');
const showTrendsChart = computed(() => scale.value !== 'day');

// --- Categories ---
const categoryType = ref<'expense' | 'income'>('expense');
const categoryTypeItems = [
  { id: 'expense', label: 'Расходы' },
  { id: 'income', label: 'Доходы' },
];

function handleCategoryTypeChange(value: string | number) {
  categoryType.value = value as 'expense' | 'income';
}

const categoryStats = computed(() =>
  mapCategoryStats(categoryBreakdown.value, categoryType.value, convertAmount),
);

const donutTotal = computed(() => categoryStats.value.reduce((sum, s) => sum + s.amount, 0));

const donutSegments = computed<DonutSegment[]>(() =>
  categoryStats.value.map((s) => ({
    id: s.id,
    value: s.amount,
    percent: s.percent,
    color: s.color,
    label: s.name,
    icon: s.icon,
  })),
);

// --- Trends chart ---
const groupBy = computed<'day' | 'week' | 'month'>(() => {
  if (scale.value === 'year') return 'month';
  const days = daysInPeriod.value;
  if (days <= 31) return 'day';
  if (days <= 90) return 'week';
  return 'month';
});

const { entries: dailyEntries, isLoading: dailyLoading } = useDailyStats({
  startDate: computed(() => (showTrendsChart.value ? startDateStr.value : null)),
  endDate: computed(() => (showTrendsChart.value ? endDateStr.value : null)),
  accountIds: computed(() => filters.value.selectedAccountIds),
  groupBy,
});

const chartEntries = computed(() =>
  dailyEntries.value.map((e) => ({
    date: e.date,
    expense: convertExpenseByCurrency(e.expense_by_currency),
  })),
);

// --- Period comparison ---
const noPrevData = computed(() => prevIncome.value === 0 && prevExpense.value === 0);

// --- Empty state ---
const hasNoData = computed(
  () => convertedIncome.value === 0 && convertedExpense.value === 0 && !analyticsLoading.value,
);

// --- Transition ---
const transitionName = ref<'slide-left' | 'slide-right' | 'fade'>('fade');
const transitionKey = computed(() => `${scale.value}-${offset.value}`);

function handlePrev() {
  transitionName.value = 'slide-left';
  prev();
}

function handleNext() {
  transitionName.value = 'slide-right';
  next();
}

function handleToday() {
  transitionName.value = 'slide-right';
  goToday();
}

function handleScaleChange(value: string | number) {
  transitionName.value = 'fade';
  setScale(value as PeriodScale);
}

// --- Full-page swipe ---
const swipeContent = useTemplateRef<HTMLElement>('swipeContent');
let swipeStartX = 0;
let swipeStartY = 0;
let swipeIsHorizontal: boolean | null = null;

const SWIPE_THRESHOLD = 50;

function onSwipeTouchStart(e: TouchEvent) {
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
  swipeIsHorizontal = null;
}

function onSwipeTouchMove(e: TouchEvent) {
  const dx = e.touches[0].clientX - swipeStartX;
  const dy = e.touches[0].clientY - swipeStartY;

  if (swipeIsHorizontal === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
    swipeIsHorizontal = Math.abs(dx) > Math.abs(dy);
  }

  // Only prevent default scroll when clearly horizontal
  if (swipeIsHorizontal) {
    e.preventDefault();
  }
}

function onSwipeTouchEnd(e: TouchEvent) {
  if (!swipeIsHorizontal) return;

  const dx = e.changedTouches[0].clientX - swipeStartX;

  if (Math.abs(dx) >= SWIPE_THRESHOLD) {
    if (dx < 0) {
      // Swipe left → previous period
      trigger('light');
      handlePrev();
    } else if (dx > 0 && canGoNext.value) {
      // Swipe right → next period
      trigger('light');
      handleNext();
    } else if (dx > 0 && !canGoNext.value) {
      trigger('warning');
    }
  }

  swipeIsHorizontal = null;
}

onMounted(() => {
  swipeContent.value?.addEventListener('touchmove', onSwipeTouchMove, { passive: false });
});

onUnmounted(() => {
  swipeContent.value?.removeEventListener('touchmove', onSwipeTouchMove);
});

// --- Prefetch adjacent periods ---
watch([startDateStr, endDateStr, () => filters.value.selectedAccountIds.join(',')], () => {
  const accountIds = filters.value.selectedAccountIds;

  const prevRange = comparisonDateRange.value;
  if (prevRange.startDate && prevRange.endDate) {
    queryClient.prefetchQuery({
      queryKey: transactionQueryKeys.analyticsStats(
        prevRange.startDate,
        prevRange.endDate,
        accountIds,
      ),
    });
  }
});

// --- Read initial query param ---
onMounted(() => {
  const queryType = route.query.type as string | undefined;
  if (queryType === 'income') {
    categoryType.value = 'income';
  } else if (queryType === 'expense') {
    categoryType.value = 'expense';
  }
});
</script>

<template>
  <PageContainer class="relative bg-background-light dark:bg-background-dark">
    <template #header>
      <AppHeader title="Аналитика" />
    </template>

    <!-- Sticky filters -->
    <div
      class="sticky top-0 z-20 -mx-5 lg:-mx-8 px-5 lg:px-8 py-2 space-y-3 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-border-light/50 dark:border-border-dark/50 shadow-sm"
    >
      <UTabs :model-value="scale" :items="scaleItems" @update:model-value="handleScaleChange" />

      <SwipeablePeriodHeader
        :label="label"
        :sublabel="sublabel"
        :can-go-next="canGoNext"
        :can-go-prev="canGoPrev"
        :is-current-period="isCurrentPeriod"
        :comparison-percent="comparisonPercent"
        :comparison-loading="prevLoading"
        @prev="handlePrev"
        @next="handleNext"
        @today="handleToday"
      />

      <FilterChips
        v-if="showAccountFilter"
        :items="accountChips"
        :selected-ids="filters.selectedAccountIds"
        label="Счета"
        @toggle="toggleAccount"
        @clear="clearAccountFilters"
      />
    </div>

    <!-- Content with swipe + slide transition -->
    <main
      ref="swipeContent"
      class="pt-4 pb-28 md:pb-8"
      @touchstart="onSwipeTouchStart"
      @touchend="onSwipeTouchEnd"
    >
      <!-- Loading indicator for period navigation -->
      <Transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="analyticsFetching && !analyticsLoading" class="flex justify-center py-1 mb-2">
          <div class="h-0.5 w-16 rounded-full bg-primary/40 overflow-hidden">
            <div
              class="h-full w-1/2 rounded-full bg-primary animate-[shimmer_1s_ease-in-out_infinite]"
            />
          </div>
        </div>
      </Transition>

      <Transition :name="transitionName" mode="out-in">
        <div :key="transitionKey" class="space-y-4">
          <!-- Empty state -->
          <UCard v-if="hasNoData" variant="bordered" class="py-8">
            <EmptyState
              icon="bar_chart"
              title="Нет транзакций"
              description="Нет данных за выбранный период"
            />
          </UCard>

          <template v-else>
            <!-- === OVERVIEW SECTION === -->
            <div class="flex flex-col lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
              <div class="lg:col-span-2">
                <IncomeExpenseBar
                  :income="convertedIncome"
                  :expense="convertedExpense"
                  :currency="currency"
                  :loading="analyticsLoading"
                />
              </div>

              <SpendingPaceChart
                v-if="showPace || paceLoading"
                :entries="paceEntries"
                :budget-amount="paceBudgetAmount"
                :total-days="daysInPeriod"
                :today-index="paceTodayIndex"
                :currency="currency"
                :period-label="label"
                :loading="paceLoading"
              />

              <SavingsGauge
                :total-income="convertedIncome"
                :total-expense="convertedExpense"
                :available-balance="availableBalance"
                :currency="currency"
                :loading="analyticsLoading"
              />

              <div v-if="showDailyStats" class="lg:col-span-2">
                <DailyStatsCards
                  :total-expense="convertedExpense"
                  :available-balance="availableBalance"
                  :days-in-period="daysInPeriod"
                  :days-remaining-in-month="isCurrentPeriod ? financialDaysRemaining : daysInPeriod"
                  :currency="currency"
                  :is-past-period="!isCurrentPeriod"
                  :balance-label="
                    filters.selectedAccountIds.length > 0 ? 'По выбранным счетам' : undefined
                  "
                  :loading="analyticsLoading"
                />
              </div>
            </div>

            <!-- === CATEGORIES SECTION === -->
            <div class="border-t border-border-light/50 dark:border-border-dark/50 pt-4 space-y-4">
              <UTabs
                :model-value="categoryType"
                :items="categoryTypeItems"
                size="sm"
                @update:model-value="handleCategoryTypeChange"
              />

              <template v-if="analyticsLoading">
                <Skeleton class="h-48 w-48 mx-auto rounded-full" />
              </template>

              <template v-else>
                <DonutChart
                  v-if="donutSegments.length > 0"
                  :segments="donutSegments"
                  :total="donutTotal"
                  :currency="currency"
                />

                <UCard v-else variant="bordered" class="py-4">
                  <EmptyState
                    icon="pie_chart"
                    title="Нет данных"
                    description="Нет транзакций для анализа за выбранный период"
                  />
                </UCard>
              </template>
            </div>

            <!-- === TRENDS SECTION === -->
            <template v-if="showTrendsChart">
              <div
                class="border-t border-border-light/50 dark:border-border-dark/50 pt-4 space-y-4"
              >
                <div class="flex flex-col lg:flex-row lg:gap-4 space-y-4 lg:space-y-0">
                  <div class="lg:flex-1">
                    <DailyExpenseChart
                      :entries="chartEntries"
                      :currency="currency"
                      :loading="dailyLoading"
                      :group-by="groupBy"
                    />
                  </div>

                  <div class="lg:flex-1">
                    <PeriodComparison
                      :current-expense="convertedExpense"
                      :previous-expense="prevExpense"
                      :current-income="convertedIncome"
                      :previous-income="prevIncome"
                      :current-savings-rate="savingsRate"
                      :previous-savings-rate="prevSavingsRate"
                      :currency="currency"
                      :loading="prevLoading"
                      :no-data="noPrevData"
                    />
                  </div>
                </div>
              </div>
            </template>
          </template>
        </div>
      </Transition>
    </main>
  </PageContainer>
</template>

<style scoped>
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 150ms ease-out;
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 150ms ease-out;
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms ease-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}
</style>
