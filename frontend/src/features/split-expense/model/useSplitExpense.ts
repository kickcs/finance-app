import { ref, computed, watch } from 'vue';
import { debtsApi, debtQueryKeys } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import type { SplitExpenseData, SplitMethod } from './types';
import { initialSplitData } from './types';

let participantIdCounter = 0;

function generateParticipantId(): string {
  return `participant_${++participantIdCounter}_${Date.now()}`;
}

export function useSplitExpense(totalAmountRef: () => number) {
  const splitData = ref<SplitExpenseData>({
    ...initialSplitData,
    participants: [], // Create new array to avoid sharing reference
  });

  const totalToReturn = computed(() => {
    return splitData.value.participants.reduce((sum, p) => sum + p.amount, 0);
  });

  const isValid = computed(() => {
    if (!splitData.value.enabled) return true;
    if (splitData.value.participants.length === 0) return false;

    const totalAmount = totalAmountRef();
    const totalSplit = splitData.value.myShare + totalToReturn.value;

    // Allow small rounding differences (1 unit tolerance)
    return Math.abs(totalSplit - totalAmount) <= 1;
  });

  const validationError = computed(() => {
    if (!splitData.value.enabled) return null;
    if (splitData.value.participants.length === 0) {
      return 'Добавьте хотя бы одного участника';
    }

    const totalAmount = totalAmountRef();
    const totalSplit = splitData.value.myShare + totalToReturn.value;
    const diff = totalAmount - totalSplit;

    if (Math.abs(diff) > 1) {
      if (diff > 0) {
        return `Не распределено: ${Math.round(diff).toLocaleString()}`;
      } else {
        return `Превышение на: ${Math.round(Math.abs(diff)).toLocaleString()}`;
      }
    }

    return null;
  });

  function recalculateShares() {
    const totalAmount = totalAmountRef();
    if (totalAmount <= 0 || splitData.value.method !== 'equal') return;

    const participantCount = splitData.value.participants.length + 1; // +1 for "me"
    if (participantCount <= 0) return;

    const sharePerPerson = Math.floor(totalAmount / participantCount);
    const remainder = totalAmount - sharePerPerson * participantCount;

    // Set my share (give remainder to me to avoid rounding issues)
    splitData.value.myShare = sharePerPerson + remainder;

    // Set participants' shares
    splitData.value.participants.forEach((p) => {
      p.amount = sharePerPerson;
    });
  }

  function addParticipant(name: string) {
    if (!name.trim()) return;

    splitData.value.participants.push({
      id: generateParticipantId(),
      personName: name.trim(),
      amount: 0,
    });

    if (splitData.value.method === 'equal') {
      recalculateShares();
    }
  }

  function removeParticipant(id: string) {
    const index = splitData.value.participants.findIndex((p) => p.id === id);
    if (index > -1) {
      splitData.value.participants.splice(index, 1);

      if (splitData.value.method === 'equal') {
        recalculateShares();
      }
    }
  }

  function updateParticipantAmount(id: string, amount: number) {
    const participant = splitData.value.participants.find((p) => p.id === id);
    if (participant) {
      participant.amount = Math.max(0, amount);
    }
  }

  function updateParticipantName(id: string, name: string) {
    const participant = splitData.value.participants.find((p) => p.id === id);
    if (participant) {
      participant.personName = name;
    }
  }

  function setMethod(method: SplitMethod) {
    splitData.value.method = method;
    if (method === 'equal') {
      recalculateShares();
    }
  }

  function setMyShare(amount: number) {
    splitData.value.myShare = Math.max(0, amount);
  }

  function setEnabled(enabled: boolean) {
    splitData.value.enabled = enabled;
    if (enabled && splitData.value.participants.length === 0) {
      // Initialize with default values when enabled
      splitData.value.myShare = totalAmountRef();
    }
  }

  function reset() {
    splitData.value = {
      ...initialSplitData,
      participants: [], // Create new array to avoid sharing reference with initialSplitData
    };
  }

  async function createDebtsForSplit(
    transactionId: string,
    userId: string,
    accountId: string,
    currency: string,
  ): Promise<boolean> {
    if (!splitData.value.enabled || splitData.value.participants.length === 0) {
      return true;
    }

    try {
      // Filter out participants with zero or negative amounts
      const validParticipants = splitData.value.participants.filter(
        (p) => p.amount > 0,
      );

      if (validParticipants.length === 0) {
        console.warn('No valid participants with amount > 0 for split expense');
        return true; // Nothing to create, but not an error
      }

      // Create debts one by one using the API
      for (const participant of validParticipants) {
        await debtsApi.create({
          user_id: userId,
          name: `Долг от ${participant.personName}`,
          total_amount: participant.amount,
          remaining_amount: participant.amount,
          debt_type: 'given',
          person_name: participant.personName,
          account_id: accountId,
          transaction_id: null,
          source_transaction_id: transactionId,
          is_closed: false,
          currency: currency,
        });
      }

      // Invalidate debts cache
      await queryClient.invalidateQueries({
        queryKey: debtQueryKeys.list(userId),
      });

      return true;
    } catch (e) {
      console.error('Failed to create debts for split expense:', e);
      return false;
    }
  }

  // Watch for total amount changes and recalculate if in equal mode
  watch(totalAmountRef, () => {
    if (splitData.value.enabled && splitData.value.method === 'equal') {
      recalculateShares();
    }
  });

  return {
    splitData,
    totalToReturn,
    isValid,
    validationError,
    addParticipant,
    removeParticipant,
    updateParticipantAmount,
    updateParticipantName,
    setMethod,
    setMyShare,
    setEnabled,
    recalculateShares,
    createDebtsForSplit,
    reset,
  };
}
