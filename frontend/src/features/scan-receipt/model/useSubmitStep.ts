import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { transactionsApi } from '@/entities/transaction';
import { debtsApi, debtQueryKeys } from '@/entities/debt';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useQueryClient } from '@tanstack/vue-query';
import { useHaptics } from '@/shared/lib/haptics';
import type { ReceiptItem, Participant, ParticipantSummary, ScanReceiptFormData } from './types';

export function useSubmitStep(
  userId: () => string | null,
  items: Ref<ReceiptItem[]>,
  participants: Ref<Participant[]>,
  storeName: Ref<string | null>,
  totalAmount: ComputedRef<number>,
  getItemWithChargesTotal: (item: ReceiptItem) => number,
) {
  const { trigger } = useHaptics();
  const queryClient = useQueryClient();

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

  // Retry bookkeeping: keeps a failed submit from duplicating the transaction
  // or already-created debts on the next attempt.
  const createdTransactionId = ref<string | null>(null);
  const createdDebtParticipantIds = new Set<string>();

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

  async function handleSubmit() {
    const uid_ = userId();
    if (!uid_ || !formData.value.accountId || !formData.value.categoryId) return;
    // Double-tap guard + no resubmission after success
    if (isSubmitting.value || isSuccess.value) return;

    isSubmitting.value = true;
    submitError.value = null;

    try {
      // Create the main expense transaction (skipped on retry if it already
      // succeeded in a previous attempt)
      if (!createdTransactionId.value) {
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
        createdTransactionId.value = transaction.id;
      }

      // Create debts for non-me participants, sequentially so a failure mid-way
      // is retryable without duplicating the already-created ones
      if (formData.value.createDebts) {
        const nonMeSummaries = participantSummaries.value.filter((p) => {
          if (p.isMe) return false;
          if (p.total <= 0) return false;
          if (createdDebtParticipantIds.has(p.id)) return false;
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
            account_id: formData.value.accountId!,
            currency: formData.value.currency,
            source_transaction_id: createdTransactionId.value,
          });
          createdDebtParticipantIds.add(summary.id);
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
    formData,
    participantSummaries,
    isSubmitting,
    submitError,
    isSuccess,
    isFormValid,
    handleSubmit,
  };
}
