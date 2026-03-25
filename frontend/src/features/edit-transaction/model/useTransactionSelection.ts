import { ref, type MaybeRefOrGetter, toValue } from 'vue';
import { debtsApi, type Debt } from '@/entities/debt';
import type { Transaction } from '@/shared/api/database.types';

export function useTransactionSelection(userId: MaybeRefOrGetter<string | null>) {
  const selectedTransaction = ref<Transaction | null>(null);
  const hasSplitDebts = ref(false);
  const splitDebts = ref<Debt[]>([]);
  const showEditModal = ref(false);

  async function select(transaction: Transaction) {
    selectedTransaction.value = transaction;
    hasSplitDebts.value = false;
    splitDebts.value = [];

    const uid = toValue(userId);
    if (!transaction.is_debt_related && uid) {
      try {
        const allDebts = await debtsApi.getAll(uid);
        const linked = allDebts.filter((d) => d.source_transaction_id === transaction.id);
        splitDebts.value = linked;
        hasSplitDebts.value = linked.some((d) => !d.is_closed);
      } catch {
        hasSplitDebts.value = false;
        splitDebts.value = [];
      }
    }

    showEditModal.value = true;
  }

  function close() {
    showEditModal.value = false;
  }

  return { selectedTransaction, hasSplitDebts, splitDebts, showEditModal, select, close };
}
