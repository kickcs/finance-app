import { ref, type MaybeRefOrGetter } from 'vue';
import type { Transaction } from '@/shared/api/database.types';
import { useTransactionSelection } from './useTransactionSelection';
import { useEditTransaction } from './useEditTransaction';

export function useTransactionEditFlow(userId: MaybeRefOrGetter<string | null>) {
  const showDeleteModal = ref(false);

  const {
    selectedTransaction,
    showEditModal,
    select: handleTransactionClick,
    close: closeEditModal,
  } = useTransactionSelection();

  const {
    isUpdating,
    isDeleting,
    error: editError,
    update: updateTransactionFn,
    remove: removeTransactionFn,
  } = useEditTransaction(userId);

  async function saveTransaction(updates: Partial<Transaction>): Promise<boolean> {
    if (!selectedTransaction.value) return false;
    return updateTransactionFn(selectedTransaction.value, updates);
  }

  async function handleDeleteTransaction() {
    if (!selectedTransaction.value) return;
    const success = await removeTransactionFn(selectedTransaction.value);
    if (success) {
      showDeleteModal.value = false;
      closeEditModal();
    }
  }

  function handleDeleteClick() {
    closeEditModal();
    showDeleteModal.value = true;
  }

  function handleSwipeDelete(transaction: Transaction) {
    selectedTransaction.value = transaction;
    showDeleteModal.value = true;
  }

  return {
    selectedTransaction,
    showEditModal,
    showDeleteModal,
    isUpdating,
    isDeleting,
    editError,
    handleTransactionClick,
    saveTransaction,
    handleDeleteTransaction,
    handleDeleteClick,
    handleSwipeDelete,
    closeEditModal,
  };
}
