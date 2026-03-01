<script setup lang="ts">
import { computed } from 'vue';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { AppHeader } from '@/widgets/header';
import { UTabs, SectionHeader } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import { useExchangeRates } from '@/shared/api';
import { useAnalyticsStats } from '@/entities/transaction';
import { toLocalISODate } from '@/shared/lib/date';
import { useAccounts } from '@/entities/account';
import { useDebts } from '@/entities/debt';
import {
  ModeToggle,
  DateRangePicker,
  FilterChips,
  useAnalyticsFilters,
  mapExpenseCategoryStats,
  type LitePeriod,
} from '@/features/analytics-filters';
import {
  DonutChart,
  DailyStatsCards,
  TopCategories,
  SavingsGauge,
  StatCard,
  type DonutSegment,
} from '@/widgets/analytics';

const { userId } = useCurrentUser();
const { currency } = useUserCurrency();

// Analytics filters
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

// Convert date range to ISO strings for API (local timezone, not UTC)
const startDateStr = computed(() => {
  const d = effectiveDateRange.value.startDate;
  return d ? toLocalISODate(d) : null;
});

const endDateStr = computed(() => {
  const d = effectiveDateRange.value.endDate;
  return d ? toLocalISODate(d) : null;
});

// Use analytics API for server-side calculations
const {
  totalExpense,
  totalIncome,
  categoryBreakdown,
  isFetching: analyticsFetching,
} = useAnalyticsStats({
  startDate: startDateStr,
  endDate: endDateStr,
  accountIds: computed(() => filters.value.selectedAccountIds),
});

// Load accounts for filter chips and balance
const { accounts, totalBalancesByCurrency } = useAccounts(userId);

// Exchange rates for currency conversion
const { convert } = useExchangeRates(currency);

// Total balance converted to user's main currency
const totalBalance = computed((): number => {
  const balances: Record<string, number> = totalBalancesByCurrency.value;
  return Object.entries(balances).reduce((sum, [curr, amount]) => sum + convert(amount, curr), 0);
});

// Load debts for debt summary
const { debts } = useDebts(userId);

// Period tabs
const periodItems = [
  { id: 'week-start', label: 'С начала недели' },
  { id: 'month-start', label: 'С начала месяца' },
  { id: 'year-start', label: 'С начала года' },
  { id: 'custom', label: 'Свой период' },
];

// Show custom date picker
const showCustomDatePicker = computed(() => filters.value.period === 'custom');

// Debt summaries
const totalOwedToMe = computed(() => {
  return debts.value
    .filter((d) => d.debt_type === 'given' && !d.is_closed)
    .reduce((sum, d) => sum + d.remaining_amount, 0);
});

const totalIOwe = computed(() => {
  return debts.value
    .filter((d) => d.debt_type === 'taken' && !d.is_closed)
    .reduce((sum, d) => sum + d.remaining_amount, 0);
});

// Expense category statistics from server-side calculation (filtered by type)
const expenseCategoryStats = computed(() => mapExpenseCategoryStats(categoryBreakdown.value));

// Convert category stats to donut segments
const donutSegments = computed<DonutSegment[]>(() => {
  return expenseCategoryStats.value.map((stat) => ({
    id: stat.id,
    label: stat.name,
    value: stat.amount,
    percent: stat.percent,
    color: stat.color,
    icon: stat.icon,
  }));
});

// Prepare filter chips data
const accountChips = computed(() => {
  return accounts.value.map((acc) => ({
    id: acc.id,
    name: acc.name,
    icon: acc.icon,
    color: acc.color,
  }));
});

// Handlers
function handlePeriodChange(value: string | number) {
  setPeriod(value as LitePeriod);
}
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark pb-28 md:pb-8 overflow-y-auto"
  >
    <!-- Header with Mode Toggle -->
    <AppHeader title="Аналитика">
      <template #actions>
        <ModeToggle mode="full" />
      </template>
    </AppHeader>

    <!-- Content -->
    <main class="px-5 pt-6 space-y-5">
      <!-- Sticky Filters -->
      <div
        class="sticky z-20 -mx-5 px-5 py-2 space-y-3 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-border-light/50 dark:border-border-dark/50 shadow-sm"
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
          v-if="accountChips.length > 0"
          :items="accountChips"
          :selected-ids="filters.selectedAccountIds"
          label="Счета"
          @toggle="toggleAccount"
          @clear="clearAccountFilters"
        />
      </div>

      <!-- Analytics Content (dims during refetch) -->
      <div
        class="space-y-5 transition-opacity duration-300"
        :class="{ 'opacity-50 pointer-events-none': analyticsFetching }"
      >
        <!-- Donut Chart -->
        <div class="pt-2">
          <SectionHeader
            title="Анализ расходов"
            :show-add="false"
            :show-view-all="false"
            class="mb-4"
          />
        </div>
        <DonutChart
          :segments="donutSegments"
          :total="totalExpense"
          :currency="currency"
          title="Расходы по категориям"
        />

        <!-- Daily Stats Cards -->
        <DailyStatsCards
          :total-expense="totalExpense"
          :total-income="totalIncome"
          :days-in-period="daysInPeriod"
          :days-remaining-in-month="daysRemainingInMonth"
          :currency="currency"
        />

        <!-- Top Categories -->
        <TopCategories :categories="expenseCategoryStats" :currency="currency" :limit="3" />

        <!-- Savings Gauge -->
        <SavingsGauge
          :total-income="totalIncome"
          :total-expense="totalExpense"
          :currency="currency"
          :total-balance="totalBalance"
        />
      </div>

      <!-- Debt Summary Cards -->
      <div v-if="totalOwedToMe > 0 || totalIOwe > 0" class="space-y-3">
        <h2 class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
          Долги
        </h2>

        <StatCard
          v-if="totalOwedToMe > 0"
          icon="arrow_upward"
          label="Мне должны"
          :value="formatCurrency(totalOwedToMe, currency, COMPACT_FORMAT)"
          icon-bg-class="bg-debt-given-light"
          icon-class="text-debt-given"
        />
        <StatCard
          v-if="totalIOwe > 0"
          icon="arrow_downward"
          label="Я должен"
          :value="formatCurrency(totalIOwe, currency, COMPACT_FORMAT)"
          icon-bg-class="bg-debt-received-light"
          icon-class="text-debt-received"
        />
      </div>
    </main>
  </div>
</template>
