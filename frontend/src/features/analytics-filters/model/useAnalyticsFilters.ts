import { ref, computed } from 'vue'
import type { Transaction } from '@/shared/api/database.types'
import type { AnalyticsFilters, LitePeriod, TransactionType, DateRange, CategoryStat } from './types'
import type { Category } from '@/entities/category'
import { getCategoryById as getStaticCategoryById } from '@/entities/category'

export function useAnalyticsFilters() {
  const filters = ref<AnalyticsFilters>({
    period: 'month-start',
    customDateRange: { startDate: null, endDate: null },
    type: 'all',
    selectedCategoryIds: [],
    selectedAccountIds: [],
  })

  // Calculate effective date range based on period
  const effectiveDateRange = computed<{ startDate: Date | null; endDate: Date | null }>(() => {
    const now = new Date()
    now.setHours(23, 59, 59, 999) // End of today

    switch (filters.value.period) {
      case 'week-start': {
        const weekStart = new Date(now)
        const day = weekStart.getDay()
        // Monday = 1, Sunday = 0, so we need to go back to Monday
        const diff = day === 0 ? -6 : 1 - day
        weekStart.setDate(weekStart.getDate() + diff)
        weekStart.setHours(0, 0, 0, 0)
        return { startDate: weekStart, endDate: now }
      }
      case 'month-start': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        monthStart.setHours(0, 0, 0, 0)
        return { startDate: monthStart, endDate: now }
      }
      case 'year-start': {
        const yearStart = new Date(now.getFullYear(), 0, 1)
        yearStart.setHours(0, 0, 0, 0)
        return { startDate: yearStart, endDate: now }
      }
      case 'custom': {
        const { startDate, endDate } = filters.value.customDateRange
        return {
          startDate: startDate ? new Date(startDate + 'T00:00:00') : null,
          endDate: endDate ? new Date(endDate + 'T23:59:59') : null,
        }
      }
      default:
        return { startDate: null, endDate: null }
    }
  })

  // Days in current period
  const daysInPeriod = computed(() => {
    const { startDate, endDate } = effectiveDateRange.value
    if (!startDate || !endDate) return 1
    const diffTime = endDate.getTime() - startDate.getTime()
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  })

  // Days remaining in current month
  const daysRemainingInMonth = computed(() => {
    const now = new Date()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return lastDay.getDate() - now.getDate()
  })

  // Filter transactions based on current filters
  function filterTransactions(transactions: Transaction[]): Transaction[] {
    let result = [...transactions]

    // Exclude debt-related transactions from analytics
    result = result.filter((t) => !t.is_debt_related)

    // Filter by date range
    const { startDate, endDate } = effectiveDateRange.value
    if (startDate && endDate) {
      result = result.filter((t) => {
        const date = new Date(t.date)
        return date >= startDate && date <= endDate
      })
    }

    // Filter by type (skip transfers, only filter expense/income)
    if (filters.value.type !== 'all') {
      result = result.filter((t) => t.type === filters.value.type)
    }

    // Filter by categories
    if (filters.value.selectedCategoryIds.length > 0) {
      result = result.filter((t) => filters.value.selectedCategoryIds.includes(t.category_id))
    }

    // Filter by accounts
    if (filters.value.selectedAccountIds.length > 0) {
      result = result.filter((t) => filters.value.selectedAccountIds.includes(t.account_id))
    }

    return result
  }

  // Calculate category statistics from filtered transactions
  function calculateCategoryStats(
    transactions: Transaction[],
    type: 'expense' | 'income' | 'all',
    options?: {
      baseCurrency?: string
      convertFn?: (amount: number, fromCurrency: string) => number
      getCategoryById?: (id: string) => Category | undefined
    },
  ): CategoryStat[] {
    // Filter by type if not 'all'
    const filtered = type === 'all' ? transactions : transactions.filter((t) => t.type === type)

    // Group by category with optional currency conversion
    const categoryAmounts: Record<string, number> = {}
    for (const tx of filtered) {
      if (tx.category_id) {
        // Convert to base currency if converter provided
        let amount = tx.amount
        if (options?.convertFn && options?.baseCurrency && tx.currency !== options.baseCurrency) {
          amount = options.convertFn(tx.amount, tx.currency)
        }
        categoryAmounts[tx.category_id] = (categoryAmounts[tx.category_id] || 0) + amount
      }
    }

    const total = Object.values(categoryAmounts).reduce((sum, amount) => sum + amount, 0)

    // Map to CategoryStat array
    return Object.entries(categoryAmounts)
      .map(([categoryId, amount]) => {
        const category = options?.getCategoryById?.(categoryId) ?? getStaticCategoryById(categoryId)
        return {
          id: categoryId,
          name: category?.name || 'Другое',
          icon: category?.icon || 'more_horiz',
          color: category?.color || '#6B7280',
          amount,
          percent: total > 0 ? (amount / total) * 100 : 0,
        }
      })
      .sort((a, b) => b.amount - a.amount)
  }

  // Setters
  function setPeriod(period: LitePeriod) {
    filters.value.period = period
  }

  function setType(type: TransactionType) {
    filters.value.type = type
  }

  function setCustomDateRange(range: DateRange) {
    filters.value.customDateRange = range
  }

  function toggleCategory(categoryId: string) {
    const index = filters.value.selectedCategoryIds.indexOf(categoryId)
    if (index === -1) {
      filters.value.selectedCategoryIds.push(categoryId)
    } else {
      filters.value.selectedCategoryIds.splice(index, 1)
    }
  }

  function toggleAccount(accountId: string) {
    const index = filters.value.selectedAccountIds.indexOf(accountId)
    if (index === -1) {
      filters.value.selectedAccountIds.push(accountId)
    } else {
      filters.value.selectedAccountIds.splice(index, 1)
    }
  }

  function clearCategoryFilters() {
    filters.value.selectedCategoryIds = []
  }

  function clearAccountFilters() {
    filters.value.selectedAccountIds = []
  }

  function clearAllFilters() {
    filters.value.selectedCategoryIds = []
    filters.value.selectedAccountIds = []
    filters.value.type = 'all'
  }

  // Active filter count for badge
  const activeFilterCount = computed(() => {
    let count = 0
    if (filters.value.selectedCategoryIds.length > 0) count++
    if (filters.value.selectedAccountIds.length > 0) count++
    return count
  })

  return {
    filters,
    effectiveDateRange,
    daysInPeriod,
    daysRemainingInMonth,
    activeFilterCount,
    filterTransactions,
    calculateCategoryStats,
    setPeriod,
    setType,
    setCustomDateRange,
    toggleCategory,
    toggleAccount,
    clearCategoryFilters,
    clearAccountFilters,
    clearAllFilters,
  }
}
