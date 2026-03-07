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
  type DonutSegment,
} from '@/widgets/analytics';
import { UTabs, UCard, EmptyState, Skeleton } from '@/shared/ui';
import { useDailyStats } from '@/entities/transaction';
import { useAccounts } from '@/entities/account';
import { toLocalISODate, isPastDate } from '@/shared/lib/date';
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
    expense: Object.entries(e.expenseByCurrency).reduce(
      (sum, [curr, amt]) => sum + convertAmount(amt, curr),
      0,
    ),
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
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark overflow-y-auto pb-28 md:pb-8"
  >
    <!-- Header -->
    <AppHeader title="Аналитика" />

    <!-- Sticky filters + tabs -->
    <div
      class="sticky z-20 px-5 py-2 space-y-3 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-border-light/50 dark:border-border-dark/50 shadow-sm"
      :style="{ top: 'calc(3rem + env(safe-area-inset-top, 0px))' }"
    >
      <!-- Period Tabs -->
      <UTabs
        :model-value="filters.period"
        :items="periodItems"
        @update:model-value="handlePeriodChange"
      />

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
    <main class="px-5 pt-4 space-y-5">
      <!-- ========== Tab: Overview ========== -->
      <div v-show="activeTab === 'overview'">
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

            <!-- Daily Stats Cards -->
            <DailyStatsCards
              :total-expense="convertedExpense"
              :available-balance="availableBalance"
              :days-in-period="daysInPeriod"
              :days-remaining-in-month="daysRemainingInMonth"
              :currency="currency"
              :is-past-period="isPastPeriod"
              :balance-label="balanceLabel"
            />

            <!-- Savings Gauge -->
            <SavingsGauge
              :total-income="convertedIncome"
              :total-expense="convertedExpense"
              :available-balance="availableBalance"
              :currency="currency"
            />
          </template>
        </div>
      </div>

      <!-- ========== Tab: Categories ========== -->
      <div v-show="activeTab === 'categories'">
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
      <div v-show="activeTab === 'trends'">
        <div class="space-y-4">
          <!-- Daily Expense Chart -->
          <DailyExpenseChart
            :entries="chartEntries"
            :currency="currency"
            :loading="dailyLoading"
            :group-by="groupBy"
          />

          <!-- Period Comparison -->
          <PeriodComparison
            v-if="showComparison"
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
    </main>
  </div>
</template>
