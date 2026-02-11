// Re-export from database types for consistency
export type { Transaction } from '@/shared/api/database.types'
export type TransactionId = string

export interface TransactionGroup {
  date: string
  transactions: import('@/shared/api/database.types').Transaction[]
  total: number
}
