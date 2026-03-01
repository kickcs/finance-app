<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { AppHeader } from '@/widgets/header';
import { StatCard } from '@/widgets/analytics';
import {
  UTabs,
  UCard,
  UProgressBar,
  Skeleton,
  SectionHeader,
  EmptyState,
  IconBadge,
} from '@/shared/ui';
import { useAnalyticsStats } from '@/entities/transaction';
import { toLocalISODate } from '@/shared/lib/date';
import { useAccounts } from '@/entities/account';
import { useDebts } from '@/entities/debt';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import {
  ModeToggle,
  DateRangePicker,
  FilterChips,
  useAnalyticsFilters,
  mapCategoryStats,
  type LitePeriod,
  type TransactionType,
} from '@/features/analytics-filters';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';

const route = useRoute();

const { userId } = useCurrentUser();

// Get user currency (profile-first, falls back to localStorage)
const { currency } = useUserCurrency();

// Analytics filters
const {
  filters,
  effectiveDateRange,
  setPeriod,
  setType,
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
  isLoading: analyticsLoading,
  isFetching: analyticsFetching,
} = useAnalyticsStats({
  startDate: startDateStr,
  endDate: endDateStr,
  accountIds: computed(() => filters.value.selectedAccountIds),
});

// Load accounts for filter chips
const { accounts } = useAccounts(userId);

// Load debts for debt summary
const { debts, isLoading: debtsLoading } = useDebts(userId);

// Period tabs
const periodItems = [
  { id: 'week-start', label: 'С начала недели' },
  { id: 'month-start', label: 'С начала месяца' },
  { id: 'year-start', label: 'С начала года' },
  { id: 'custom', label: 'Свой период' },
];

// Type tabs with "Все"
const typeItems = [
  { id: 'all', label: 'Все' },
  { id: 'expense', label: 'Расходы' },
  { id: 'income', label: 'Доходы' },
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

// Category statistics from server-side calculation
const categoryStats = computed(() => {
  const type = filters.value.type === 'all' ? undefined : filters.value.type;
  return mapCategoryStats(categoryBreakdown.value, type);
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

function handleTypeChange(value: string | number) {
  setType(value as TransactionType);
}

// Read initial type filter from query param
onMounted(() => {
  const queryType = route.query.type as string | undefined;
  if (queryType === 'income' || queryType === 'expense') {
    setType(queryType);
  }
});
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark overflow-y-auto"
    :style="{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }"
  >
    <!-- Header with Mode Toggle -->
    <AppHeader title="Аналитика">
      <template #actions>
        <ModeToggle mode="lite" />
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

      <!-- Summary Cards - 2 Rows -->
      <div
        class="space-y-3 pt-2 transition-opacity duration-300"
        :class="{ 'opacity-50 pointer-events-none': analyticsFetching }"
      >
        <StatCard
          icon="trending_down"
          label="Расходы"
          :value="formatCurrency(totalExpense, currency, COMPACT_FORMAT)"
          :loading="analyticsLoading"
          icon-bg-class="bg-danger/10"
          icon-class="text-danger"
        />
        <StatCard
          icon="trending_up"
          label="Доходы"
          :value="formatCurrency(totalIncome, currency, COMPACT_FORMAT)"
          :loading="analyticsLoading"
          icon-bg-class="bg-success/10"
          icon-class="text-success"
        />
      </div>

      <!-- Debt Summary Cards -->
      <div v-if="debtsLoading || totalOwedToMe > 0 || totalIOwe > 0" class="space-y-3">
        <SectionHeader title="Долги" :show-add="false" :show-view-all="false" />

        <!-- Debt Loading Skeleton -->
        <template v-if="debtsLoading">
          <UCard class="p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Skeleton class="w-10 h-10 rounded-xl" />
                <Skeleton class="h-4 w-20 rounded" />
              </div>
              <Skeleton class="h-7 w-32 rounded" />
            </div>
          </UCard>
        </template>

        <template v-else>
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
        </template>
      </div>

      <!-- Category Breakdown -->
      <div
        class="space-y-3 transition-opacity duration-300"
        :class="{
          'opacity-50 pointer-events-none': analyticsFetching && categoryStats.length > 0,
        }"
      >
        <div class="flex items-center justify-between">
          <SectionHeader title="По категориям" :show-add="false" :show-view-all="false" />
          <UTabs
            :model-value="filters.type"
            :items="typeItems"
            size="sm"
            @update:model-value="handleTypeChange"
          />
        </div>

        <!-- Category Loading Skeleton -->
        <template v-if="analyticsLoading">
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
          <div v-if="categoryStats.length > 0" class="space-y-3">
            <UCard v-for="stat in categoryStats" :key="stat.id" class="p-4">
              <div class="flex items-center gap-3 mb-3">
                <IconBadge :icon="stat.icon" size="md" :color="stat.color" class="shrink-0" />
                <div class="flex-1">
                  <p class="font-medium text-text-primary-light dark:text-text-primary-dark">
                    {{ stat.name }}
                  </p>
                  <p
                    class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
                  >
                    {{ stat.percent.toFixed(1) }}%
                  </p>
                </div>
                <p class="font-semibold text-text-primary-light dark:text-text-primary-dark">
                  {{ formatCurrency(stat.amount, currency, COMPACT_FORMAT) }}
                </p>
              </div>
              <UProgressBar :value="stat.percent" :color="stat.color" size="sm" />
            </UCard>
          </div>

          <!-- Empty State -->
          <UCard v-else variant="bordered" class="py-4">
            <EmptyState
              icon="pie_chart"
              title="Нет данных"
              description="Нет транзакций для анализа за выбранный период"
            />
          </UCard>
        </template>
      </div>
    </main>
  </div>
</template>
