import { ref } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import { debtsApi } from '@/entities/debt';
import type { Transaction } from '@/shared/api/database.types';

export function useTransactionSelection(
  userId: Ref<string> | ComputedRef<string>,
) {
  const selectedTransaction = ref<Transaction | null>(null);
  const hasSplitDebts = ref(false);
  const showEditModal = ref(false);

  async function select(transaction: Transaction) {
    selectedTransaction.value = transaction;
    hasSplitDebts.value = false;

    if (!transaction.is_debt_related && userId.value) {
      try {
        const allDebts = await debtsApi.getAll(userId.value);
        const linked = allDebts.filter(
          (d) => d.source_transaction_id === transaction.id && !d.is_closed,
        );
        hasSplitDebts.value = linked.length > 0;
      } catch {
        hasSplitDebts.value = false;
      }
    }

    showEditModal.value = true;
  }

  function close() {
    showEditModal.value = false;
  }

  return { selectedTransaction, hasSplitDebts, showEditModal, select, close };
}
