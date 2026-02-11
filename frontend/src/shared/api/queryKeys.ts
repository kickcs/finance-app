// Re-export entity query keys for backward compatibility
import { accountQueryKeys } from '@/entities/account'
import { transactionQueryKeys } from '@/entities/transaction'
import { goalQueryKeys } from '@/entities/goal'
import { debtQueryKeys } from '@/entities/debt'
import { reminderQueryKeys } from '@/entities/reminder'

// Profile keys stay here (profile is in shared)
export const profileQueryKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => [...profileQueryKeys.all, userId] as const,
}

// Combined queryKeys object for backward compatibility
export const queryKeys = {
  profile: profileQueryKeys,
  accounts: accountQueryKeys,
  transactions: transactionQueryKeys,
  goals: goalQueryKeys,
  debts: debtQueryKeys,
  reminders: reminderQueryKeys,
} as const

export type QueryKeys = typeof queryKeys

// Also export individual keys for direct import
export { accountQueryKeys } from '@/entities/account'
export { transactionQueryKeys } from '@/entities/transaction'
export { goalQueryKeys } from '@/entities/goal'
export { debtQueryKeys } from '@/entities/debt'
export { reminderQueryKeys } from '@/entities/reminder'
