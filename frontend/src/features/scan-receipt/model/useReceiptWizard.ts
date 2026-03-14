import { ref, computed } from 'vue';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { transactionsApi } from '@/entities/transaction';
import { debtsApi, debtQueryKeys } from '@/entities/debt';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useQueryClient } from '@tanstack/vue-query';
import { useHaptics } from '@/shared/lib/haptics';
import { calcLineTotal, calcLineTotalWithCharges, getTotalChargePercent } from './calcLineTotal';
import { ALL_PARTICIPANTS_ID } from './constants';
import { usePhotoStep, type OcrResult } from './usePhotoStep';
import type {
  ReceiptItem,
  ReceiptCharge,
  Participant,
  ParticipantSummary,
  ScanReceiptFormData,
  WizardDirection,
} from './types';

let nextId = 0;
function uid(): string {
  return `ri_${++nextId}_${Date.now()}`;
}

export function useReceiptWizard(userId: () => string | null) {
  const { trigger } = useHaptics();
  const queryClient = useQueryClient();

  // Step state
  const currentStep = ref(1);
  const direction = ref<WizardDirection>('forward');

  // Step 2: Items
  const items = ref<ReceiptItem[]>([]);
  const currency = ref('UZS');
  const storeName = ref<string | null>(null);
  const charges = ref<ReceiptCharge[]>([]);

  // Step 3: Participants
  const participants = ref<Participant[]>([]);

  // Step 4: Form
  const formData = ref<ScanReceiptFormData>({
    accountId: null,
    categoryId: '',
    description: '',
    date: Date.now(),
    createDebts: true,
    currency: 'UZS',
  });
  const isSubmitting = ref(false);
  const submitError = ref<string | null>(null);
  const isSuccess = ref(false);

  // Computed
  const subtotal = computed(() => items.value.reduce((sum, item) => sum + calcLineTotal(item), 0));

  const totalChargePercent = computed(() => getTotalChargePercent(charges.value));

  const chargesAmount = computed(() => {
    if (!totalChargePercent.value) return 0;
    return Math.round((subtotal.value * totalChargePercent.value) / 100);
  });

  const totalAmount = computed(() => subtotal.value + chargesAmount.value);

  // Per-item charge-inclusive price (proportionally distributed)
  function getItemWithChargesTotal(item: ReceiptItem): number {
    return calcLineTotalWithCharges(item, charges.value);
  }

  const unassignedCount = computed(
    () => items.value.filter((item) => item.assignedParticipantIds.length === 0).length,
  );

  const participantSummaries = computed<ParticipantSummary[]>(() => {
    const summaries = participants.value.map((p) => {
      const assignedItems = items.value
        .filter((item) => item.assignedParticipantIds.includes(p.id))
        .map((item) => {
          const sharedWith = item.assignedParticipantIds.length;
          const lineTotal = getItemWithChargesTotal(item);
          const isLast =
            item.assignedParticipantIds[item.assignedParticipantIds.length - 1] === p.id;
          const baseShare = Math.floor(lineTotal / sharedWith);
          const share = isLast ? lineTotal - baseShare * (sharedWith - 1) : baseShare;
          return {
            id: item.id,
            name: item.name,
            lineTotal,
            share,
            sharedWith,
          };
        });

      return {
        id: p.id,
        name: p.name,
        isMe: p.isMe,
        color: p.color,
        itemCount: assignedItems.length,
        total: assignedItems.reduce((sum, i) => sum + i.share, 0),
        items: assignedItems,
      } as ParticipantSummary;
    });

    // Redistribute paidBy amounts: add paid-for participant's total to their payer
    for (const summary of summaries) {
      const participant = participants.value.find((p) => p.id === summary.id);
      if (participant?.paidById) {
        const payer = summaries.find((s) => s.id === participant.paidById);
        if (payer) {
          payer.total += summary.total;
          summary.paidById = participant.paidById;
          summary.paidByName = payer.name;
        }
      }
    }

    return summaries;
  });

  // Step navigation
  function goNext() {
    if (currentStep.value < 4) {
      direction.value = 'forward';
      currentStep.value++;
      trigger('selection');
    }
  }

  function goBack() {
    if (currentStep.value > 1) {
      direction.value = 'back';
      currentStep.value--;
      trigger('selection');
    }
  }

  // Step 1: Photo (delegated to usePhotoStep)
  function handleOcrResult(result: OcrResult) {
    items.value = result.items.map((item) => ({
      id: uid(),
      name: item.name,
      qty: item.quantity,
      unitPrice: item.unitPrice,
      ocrTotalPrice: item.totalPrice ?? null,
      assignedParticipantIds: [],
    }));
    currency.value = result.currency;
    formData.value.currency = result.currency;
    storeName.value = result.storeName;

    // Seed charges from OCR serviceChargePercent
    const rawPercent = result.serviceChargePercent;
    if (rawPercent && rawPercent >= 0.1) {
      charges.value = [{ id: uid(), label: 'Обслуживание', percent: rawPercent, enabled: true }];
    } else {
      charges.value = [];
    }

    // Use hashtags from OCR for description, fallback to store name
    if (result.hashtags?.length > 0) {
      formData.value.description = result.hashtags.join(' ');
    } else if (result.storeName) {
      formData.value.description = `#${result.storeName.replace(/[^a-zа-яёA-ZА-ЯЁ0-9]/g, '').toLowerCase()}`;
    }
    if (result.date) {
      formData.value.date = new Date(result.date).getTime();
    }
  }

  const photoStep = usePhotoStep(handleOcrResult, goNext);

  // Step 2: Item editing
  function updateItem(id: string, updates: Partial<ReceiptItem>) {
    const idx = items.value.findIndex((i) => i.id === id);
    if (idx !== -1) {
      // Clear OCR total when user manually edits qty or price — recalculate from qty × unitPrice
      if ('qty' in updates || 'unitPrice' in updates) {
        updates.ocrTotalPrice = null;
      }
      items.value[idx] = { ...items.value[idx], ...updates };
    }
  }

  function deleteItem(id: string) {
    items.value = items.value.filter((i) => i.id !== id);
    trigger('warning');
  }

  function addItem(): string {
    const id = uid();
    items.value.push({
      id,
      name: '',
      qty: 1,
      unitPrice: 0,
      ocrTotalPrice: null,
      assignedParticipantIds: [],
    });
    trigger('selection');
    return id;
  }

  function splitItem(id: string, firstQty: number) {
    const idx = items.value.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const original = items.value[idx];
    const secondQty = original.qty - firstQty;
    if (firstQty <= 0 || secondQty <= 0) return;

    const ratio1 = firstQty / original.qty;

    const item1: ReceiptItem = {
      id: uid(),
      name: `${original.name} (1/2)`,
      qty: firstQty,
      unitPrice: original.unitPrice,
      ocrTotalPrice: original.ocrTotalPrice ? Math.round(original.ocrTotalPrice * ratio1) : null,
      assignedParticipantIds: [],
    };

    const item2: ReceiptItem = {
      id: uid(),
      name: `${original.name} (2/2)`,
      qty: secondQty,
      unitPrice: original.unitPrice,
      ocrTotalPrice: original.ocrTotalPrice
        ? original.ocrTotalPrice - Math.round(original.ocrTotalPrice * ratio1)
        : null,
      assignedParticipantIds: [],
    };

    items.value.splice(idx, 1, item1, item2);
    trigger('success');
  }

  // Step 2: Charge management
  function addCharge(label: string, percent: number) {
    charges.value.push({ id: uid(), label, percent, enabled: true });
    trigger('selection');
  }

  function removeCharge(id: string) {
    charges.value = charges.value.filter((c) => c.id !== id);
    trigger('warning');
  }

  function toggleCharge(id: string) {
    const charge = charges.value.find((c) => c.id === id);
    if (charge) {
      charge.enabled = !charge.enabled;
      trigger('selection');
    }
  }

  function updateChargePercent(id: string, percent: number) {
    const charge = charges.value.find((c) => c.id === id);
    if (charge) {
      charge.percent = percent;
    }
  }

  // Step 3: Participants
  function addParticipant(name: string, isMe = false, paidById: string | null = null) {
    const colorIndex = participants.value.length % ENTITY_COLORS.length;
    participants.value.push({
      id: uid(),
      name,
      isMe,
      color: ENTITY_COLORS[colorIndex] as string,
      paidById,
    });
    trigger('selection');
  }

  function removeParticipant(id: string) {
    participants.value = participants.value.filter((p) => p.id !== id);
    // Clear paidById references to the removed participant
    participants.value.forEach((p) => {
      if (p.paidById === id) p.paidById = null;
    });
    // Remove from all item assignments
    items.value.forEach((item) => {
      item.assignedParticipantIds = item.assignedParticipantIds.filter((pid) => pid !== id);
    });
    trigger('warning');
  }

  function toggleItemParticipant(itemId: string, participantId: string) {
    const item = items.value.find((i) => i.id === itemId);
    if (!item) return;

    if (participantId === ALL_PARTICIPANTS_ID) {
      const allIds = participants.value.map((p) => p.id);
      const isAssignedToAll = allIds.every((id) => item.assignedParticipantIds.includes(id));
      if (isAssignedToAll) {
        item.assignedParticipantIds = [];
      } else {
        item.assignedParticipantIds = [...allIds];
      }
    } else {
      const idx = item.assignedParticipantIds.indexOf(participantId);
      if (idx === -1) {
        item.assignedParticipantIds.push(participantId);
      } else {
        item.assignedParticipantIds.splice(idx, 1);
      }
    }
    trigger('selection');
  }

  const hasMe = computed(() => participants.value.some((p) => p.isMe));

  // Step 4: Submit
  async function handleSubmit() {
    const uid_ = userId();
    if (!uid_ || !formData.value.accountId || !formData.value.categoryId) return;

    isSubmitting.value = true;
    submitError.value = null;

    try {
      // Create the main expense transaction
      const transaction = await transactionsApi.create({
        user_id: uid_,
        account_id: formData.value.accountId,
        category_id: formData.value.categoryId,
        amount: totalAmount.value,
        currency: formData.value.currency,
        type: 'expense',
        description: formData.value.description || null,
        date: new Date(formData.value.date).toISOString(),
      });

      // Create debts for non-me participants
      if (formData.value.createDebts) {
        const nonMeSummaries = participantSummaries.value.filter((p) => {
          if (p.isMe) return false;
          if (p.total <= 0) return false;
          const participant = participants.value.find((pp) => pp.id === p.id);
          if (participant?.paidById) return false;
          return true;
        });
        for (const summary of nonMeSummaries) {
          await debtsApi.create({
            user_id: uid_,
            name: `Чек: ${storeName.value || 'Без названия'}`,
            total_amount: summary.total,
            remaining_amount: summary.total,
            debt_type: 'given',
            person_name: summary.name,
            account_id: formData.value.accountId,
            currency: formData.value.currency,
            source_transaction_id: transaction.id,
          });
        }
      }

      // Invalidate caches
      invalidateTransactionRelated(queryClient, uid_);
      invalidateAccountRelated(queryClient, uid_);
      queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(uid_) });

      isSuccess.value = true;
      trigger('success');
    } catch (error: unknown) {
      console.error('Receipt submit failed:', error);
      submitError.value = error instanceof Error ? error.message : 'Произошла ошибка';
      trigger('error');
    } finally {
      isSubmitting.value = false;
    }
  }

  const isFormValid = computed(
    () => !!formData.value.accountId && !!formData.value.categoryId && totalAmount.value > 0,
  );

  return {
    // Step state
    currentStep,
    direction,
    goNext,
    goBack,
    // Step 1
    ...photoStep,
    // Step 2
    items,
    currency,
    storeName,

    subtotal,
    charges,
    chargesAmount,
    totalChargePercent,
    totalAmount,
    getItemWithChargesTotal,
    updateItem,
    deleteItem,
    addItem,
    splitItem,
    addCharge,
    removeCharge,
    toggleCharge,
    updateChargePercent,
    // Step 3
    participants,
    hasMe,
    unassignedCount,
    addParticipant,
    removeParticipant,
    toggleItemParticipant,
    // Step 4
    formData,
    participantSummaries,
    isSubmitting,
    submitError,
    isSuccess,
    isFormValid,
    handleSubmit,
  };
}
