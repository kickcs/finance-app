<script setup lang="ts">
import { computed, inject } from 'vue'
import type { Ref } from 'vue'
import type { User } from '@/shared/api/composables/useAuth'
import { useRouter } from 'vue-router'
import { AppHeader } from '@/widgets/header'
import { BottomNav } from '@/widgets/bottom-nav'
import { UTabs, UCard, UIcon, UProgressBar, Skeleton } from '@/shared/ui'
import { useAnalyticsStats, type CategoryBreakdown } from '@/entities/transaction'
import { useAccounts } from '@/entities/account'
import { useDebts } from '@/entities/debt'
import { formatCurrency } from '@/shared/lib/format/currency'
import {
  ModeToggle,
  DateRangePicker,
  FilterChips,
  useAnalyticsFilters,
  type LitePeriod,
  type TransactionType,
} from '@/features/analytics-filters'

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

// Load accounts for filter chips
const { accounts } = useAccounts(userId)

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

// Category statistics from server-side calculation
interface CategoryStat {
  id: string
  name: string
  icon: string
  color: string
  amount: number
  percent: number
}

const categoryStats = computed<CategoryStat[]>(() => {
  // Filter by type
  let filtered: CategoryBreakdown[]
  if (filters.value.type === 'all') {
    filtered = categoryBreakdown.value
  } else {
    filtered = categoryBreakdown.value.filter((c) => c.type === filters.value.type)
  }

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
  <div class="min-h-screen bg-background-light dark:bg-background-dark"
       :style="{ paddingBottom: 'calc(7rem + var(--safe-area-inset-bottom))' }">
    <!-- Header with Mode Toggle -->
    <AppHeader title="Аналитика">
      <template #actions>
        <ModeToggle mode="lite" />
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

      <!-- Summary Cards - Horizontal Layout -->
      <div class="space-y-3">
        <UCard class="p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center">
                <UIcon
                  name="trending_down"
                  size="md"
                  class="text-danger"
                />
              </div>
              <span class="text-text-secondary-light dark:text-text-secondary-dark">Расходы</span>
            </div>
            <Skeleton v-if="analyticsLoading" class="h-7 w-32 rounded" />
            <span v-else class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
              {{ formatCurrency(totalExpense, currency) }}
            </span>
          </div>
        </UCard>

        <UCard class="p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <UIcon
                  name="trending_up"
                  size="md"
                  class="text-success"
                />
              </div>
              <span class="text-text-secondary-light dark:text-text-secondary-dark">Доходы</span>
            </div>
            <Skeleton v-if="analyticsLoading" class="h-7 w-32 rounded" />
            <span v-else class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
              {{ formatCurrency(totalIncome, currency) }}
            </span>
          </div>
        </UCard>
      </div>

      <!-- Debt Summary Cards -->
      <div
        v-if="debtsLoading || totalOwedToMe > 0 || totalIOwe > 0"
        class="space-y-3"
      >
        <h2 class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
          Долги
        </h2>

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
                {{ formatCurrency(totalOwedToMe, currency) }}
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
                {{ formatCurrency(totalIOwe, currency) }}
              </span>
            </div>
          </UCard>
        </template>
      </div>

      <!-- Category Breakdown -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
            По категориям
          </h2>
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
          <div
            v-if="categoryStats.length > 0"
            class="space-y-3"
          >
            <UCard
              v-for="stat in categoryStats"
              :key="stat.id"
              class="p-4"
            >
              <div class="flex items-center gap-3 mb-3">
                <div
                  class="w-10 h-10 rounded-xl flex items-center justify-center"
                  :style="{ backgroundColor: `${stat.color}15` }"
                >
                  <UIcon
                    :name="stat.icon"
                    size="md"
                    :style="{ color: stat.color }"
                  />
                </div>
                <div class="flex-1">
                  <p class="font-medium text-text-primary-light dark:text-text-primary-dark">
                    {{ stat.name }}
                  </p>
                  <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    {{ stat.percent.toFixed(1) }}%
                  </p>
                </div>
                <p class="font-semibold text-text-primary-light dark:text-text-primary-dark">
                  {{ formatCurrency(stat.amount, currency) }}
                </p>
              </div>
              <UProgressBar
                :value="stat.percent"
                :color="stat.color"
                size="sm"
              />
            </UCard>
          </div>

          <!-- Empty State -->
          <div
            v-else
            class="py-12 text-center"
          >
            <div
              class="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-light dark:bg-surface-dark flex items-center justify-center"
            >
              <UIcon
                name="pie_chart"
                size="lg"
                class="text-text-tertiary-light dark:text-text-tertiary-dark"
              />
            </div>
            <p class="text-text-secondary-light dark:text-text-secondary-dark">
              Нет данных для анализа
            </p>
          </div>
        </template>
      </div>
    </main>

    <!-- Bottom Navigation -->
    <BottomNav @add-click="handleAddTransaction" />
  </div>
</template>
