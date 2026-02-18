import { ref } from 'vue';
import { useAccounts } from '@/entities/account';
import { useProfile } from '@/shared/api';
import type { Account } from '@/shared/api/database.types';
import { queryClient } from '@/shared/api/queryClient';
import {
  invalidateTransactionRelated,
  invalidateAccountRelated,
} from '@/shared/api/invalidation';

export function useEditAccount(userId: string) {
  const { updateAccount, deleteAccount } = useAccounts(userId);
  const { defaultAccountId } = useProfile(userId);

  const isUpdating = ref(false);
  const isDeleting = ref(false);
  const error = ref<string | null>(null);

  async function update(accountId: string, updates: Partial<Account>) {
    isUpdating.value = true;
    error.value = null;

    try {
      await updateAccount(accountId, updates);
      return true;
    } catch (e) {
      error.value = 'Не удалось обновить счёт';
      console.error('Failed to update account:', e);
      return false;
    } finally {
      isUpdating.value = false;
    }
  }

  async function remove(accountId: string) {
    // Check if this is the default account
    if (defaultAccountId.value === accountId) {
      error.value =
        'Нельзя удалить счёт по умолчанию. Сначала назначьте другой счёт по умолчанию.';
      return false;
    }

    isDeleting.value = true;
    error.value = null;

    try {
      await deleteAccount(accountId);
      // Invalidate all related caches (accounts, balances, transactions, monthly stats)
      await Promise.all([
        invalidateAccountRelated(queryClient, userId),
        invalidateTransactionRelated(queryClient, userId),
      ]);
      return true;
    } catch (e) {
      error.value = 'Не удалось удалить счёт';
      console.error('Failed to delete account:', e);
      return false;
    } finally {
      isDeleting.value = false;
    }
  }

  // Check if account is the default one
  function isDefaultAccount(accountId: string): boolean {
    return defaultAccountId.value === accountId;
  }

  return {
    isUpdating,
    isDeleting,
    error,
    update,
    remove,
    isDefaultAccount,
  };
}
