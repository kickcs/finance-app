import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { transactionsApi } from '@/entities/transaction';
import { debtsApi, debtQueryKeys } from '@/entities/debt';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useQueryClient } from '@tanstack/vue-query';
import { useToast } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import {
  importedTransactionsApi,
  importedTransactionQueryKeys,
} from '@/entities/imported-transaction';
import type { ReceiptItem, Participant, ParticipantSummary, ScanReceiptFormData } from './types';

export function useSubmitStep(
  userId: () => string | null,
  items: Ref<ReceiptItem[]>,
  participants: Ref<Participant[]>,
  storeName: Ref<string | null>,
  totalAmount: ComputedRef<number>,
  getItemWithChargesTotal: (item: ReceiptItem) => number,
  /** When scanning a receipt for a Telegram-imported op, its id to confirm on success. */
  importedId: () => string | null = () => null,
) {
  const { trigger } = useHaptics();
  const { toast } = useToast();
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

  // Кто платил по чеку: null — «Я» (обычный путь с транзакцией).
  // Другой участник — транзакция не создаётся, создаётся мой долг ему.
  const payerId = ref<string | null>(null);

  // Retry bookkeeping: keeps a failed submit from duplicating the transaction
  // or already-created debts on the next attempt.
  const createdTransactionId = ref<string | null>(null);
  const createdDebtParticipantIds = new Set<string>();
  // Идемпотентность долга «я должен» при ретраях («Платил не я»)
  const createdTakenDebt = ref(false);
  // Idempotency for the linked-import confirm across retries.
  const importConfirmed = ref(false);

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

  /** Плательщик-«не я»: существует и не isMe, иначе null (платил я) */
  const payer = computed<Participant | null>(() => {
    if (!payerId.value) return null;
    const found = participants.value.find((p) => p.id === payerId.value);
    return found && !found.isMe ? found : null;
  });

  /** Моя доля (включая тех, за кого плачу я) — сумма долга при «Платил не я» */
  const myShareTotal = computed(() => {
    const mine = participantSummaries.value.find((s) => s.isMe);
    return mine?.total ?? 0;
  });

  async function handleSubmit() {
    const uid_ = userId();
    if (!uid_ || !isFormValid.value) return;
    // Double-tap guard + no resubmission after success
    if (isSubmitting.value || isSuccess.value) return;

    isSubmitting.value = true;
    submitError.value = null;

    // «Платил не я»: вместо расхода — один долг «я должен» плательщику
    if (payer.value) {
      try {
        if (!createdTakenDebt.value) {
          await debtsApi.create({
            user_id: uid_,
            name: `Чек: ${storeName.value || 'Без названия'}`,
            total_amount: myShareTotal.value,
            remaining_amount: myShareTotal.value,
            debt_type: 'taken',
            person_name: payer.value.name,
            account_id: formData.value.accountId!,
            currency: formData.value.currency,
          });
          createdTakenDebt.value = true;
        }

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
      return;
    }

    try {
      // Create the main expense transaction (skipped on retry if it already
      // succeeded in a previous attempt)
      if (!createdTransactionId.value) {
        const transaction = await transactionsApi.create({
          user_id: uid_,
          // isFormValid гарантирует accountId
          account_id: formData.value.accountId!,
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

      // Mark the linked Telegram import confirmed (best-effort: the transaction
      // already exists, so a confirm failure must not fail the whole submit).
      const linkedImportId = importedId();
      if (linkedImportId && createdTransactionId.value && !importConfirmed.value) {
        try {
          await importedTransactionsApi.confirm(linkedImportId, {
            transactionId: createdTransactionId.value,
            accountId: formData.value.accountId!,
          });
          importConfirmed.value = true;
          queryClient.invalidateQueries({ queryKey: importedTransactionQueryKeys.all });
        } catch (e) {
          console.error('Failed to confirm linked import:', e);
          // Best-effort: the receipt transaction is already saved, so don't fail
          // the submit — but surface it so the import isn't silently left pending.
          toast({
            title: 'Чек сохранён',
            description: 'Но импорт остался в списке на подтверждение — проверьте инбокс.',
            variant: 'warning',
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

  const isFormValid = computed(() => {
    if (!formData.value.accountId) return false;
    // «Платил не я»: категория не нужна, но моя доля должна быть больше нуля
    if (payer.value) return myShareTotal.value > 0;
    return !!formData.value.categoryId && totalAmount.value > 0;
  });

  return {
    formData,
    payerId,
    payer,
    myShareTotal,
    participantSummaries,
    isSubmitting,
    submitError,
    isSuccess,
    isFormValid,
    handleSubmit,
  };
}
