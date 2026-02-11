import { ref } from 'vue'
import { useAccounts, accountQueryKeys } from '@/entities/account'
import { transactionQueryKeys } from '@/entities/transaction'
import { useProfile } from '@/shared/api'
import type { Account } from '@/shared/api/database.types'
import { queryClient } from '@/shared/api/queryClient'

export function useEditAccount(userId: string) {
  const { updateAccount, deleteAccount } = useAccounts(userId)
  const { defaultAccountId } = useProfile(userId)

  const isUpdating = ref(false)
  const isDeleting = ref(false)
  const error = ref<string | null>(null)

  async function update(accountId: string, updates: Partial<Account>) {
    isUpdating.value = true
    error.value = null

    try {
      await updateAccount(accountId, updates)
      return true
    } catch (e) {
      error.value = 'Не удалось обновить счёт'
      console.error('Failed to update account:', e)
      return false
    } finally {
      isUpdating.value = false
    }
  }

  async function remove(accountId: string) {
    // Check if this is the default account
    if (defaultAccountId.value === accountId) {
      error.value = 'Нельзя удалить счёт по умолчанию. Сначала назначьте другой счёт по умолчанию.'
      return false
    }

    isDeleting.value = true
    error.value = null

    try {
      await deleteAccount(accountId)
      // Invalidate caches (including infinite queries)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.list(userId) }),
        queryClient.invalidateQueries({ queryKey: transactionQueryKeys.list(userId) }),
        // Invalidate infinite queries
        queryClient.invalidateQueries({ queryKey: ['transactions', 'infinite', userId] }),
        queryClient.invalidateQueries({ queryKey: transactionQueryKeys.infiniteByAccount(accountId) }),
      ])
      return true
    } catch (e) {
      error.value = 'Не удалось удалить счёт'
      console.error('Failed to delete account:', e)
      return false
    } finally {
      isDeleting.value = false
    }
  }

  // Check if account is the default one
  function isDefaultAccount(accountId: string): boolean {
    return defaultAccountId.value === accountId
  }

  return {
    isUpdating,
    isDeleting,
    error,
    update,
    remove,
    isDefaultAccount,
  }
}
