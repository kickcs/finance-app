<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
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
import { useDailyStats } from '@/entities/transaction';
import { useBudget } from '@/entities/budget';
import { useAccounts } from '@/entities/account';
import { toLocalISODate, isPastDate } from '@/shared/lib/date';
import { getCachedDateFormat } from '@/shared/lib/format/intlCache';
import {
  DateRangePicker,
  FilterChips,
  useAnalyticsFilters,
  useConvertedAnalytics,
  mapCategoryStats,
  type LitePeriod,
} from '@/features/analytics-filters';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
import { formatFinancialPeriod } from '@/shared/lib/utils/financialPeriod';

const route = useRoute();
const { userId } = useCurrentUser();
const { currency } = useUserCurrency();

// --- Filters ---
const {
  filters,
  effectiveDateRange,
  daysInPeriod,
  daysRemainingInMonth,
  setPeriod,
  setCustomDateRange,
  toggleAccount,
  clearAccountFilters,
} = useAnalyticsFilters();

const startDateStr = computed(() => {
  const d = effectiveDateRange.value.startDate;
  return d ? toLocalISODate(d) : null;
});

const endDateStr = computed(() => {
  const d = effectiveDateRange.value.endDate;
  return d ? toLocalISODate(d) : null;
});

// --- Active tab ---
type AnalyticsTab = 'overview' | 'categories' | 'trends';
const activeTab = ref<AnalyticsTab>('overview');

const tabItems = [
  { id: 'overview', label: 'Обзор' },
  { id: 'categories', label: 'Категории' },
  { id: 'trends', label: 'Тренды' },
];

// --- Period filter tabs ---
const periodItems = [
  { id: 'week-start', label: 'Неделя' },
  { id: 'month-start', label: 'Месяц' },
  { id: 'year-start', label: 'Год' },
  { id: 'custom', label: 'Свой' },
];

const showCustomDatePicker = computed(() => filters.value.period === 'custom');

const dateRangeLabel = computed(() => {
  const { startDate, endDate } = effectiveDateRange.value;
  if (!startDate || !endDate) return null;
  const fmt = getCachedDateFormat('ru-RU', { day: 'numeric', month: 'short' });
  return `${fmt.format(startDate)} – ${fmt.format(endDate)}`;
});

// --- Accounts ---
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

// --- Converted analytics (main data) ---
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

// --- Available balance (for safe daily spending) ---
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

const balanceLabel = computed(() =>
  filters.value.selectedAccountIds.length > 0 ? 'По выбранным счетам' : undefined,
);

// --- Is past period? ---
const isPastPeriod = computed(() => {
  const end = effectiveDateRange.value.endDate;
  if (!end) return false;
  return isPastDate(toLocalISODate(end));
});

// --- Spending Pace (always current financial month) ---
const {
  currentBounds,
  currentPeriod,
  startDay,
  totalDays: paceTotalDays,
  daysRemaining,
} = useFinancialPeriod();
const { budget, isLoading: budgetLoading } = useBudget(userId);

const paceTodayIndex = computed(() => Math.max(0, paceTotalDays.value - daysRemaining.value));

const isOverviewActive = computed(() => activeTab.value === 'overview');

const paceStartStr = computed(() => toLocalISODate(currentBounds.value.start));
const paceEndStr = computed(() => {
  const end = new Date(currentBounds.value.end);
  end.setDate(end.getDate() - 1);
  return toLocalISODate(end);
});

const paceEnabled = computed(
  () => isOverviewActive.value && (!!budget.value || budgetLoading.value),
);

