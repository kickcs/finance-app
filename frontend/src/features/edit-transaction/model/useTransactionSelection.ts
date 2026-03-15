import { ref, type MaybeRefOrGetter, toValue } from 'vue';
import { debtsApi } from '@/entities/debt';
import type { Transaction } from '@/shared/api/database.types';

export function useTransactionSelection(userId: MaybeRefOrGetter<string | null>) {
  const selectedTransaction = ref<Transaction | null>(null);
  const hasSplitDebts = ref(false);
  const showEditModal = ref(false);

  async function select(transaction: Transaction) {
    selectedTransaction.value = transaction;
    hasSplitDebts.value = false;

    const uid = toValue(userId);
    if (!transaction.is_debt_related && uid) {
      try {
        const allDebts = await debtsApi.getAll(uid);
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
