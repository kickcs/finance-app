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
    // Removing the immediate error for 0 participants, it will be handled as a warning in UI

    const totalAmount = totalAmountRef();
    const totalSplit = splitData.value.myShare + totalToReturn.value;
    const diff = totalAmount - totalSplit;

    if (splitData.value.participants.length > 0 && Math.abs(diff) > 1) {
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

    if (!splitData.value.isIncluded) {
      splitData.value.myShare = 0;
    }

    const participantCount =
      splitData.value.participants.length + (splitData.value.isIncluded ? 1 : 0);

    if (participantCount <= 0) return;

    const sharePerPerson = Math.floor(totalAmount / participantCount);
    const remainder = totalAmount - sharePerPerson * participantCount;

    if (splitData.value.isIncluded) {
      // Set my share (give remainder to me to avoid rounding issues)
      splitData.value.myShare = sharePerPerson + remainder;
    } else {
      // Give remainder to the first participant if I am not included
      if (splitData.value.participants.length > 0) {
        splitData.value.participants[0].amount = sharePerPerson + remainder;
        for (let i = 1; i < splitData.value.participants.length; i++) {
          splitData.value.participants[i].amount = sharePerPerson;
        }
        return;
      }
    }

    // Set participants' shares
    splitData.value.participants.forEach((p) => {
      p.amount = sharePerPerson;
    });
  }

  function addParticipant(name: string, fromContacts = false, personColor?: string) {
    if (!name.trim()) return;

    splitData.value.participants.push({
      id: generateParticipantId(),
      personName: name.trim(),
      amount: 0,
      fromContacts,
      personColor,
    });

    if (splitData.value.method === 'equal') {
      recalculateShares();
    }
  }

  function autoCalcMyShareInCustom() {
    if (splitData.value.method !== 'custom') return;

    if (!splitData.value.isIncluded) {
      splitData.value.myShare = 0;
      return;
    }

    const totalAmount = totalAmountRef();
    const friendsTotal = splitData.value.participants.reduce((sum, p) => sum + p.amount, 0);
    const newMyShare = totalAmount - friendsTotal;
    // Set myShare to the remainder, even if it's negative (will show as error in validation)
    splitData.value.myShare = newMyShare >= 0 ? newMyShare : 0;
  }

  function removeParticipant(id: string) {
    const index = splitData.value.participants.findIndex((p) => p.id === id);
    if (index > -1) {
      splitData.value.participants.splice(index, 1);

      if (splitData.value.method === 'equal') {
        recalculateShares();
      } else {
        autoCalcMyShareInCustom();
      }
    }
  }

  function updateParticipantAmount(id: string, amount: number) {
    const participant = splitData.value.participants.find((p) => p.id === id);
    if (participant) {
      participant.amount = Math.max(0, amount);
      if (splitData.value.method === 'custom') {
        autoCalcMyShareInCustom();
      }
    }
  }

  function setIsIncluded(included: boolean) {
    splitData.value.isIncluded = included;
    if (splitData.value.method === 'equal') {
      recalculateShares();
    } else {
      autoCalcMyShareInCustom();
    }
  }

  function updateParticipantName(id: string, name: string) {
    const participant = splitData.value.participants.find((p) => p.id === id);
    if (participant && name.trim()) {
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
      const validParticipants = splitData.value.participants.filter((p) => p.amount > 0);

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
    setIsIncluded,
    setEnabled,
    recalculateShares,
    createDebtsForSplit,
    reset,
  };
}
