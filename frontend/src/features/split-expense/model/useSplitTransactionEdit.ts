// frontend/src/features/split-expense/model/useSplitTransactionEdit.ts
import { ref, computed, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { debtsApi, buildDebtName, type Debt } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';

export interface SplitParticipantView {
  debtId: string;
  personName: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  isClosed: boolean;
  hasPayments: boolean;
  isLocked: boolean;
  isNew: boolean;
}

interface PendingAdd {
  id: string;
  personName: string;
  amount: number;
}

interface PendingUpdate {
  amount?: number;
  personName?: string;
}

export function useSplitTransactionEdit(
  transactionId: MaybeRefOrGetter<string | null>,
  userId: MaybeRefOrGetter<string | null>,
  transactionAmount: MaybeRefOrGetter<number>,
  transactionAccountId?: MaybeRefOrGetter<string>,
  transactionCurrency?: MaybeRefOrGetter<string>,
) {
  const { toast } = useToast();

  let nextNewId = 0;
  const splitDebts = ref<Debt[]>([]);
  const isLoading = ref(false);

  // Track local changes
  const pendingAdds = ref<PendingAdd[]>([]);
  const pendingDeletes = ref<Set<string>>(new Set());
  const pendingUpdates = ref<Map<string, PendingUpdate>>(new Map());

  // Load split debts for transaction
  async function loadSplitDebts() {
    const txId = toValue(transactionId);
    const uid = toValue(userId);
    if (!txId || !uid) {
      splitDebts.value = [];
      return;
    }

    isLoading.value = true;
    try {
      const allDebts = await debtsApi.getAll(uid);
      splitDebts.value = allDebts.filter((d) => d.source_transaction_id === txId);
    } catch {
      splitDebts.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  watch(() => toValue(transactionId), reload, { immediate: true });

  // Build participant views
  const participants = computed<SplitParticipantView[]>(() => {
    const existing = splitDebts.value
      .filter((d) => !pendingDeletes.value.has(d.id))
      .map((d) => {
        const update = pendingUpdates.value.get(d.id);
        const paidAmount = d.total_amount - d.remaining_amount;
        return {
          debtId: d.id,
          personName: update?.personName ?? d.person_name ?? '',
          amount: update?.amount ?? d.total_amount,
          paidAmount,
          remainingAmount: d.remaining_amount,
          isClosed: d.is_closed,
          hasPayments: paidAmount > 0,
          isLocked: paidAmount > 0 || d.is_closed,
          isNew: false,
        };
      });

    const added = pendingAdds.value.map((a) => ({
      debtId: a.id,
      personName: a.personName,
      amount: a.amount,
      paidAmount: 0,
      remainingAmount: a.amount,
      isClosed: false,
      hasPayments: false,
      isLocked: false,
      isNew: true,
    }));

    return [...existing, ...added];
  });

  const hasSplit = computed(() => participants.value.length > 0);

  const hasPendingChanges = computed(
    () =>
      pendingDeletes.value.size > 0 ||
      pendingAdds.value.length > 0 ||
      pendingUpdates.value.size > 0,
  );

  const myShare = computed(() => {
    const total = toValue(transactionAmount);
    const participantTotal = participants.value.reduce((sum, p) => sum + p.amount, 0);
    return total - participantTotal;
  });

  function canEditParticipant(debtId: string): boolean {
    const p = participants.value.find((x) => x.debtId === debtId);
    return p ? !p.isLocked : false;
  }

  function updateParticipantAmount(debtId: string, amount: number) {
    if (!canEditParticipant(debtId)) return;

    const p = participants.value.find((x) => x.debtId === debtId);
    if (!p) return;

    if (p.isNew) {
      const idx = pendingAdds.value.findIndex((a) => a.id === debtId);
      if (idx > -1) pendingAdds.value[idx].amount = Math.max(0, amount);
    } else {
      const existing = pendingUpdates.value.get(debtId) ?? {};
      pendingUpdates.value.set(debtId, { ...existing, amount: Math.max(0, amount) });
    }
  }

  function updateParticipantName(debtId: string, name: string) {
    if (!canEditParticipant(debtId) || !name.trim()) return;

    const p = participants.value.find((x) => x.debtId === debtId);
    if (!p) return;

    if (p.isNew) {
      const idx = pendingAdds.value.findIndex((a) => a.id === debtId);
      if (idx > -1) pendingAdds.value[idx].personName = name.trim();
    } else {
      const existing = pendingUpdates.value.get(debtId) ?? {};
      pendingUpdates.value.set(debtId, { ...existing, personName: name.trim() });
    }
  }

  function addParticipant(name: string, amount: number) {
    if (!name.trim()) return;
    pendingAdds.value.push({
      id: `new-${nextNewId++}`,
      personName: name.trim(),
      amount: Math.max(0, amount),
    });
  }

  function removeParticipant(debtId: string) {
    if (!canEditParticipant(debtId)) return;

    const p = participants.value.find((x) => x.debtId === debtId);
    if (!p) return;

    if (p.isNew) {
      const idx = pendingAdds.value.findIndex((a) => a.id === debtId);
      if (idx > -1) pendingAdds.value.splice(idx, 1);
    } else {
      pendingDeletes.value.add(debtId);
      pendingUpdates.value.delete(debtId);
    }
  }

  function handleTransactionAmountChange(newAmount: number, strategy: 'redistribute' | 'keep') {
    if (strategy === 'keep') {
      // Keep all participant amounts, myShare absorbs the difference
      return;
    }

    // Redistribute: only change unlocked participants
    const locked = participants.value.filter((p) => p.isLocked);
    const unlocked = participants.value.filter((p) => !p.isLocked);

    const lockedTotal = locked.reduce((sum, p) => sum + p.amount, 0);
    const availableForRedistribution = newAmount - lockedTotal;

    // Cannot redistribute: locked amounts already exceed new total
    if (availableForRedistribution <= 0) return;

    // Count = unlocked participants + user's share
    const count = unlocked.length + 1; // +1 for user
    if (count <= 0) return;

    const sharePerPerson = Math.floor(availableForRedistribution / count);

    for (const p of unlocked) {
      updateParticipantAmount(p.debtId, sharePerPerson);
    }
    // myShare is computed automatically as remainder
  }

  async function saveChanges(): Promise<boolean> {
    const uid = toValue(userId);
    const txId = toValue(transactionId);
    if (!uid || !txId) return false;

    // Nothing to do — skip API calls and invalidation
    if (!hasPendingChanges.value) return true;

    try {
      // 1. Delete removed debts (remove from set on success to avoid double-delete on retry)
      for (const debtId of [...pendingDeletes.value]) {
        await debtsApi.delete(debtId);
        pendingDeletes.value.delete(debtId);
      }

      // 2. Update modified debts (remove from map on success to avoid double-update on retry)
      for (const [debtId, update] of [...pendingUpdates.value]) {
        const debt = splitDebts.value.find((d) => d.id === debtId);
        if (!debt) {
          pendingUpdates.value.delete(debtId);
          continue;
        }

        const updates: Partial<Debt> = {};
        if (update.amount !== undefined) {
          updates.total_amount = update.amount;
          // Preserve payments: remaining = new_total - already_paid
          const paidAmount = debt.total_amount - debt.remaining_amount;
          updates.remaining_amount = Math.max(0, update.amount - paidAmount);
        }
        if (update.personName !== undefined) {
          updates.person_name = update.personName;
          updates.name = buildDebtName(debt.debt_type as 'given' | 'taken', update.personName);
        }

        if (Object.keys(updates).length > 0) {
          await debtsApi.update(debtId, updates);
        }
        pendingUpdates.value.delete(debtId);
      }

      // 3. Create new debts (shift from array on success to avoid duplicate creation on retry)
      // Use transaction context first, then first non-deleted debt as fallback
      const templateDebt = splitDebts.value.find((d) => !pendingDeletes.value.has(d.id));
      const acctId = toValue(transactionAccountId) || templateDebt?.account_id || '';
      const curr = toValue(transactionCurrency) || templateDebt?.currency || DEFAULT_CURRENCY;

      while (pendingAdds.value.length > 0) {
        const add = pendingAdds.value[0];
        if (add.amount <= 0) {
          pendingAdds.value.shift();
          continue;
        }

        await debtsApi.create({
          user_id: uid,
          name: buildDebtName('given', add.personName),
          total_amount: add.amount,
          remaining_amount: add.amount,
          debt_type: 'given',
          person_name: add.personName,
          account_id: acctId,
          transaction_id: null,
          source_transaction_id: txId,
          is_closed: false,
          currency: curr,
          created_at: new Date().toISOString(),
        });
        pendingAdds.value.shift();
      }

      // 4. Invalidate debt + transaction + account caches
      await invalidateDebtRelated(queryClient, uid);

      resetLocal();
      return true;
    } catch {
      toast({ title: 'Не удалось сохранить изменения', variant: 'error' });
      return false;
    }
  }

  function resetLocal() {
    pendingAdds.value = [];
    pendingDeletes.value = new Set();
    pendingUpdates.value = new Map();
  }

  function reload() {
    resetLocal();
    loadSplitDebts();
  }

  return {
    isLoading,
    hasSplit,
    hasPendingChanges,
    participants,
    myShare,
    updateParticipantAmount,
    updateParticipantName,
    addParticipant,
    removeParticipant,
    handleTransactionAmountChange,
    saveChanges,
    reload,
  };
}
