export type AnalyticsMode = 'lite' | 'full'

export type LitePeriod = 'week-start' | 'month-start' | 'year-start' | 'custom'

export type TransactionType = 'all' | 'expense' | 'income'

export interface DateRange {
  startDate: string | null // ISO date string (YYYY-MM-DD)
  endDate: string | null
}

export interface AnalyticsFilters {
  period: LitePeriod
  customDateRange: DateRange
  type: TransactionType
  selectedCategoryIds: string[]
  selectedAccountIds: string[]
}

export interface CategoryStat {
  id: string
  name: string
  icon: string
  color: string
  amount: number
  percent: number
}
