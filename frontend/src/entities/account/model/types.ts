// Re-export from database types for consistency
export type { Account, AccountWithBalances, AccountBalance } from '@/shared/api/database.types'
export type AccountId = string

export interface AccountTypeFieldValues {
  creditLimit: number | null
  gracePeriodDays: number | null
  billingDay: number | null
  totalAmount: number | null
  interestRate: number | null
  monthlyPayment: number | null
  startDate: string | null
  endDate: string | null
  maturityDate: string | null
  isReplenishable: boolean | null
  isWithdrawable: boolean | null
}

export const ACCOUNT_ICONS = [
  'account_balance_wallet',
  'credit_card',
  'savings',
  'payments',
  'account_balance',
  'diamond',
] as const

export const ACCOUNT_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#f59e0b', // Amber
  '#1f2937', // Dark
] as const
