import { ref, computed } from 'vue';
import { transactionsApi } from '@/entities/transaction';
import { debtsApi, debtQueryKeys } from '@/entities/debt';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useQueryClient } from '@tanstack/vue-query';
import { useHaptics } from '@/shared/lib/haptics';
import { usePhotoStep, type OcrResult } from './usePhotoStep';
import { useItemsStep, uid } from './useItemsStep';
import { useParticipantsStep } from './useParticipantsStep';
import type { ParticipantSummary, ScanReceiptFormData, WizardDirection } from './types';

export function useReceiptWizard(userId: () => string | null) {
  const { trigger } = useHaptics();
  const queryClient = useQueryClient();

  // Step state
  const currentStep = ref(1);
  const direction = ref<WizardDirection>('forward');

  // Step 2: Items (delegated to useItemsStep)
  const itemsStep = useItemsStep();
  const { items, currency, storeName, charges, totalAmount, getItemWithChargesTotal } = itemsStep;

  // Step 3: Participants (delegated to useParticipantsStep)
  const participantsStep = useParticipantsStep(items);
  const { participants } = participantsStep;

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
    ...itemsStep,
    // Step 3
    ...participantsStep,
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
