import { ref } from 'vue';
import { transactionsApi } from '@/entities/transaction';
import { debtsApi } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import {
  invalidateTransactionRelated,
  invalidateAccountRelated,
} from '@/shared/api/invalidation';
import type { Transaction } from '@/shared/api/database.types';

export function useEditTransaction(userId: string) {
  const isUpdating = ref(false);
  const isDeleting = ref(false);
  const error = ref<string | null>(null);

  async function update(
    transaction: Transaction,
    updates: Partial<Transaction>,
  ) {
    // Debt-related transactions cannot be edited
    if (transaction.is_debt_related) {
      error.value =
        'Транзакции долгов нельзя редактировать. Управляйте долгом в разделе "Долги"';
      return false;
    }

    // Transfers cannot be edited
    if (transaction.type === 'transfer') {
      error.value = 'Переводы нельзя редактировать, только удалять';
      return false;
    }

    isUpdating.value = true;
    error.value = null;

    try {
      // Update transaction
      // Note: Backend should handle balance recalculation in production
      // Currently, amount/type changes may not update balances correctly
      await transactionsApi.update(transaction.id, updates);

      // Invalidate all related caches
      await Promise.all([
        invalidateTransactionRelated(queryClient, userId),
        invalidateAccountRelated(queryClient, userId),
      ]);

      return true;
    } catch (e) {
      error.value = 'Не удалось обновить транзакцию';
      console.error('Failed to update transaction:', e);
      return false;
    } finally {
      isUpdating.value = false;
    }
  }

  async function remove(transaction: Transaction) {
    // Debt-related transactions cannot be deleted directly
    if (transaction.is_debt_related) {
      error.value =
        'Транзакции долгов нельзя удалять. Удалите долг в разделе "Долги"';
      return false;
    }

    isDeleting.value = true;
    error.value = null;

    // Check if there are OPEN split debts linked to this transaction
    // Closed debts are OK - the transaction amount already reflects payments
    try {
      const allDebts = await debtsApi.getAll(userId);
      const linkedDebts = allDebts.filter(
        (d) => d.source_transaction_id === transaction.id && !d.is_closed,
      );

      if (linkedDebts.length > 0) {
        error.value =
          'Нельзя удалить транзакцию с открытыми долгами. Сначала закройте или удалите связанные долги';
        isDeleting.value = false;
        return false;
      }
    } catch {
      // Ignore check error, continue with deletion
    }

    try {
      // Delete transaction
      // Note: Backend automatically reverses account balance when deleting
      await transactionsApi.delete(transaction.id);

      // Invalidate all related caches
      await Promise.all([
        invalidateTransactionRelated(queryClient, userId),
        invalidateAccountRelated(queryClient, userId),
      ]);

      return true;
    } catch (e) {
      error.value = 'Не удалось удалить транзакцию';
      console.error('Failed to delete transaction:', e);
      return false;
    } finally {
      isDeleting.value = false;
    }
  }

  return {
    isUpdating,
    isDeleting,
    error,
    update,
    remove,
  };
}
