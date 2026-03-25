import { ref } from 'vue';
import type { Transaction } from '@/shared/api/database.types';

export function useTransactionSelection() {
  const selectedTransaction = ref<Transaction | null>(null);
  const showEditModal = ref(false);

  function select(transaction: Transaction) {
    selectedTransaction.value = transaction;
    showEditModal.value = true;
  }

  function close() {
    showEditModal.value = false;
  }

  return { selectedTransaction, showEditModal, select, close };
}
