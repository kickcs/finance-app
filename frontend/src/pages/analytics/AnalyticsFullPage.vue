<script setup lang="ts">
import { computed, inject } from 'vue'
import type { Ref } from 'vue'
import type { User } from '@/shared/api/composables/useAuth'
import { useRouter } from 'vue-router'
import { AppHeader } from '@/widgets/header'
import { BottomNav } from '@/widgets/bottom-nav'
import { UTabs, UCard, UIcon, Skeleton } from '@/shared/ui'
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency'
import { useExchangeRates } from '@/shared/api'
import { useAnalyticsStats, type CategoryBreakdown } from '@/entities/transaction'
import { useAccounts } from '@/entities/account'
import { useDebts } from '@/entities/debt'
import {
  ModeToggle,
  DateRangePicker,
  FilterChips,
  useAnalyticsFilters,
  type LitePeriod,
  type TransactionType,
  type CategoryStat,
} from '@/features/analytics-filters'
import {
  DonutChart,
  DailyStatsCards,
  TopCategories,
  SavingsGauge,
  type DonutSegment,
} from '@/widgets/analytics'

const router = useRouter()

// Get user from provide/inject
const user = inject<Ref<User | null>>('user')
const userId = computed(() => user?.value?.id ?? '')

// Get user currency from localStorage
const currency = computed(() => localStorage.getItem('selectedCurrency') || 'UZS')

// Analytics filters
const {
  filters,
  effectiveDateRange,
  daysInPeriod,
  daysRemainingInMonth,
  setPeriod,
  setType,
  setCustomDateRange,
  toggleAccount,
  clearAccountFilters,
} = useAnalyticsFilters()

// Convert date range to ISO strings for API
const startDateStr = computed(() => {
  const d = effectiveDateRange.value.startDate
  return d ? d.toISOString().split('T')[0] : null
})

const endDateStr = computed(() => {
  const d = effectiveDateRange.value.endDate
  return d ? d.toISOString().split('T')[0] : null
})

// Use analytics API for server-side calculations
const {
  totalExpense,
  totalIncome,
  categoryBreakdown,
  isLoading: analyticsLoading,
} = useAnalyticsStats({
  startDate: startDateStr,
  endDate: endDateStr,
  accountIds: computed(() => filters.value.selectedAccountIds),
})

// Load accounts for filter chips and balance
const { accounts, totalBalancesByCurrency } = useAccounts(userId)

// Exchange rates for currency conversion
const { convert } = useExchangeRates(currency)

// Total balance converted to user's main currency
const totalBalance = computed((): number => {
  const balances: Record<string, number> = totalBalancesByCurrency.value
  return Object.entries(balances).reduce(
    (sum, [curr, amount]) => sum + convert(amount, curr), 0
  )
})

// Load debts for debt summary
const { debts, isLoading: debtsLoading } = useDebts(userId)

// Period tabs
const periodItems = [
  { id: 'week-start', label: 'С начала недели' },
  { id: 'month-start', label: 'С начала месяца' },
  { id: 'year-start', label: 'С начала года' },
  { id: 'custom', label: 'Свой период' },
]

// Type tabs with "Все"
const typeItems = [
  { id: 'all', label: 'Все' },
  { id: 'expense', label: 'Расходы' },
  { id: 'income', label: 'Доходы' },
]

// Show custom date picker
const showCustomDatePicker = computed(() => filters.value.period === 'custom')

// Debt summaries
const totalOwedToMe = computed(() => {
  return debts.value
    .filter((d) => d.debt_type === 'given' && !d.is_closed)
    .reduce((sum, d) => sum + d.remaining_amount, 0)
})

const totalIOwe = computed(() => {
  return debts.value
    .filter((d) => d.debt_type === 'taken' && !d.is_closed)
    .reduce((sum, d) => sum + d.remaining_amount, 0)
})

// Expense category statistics from server-side calculation (filtered by type)
const expenseCategoryStats = computed<CategoryStat[]>(() => {
  // Filter only expense categories
  const filtered = categoryBreakdown.value.filter((c) => c.type === 'expense')

  // Calculate total for percentages
  const total = filtered.reduce((sum, c) => sum + c.amount, 0)

  // Map to CategoryStat format - use category details from API response
  return filtered
    .map((c) => ({
      id: c.categoryId,
      name: c.categoryName,
      icon: c.categoryIcon,
      color: c.categoryColor,
      amount: c.amount,
      percent: total > 0 ? (c.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
})

// Convert category stats to donut segments
const donutSegments = computed<DonutSegment[]>(() => {
  return expenseCategoryStats.value.map((stat) => ({
    id: stat.id,
    label: stat.name,
    value: stat.amount,
    percent: stat.percent,
    color: stat.color,
    icon: stat.icon,
  }))
})

// Prepare filter chips data
const accountChips = computed(() => {
  return accounts.value.map((acc) => ({
    id: acc.id,
    name: acc.name,
    icon: acc.icon,
    color: acc.color,
  }))
})

// Handlers
function handlePeriodChange(value: string | number) {
  setPeriod(value as LitePeriod)
}

function handleTypeChange(value: string | number) {
  setType(value as TransactionType)
}

function handleAddTransaction() {
  router.push('/transactions/new')
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
    <!-- Header with Mode Toggle -->
    <AppHeader title="Аналитика">
      <template #actions>
        <ModeToggle mode="full" />
      </template>
    </AppHeader>

    <!-- Content -->
    <main class="px-5 pt-6 space-y-5">
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

      <!-- Donut Chart -->
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
      <TopCategories
        :categories="expenseCategoryStats"
        :currency="currency"
        :limit="3"
      />

      <!-- Savings Gauge -->
      <SavingsGauge
        :total-income="totalIncome"
        :total-expense="totalExpense"
        :currency="currency"
        :total-balance="totalBalance"
      />

      <!-- Debt Summary Cards -->
      <div
        v-if="totalOwedToMe > 0 || totalIOwe > 0"
        class="space-y-3"
      >
        <h2 class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
          Долги
        </h2>

        <UCard
          v-if="totalOwedToMe > 0"
          class="p-4"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <UIcon
                  name="arrow_upward"
                  size="md"
                  class="text-amber-500"
                />
              </div>
              <span class="text-text-secondary-light dark:text-text-secondary-dark">Мне должны</span>
            </div>
            <span class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
              {{ formatCurrency(totalOwedToMe, currency, COMPACT_FORMAT) }}
            </span>
          </div>
        </UCard>

        <UCard
          v-if="totalIOwe > 0"
          class="p-4"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <UIcon
                  name="arrow_downward"
                  size="md"
                  class="text-purple-500"
                />
              </div>
              <span class="text-text-secondary-light dark:text-text-secondary-dark">Я должен</span>
            </div>
            <span class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
              {{ formatCurrency(totalIOwe, currency, COMPACT_FORMAT) }}
            </span>
          </div>
        </UCard>
      </div>
    </main>

    <!-- Bottom Navigation -->
    <BottomNav @add-click="handleAddTransaction" />
  </div>
</template>