const { entries: paceRaw, isLoading: paceStatsLoading } = useDailyStats({
  startDate: computed(() => (paceEnabled.value ? paceStartStr.value : null)),
  endDate: computed(() => (paceEnabled.value ? paceEndStr.value : null)),
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
  const days = paceTotalDays.value;
  const today = paceTodayIndex.value;

  const expenseMap = new Map<string, number>();
  for (const e of paceRaw.value) {
    expenseMap.set(e.date, convertExpenseByCurrency(e.expense_by_currency));
  }

  let cum = 0;
  const result: { day: number; actual: number; ideal: number; date: string }[] = [];
  const start = currentBounds.value.start;

  for (let i = 0; i <= today; i++) {
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

const pacePeriodLabel = computed(() =>
  formatFinancialPeriod(currentPeriod.value.year, currentPeriod.value.month, startDay.value),
);

// --- Empty state ---
const hasNoData = computed(
  () => convertedIncome.value === 0 && convertedExpense.value === 0 && !analyticsLoading.value,
);

// --- Categories tab ---
const categoryType = ref<'expense' | 'income'>('expense');
const categoryTypeItems = [
  { id: 'expense', label: 'Расходы' },
  { id: 'income', label: 'Доходы' },
];

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

// --- Trends tab ---
const isTrendsActive = computed(() => activeTab.value === 'trends');

// Auto groupBy based on period length
const groupBy = computed<'day' | 'week' | 'month'>(() => {
  const days = daysInPeriod.value;
  if (days <= 31) return 'day';
  if (days <= 90) return 'week';
  return 'month';
});

// Daily stats — lazy loaded when trends tab is active
const { entries: dailyEntries, isLoading: dailyLoading } = useDailyStats({
  startDate: computed(() => (isTrendsActive.value ? startDateStr.value : null)),
  endDate: computed(() => (isTrendsActive.value ? endDateStr.value : null)),
  accountIds: computed(() => filters.value.selectedAccountIds),
  groupBy,
});

// Convert daily entries to chart format
const chartEntries = computed(() =>
  dailyEntries.value.map((e) => ({
    date: e.date,
    expense: convertExpenseByCurrency(e.expense_by_currency),
  })),
);

// Previous period analytics — lazy loaded when trends tab is active
const previousPeriodDates = computed(() => {
  const start = effectiveDateRange.value.startDate;
  const end = effectiveDateRange.value.endDate;
  if (!start || !end) return { startDate: null, endDate: null };

  const periodMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd.getTime() - periodMs);
  prevStart.setHours(0, 0, 0, 0);

  return {
    startDate: toLocalISODate(prevStart),
    endDate: toLocalISODate(prevEnd),
  };
});

const {
  convertedIncome: prevIncome,
  convertedExpense: prevExpense,
  savingsRate: prevSavingsRate,
  isLoading: prevLoading,
} = useConvertedAnalytics(
  {
    startDate: computed(() => (isTrendsActive.value ? previousPeriodDates.value.startDate : null)),
    endDate: computed(() => (isTrendsActive.value ? previousPeriodDates.value.endDate : null)),
    accountIds: computed(() => filters.value.selectedAccountIds),
  },
  currency,
);

const showComparison = computed(() => daysInPeriod.value >= 3);
const noPrevData = computed(() => prevIncome.value === 0 && prevExpense.value === 0);

// --- Handlers ---
function handlePeriodChange(value: string | number) {
  setPeriod(value as LitePeriod);
}

function handleTabChange(value: string | number) {
  activeTab.value = value as AnalyticsTab;
}

function handleCategoryTypeChange(value: string | number) {
  categoryType.value = value as 'expense' | 'income';
}

// Read initial type filter from query param
onMounted(() => {
  const queryType = route.query.type as string | undefined;
  if (queryType === 'income') {
    categoryType.value = 'income';
    activeTab.value = 'categories';
  } else if (queryType === 'expense') {
    categoryType.value = 'expense';
    activeTab.value = 'categories';
  }
});
</script>

<template>
  <PageContainer class="relative bg-background-light dark:bg-background-dark">
    <template #header>
      <AppHeader title="Аналитика" />
    </template>

    <!-- Sticky filters + tabs -->
    <div
      class="sticky z-20 -mx-5 lg:-mx-8 px-5 lg:px-8 py-2 space-y-3 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-border-light/50 dark:border-border-dark/50 shadow-sm"
      :style="{ top: '0' }"
    >
      <!-- Period Tabs -->
      <UTabs
        :model-value="filters.period"
        :items="periodItems"
        @update:model-value="handlePeriodChange"
      />

      <!-- Date Range Indicator -->
      <p
        v-if="dateRangeLabel && !showCustomDatePicker"
        class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark flex items-center gap-1.5"
      >
        <span class="inline-block w-1 h-1 rounded-full bg-primary/60" />
        {{ dateRangeLabel }}
        <span class="text-text-tertiary-light dark:text-text-tertiary-dark opacity-60">
          · {{ daysInPeriod }} дн
        </span>
      </p>

      <!-- Custom Date Range Picker -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <DateRangePicker
          v-if="showCustomDatePicker"
          :model-value="filters.customDateRange"
          @update:model-value="setCustomDateRange"
        />
      </Transition>

      <!-- Account Filter Chips -->
      <FilterChips
        v-if="showAccountFilter"
        :items="accountChips"
        :selected-ids="filters.selectedAccountIds"
        label="Счета"
        @toggle="toggleAccount"
        @clear="clearAccountFilters"
      />

      <!-- Section Tabs -->
      <UTabs
        :model-value="activeTab"
        :items="tabItems"
        variant="underline"
        @update:model-value="handleTabChange"
      />
    </div>

    <!-- Content -->
    <main class="pt-4 pb-28 md:pb-8 space-y-5">
      <!-- ========== Tab: Overview ========== -->
      <div v-show="activeTab === 'overview'" role="tabpanel">
        <div
          class="space-y-4 transition-opacity duration-300"
          :class="{ 'opacity-50 pointer-events-none': analyticsFetching && !analyticsLoading }"
        >
          <!-- Empty state -->
          <UCard v-if="hasNoData" variant="bordered" class="py-8">
            <EmptyState
              icon="bar_chart"
              title="Нет транзакций"
              description="Нет данных за выбранный период"
            />
          </UCard>

          <template v-else>
            <!-- Income/Expense Bars -->
            <IncomeExpenseBar
              :income="convertedIncome"
              :expense="convertedExpense"
              :currency="currency"
              :loading="analyticsLoading"
            />

            <!-- Spending Pace -->
            <SpendingPaceChart
              v-if="budget || paceLoading"
              :entries="paceEntries"
              :budget-amount="paceBudgetAmount"
              :total-days="paceTotalDays"
              :today-index="paceTodayIndex"
              :currency="currency"
              :period-label="pacePeriodLabel"
              :loading="paceLoading"
            />

            <!-- Daily Stats + Savings side-by-side on desktop -->
            <div class="flex flex-col lg:flex-row lg:gap-4">
              <!-- Daily Stats Cards -->
              <div class="lg:flex-1">
                <DailyStatsCards
                  :total-expense="convertedExpense"
                  :available-balance="availableBalance"
                  :days-in-period="daysInPeriod"
                  :days-remaining-in-month="daysRemainingInMonth"
                  :currency="currency"
                  :is-past-period="isPastPeriod"
                  :balance-label="balanceLabel"
                />
              </div>

              <!-- Savings Gauge -->
              <div class="mt-4 lg:mt-0 lg:flex-1">
                <SavingsGauge
                  :total-income="convertedIncome"
                  :total-expense="convertedExpense"
                  :available-balance="availableBalance"
                  :currency="currency"
                />
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- ========== Tab: Categories ========== -->
      <div v-show="activeTab === 'categories'" role="tabpanel">
        <div
          class="space-y-4 transition-opacity duration-300"
          :class="{ 'opacity-50 pointer-events-none': analyticsFetching && !analyticsLoading }"
        >
          <!-- Local type filter -->
          <UTabs
            :model-value="categoryType"
            :items="categoryTypeItems"
            size="sm"
            @update:model-value="handleCategoryTypeChange"
          />

          <!-- Loading -->
          <template v-if="analyticsLoading">
            <Skeleton class="h-48 w-48 mx-auto rounded-full" />
            <UCard v-for="i in 3" :key="i" class="p-4">
              <div class="flex items-center gap-3 mb-3">
                <Skeleton class="w-10 h-10 rounded-xl" />
                <div class="flex-1">
                  <Skeleton class="h-4 w-24 rounded mb-1" />
                  <Skeleton class="h-3 w-12 rounded" />
                </div>
                <Skeleton class="h-5 w-28 rounded" />
              </div>
              <Skeleton class="h-2 rounded-full" />
            </UCard>
          </template>

          <template v-else>
            <!-- Donut Chart with legend -->
            <DonutChart
              v-if="donutSegments.length > 0"
              :segments="donutSegments"
              :total="donutTotal"
              :currency="currency"
            />

            <!-- Empty -->
            <UCard v-else variant="bordered" class="py-4">
              <EmptyState
                icon="pie_chart"
                title="Нет данных"
                description="Нет транзакций для анализа за выбранный период"
              />
            </UCard>
          </template>
        </div>
      </div>

      <!-- ========== Tab: Trends ========== -->
      <div v-show="activeTab === 'trends'" role="tabpanel">
        <div class="flex flex-col lg:flex-row lg:gap-4 space-y-4 lg:space-y-0">
          <!-- Daily Expense Chart -->
          <div class="lg:flex-1">
            <DailyExpenseChart
              :entries="chartEntries"
              :currency="currency"
              :loading="dailyLoading"
              :group-by="groupBy"
            />
          </div>

          <!-- Period Comparison -->
          <div v-if="showComparison" class="lg:flex-1">
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
    </main>
  </PageContainer>
</template>
