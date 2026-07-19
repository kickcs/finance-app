import { ref } from 'vue';
import { usePartialPayment } from '@/features/partial-payment';
import {
  snapshotDebtCaches,
  restoreDebtCaches,
  applyDebtUpdate,
  buildDebtPaymentPatch,
  type DebtCacheSnapshot,
} from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import type { Debt } from '@/shared/api/database.types';
import { sortDebtsByDateAsc } from './sortDebts';

interface CloseAllOptions {
  paymentAmount?: number;
  forgiveRemainder?: boolean;
  excessCategoryId?: string;
  /** ISO-дата создаваемых транзакций (по умолчанию — сейчас). Для импорта — occurred_at. */
  transactionDate?: string;
  /** Вызывается один раз с id первой созданной транзакции (нужен confirm'у импорта). */
  onTransactionCreated?: (transactionId: string) => void;
  /** Не показывать тост «Все долги закрыты» при успехе (ошибочный тост остаётся). */
  skipSuccessToast?: boolean;
  /** Заголовок тоста ошибки (по умолчанию «Не удалось закрыть все долги»). */
  errorToastTitle?: string;
}

export function useCloseAllDebts() {
  const { toast } = useToast();
  const isClosing = ref(false);
  const error = ref<string | null>(null);
  const progress = ref(0);
  const total = ref(0);

  const { makePartialPayment } = usePartialPayment();

  async function closeAllDebts(
    debts: Debt[],
    selectedAccountId: string,
    userId: string,
    options?: CloseAllOptions,
  ): Promise<boolean> {
    if (debts.length === 0) return true;

    isClosing.value = true;
    error.value = null;
    progress.value = 0;
    total.value = debts.length;

    const totalDebt = debts.reduce((sum, d) => sum + d.remaining_amount, 0);
    const paymentAmount = options?.paymentAmount ?? totalDebt;
    const excessAmount = Math.max(0, paymentAmount - totalDebt);

    const sorted = sortDebtsByDateAsc(debts);

    let snapshot: DebtCacheSnapshot | null = null;

    try {
      // Pre-compute (debt, allocatedAmount) pairs synchronously
      let budget = paymentAmount;
      const paymentPlan: {
        debt: Debt;
        amount: number;
        forgive: boolean;
        excessCategoryId?: string;
      }[] = [];

      for (let i = 0; i < sorted.length; i++) {
        const debt = sorted[i];
        const allocated = Math.min(budget, debt.remaining_amount);
        budget -= allocated;

        // Skip debts that get nothing and aren't being forgiven
        if (allocated === 0 && !options?.forgiveRemainder) {
          progress.value++;
          continue;
        }

        // Last debt that receives payment gets the excess category
        const isLastPaidDebt = budget === 0 || i === sorted.length - 1;
        const hasExcess = isLastPaidDebt && excessAmount > 0;

        paymentPlan.push({
          debt,
          amount: allocated + (hasExcess ? excessAmount : 0),
          forgive: !!(options?.forgiveRemainder && allocated < debt.remaining_amount),
          excessCategoryId: hasExcess ? options?.excessCategoryId : undefined,
        });
      }

      // Optimistically apply the whole payment plan upfront. Per-payment
      // optimistic updates inside makePartialPayment are disabled in bulk
      // mode (skipInvalidation=true), so this is the single source of truth.
      snapshot = await snapshotDebtCaches(queryClient);
      for (const plan of paymentPlan) {
        applyDebtUpdate(
          queryClient,
          plan.debt.id,
          buildDebtPaymentPatch(plan.debt, plan.amount, plan.forgive),
        );
      }

      // Execute payments sequentially (same account — parallel would cause balance race conditions)
      let firstCreatedTransactionId: string | null = null;
      for (const plan of paymentPlan) {
        const success = await makePartialPayment(
          plan.debt,
          plan.amount,
          selectedAccountId,
          userId,
          {
            skipInvalidation: true,
            skipToast: true,
            forgiveRemainder: plan.forgive,
            excessCategoryId: plan.excessCategoryId,
            transactionDate: options?.transactionDate,
            onTransactionCreated: (id) => {
              if (!firstCreatedTransactionId) firstCreatedTransactionId = id;
            },
          },
        );

        if (!success) {
          throw new Error(`Failed to close debt ${plan.debt.id}`);
        }

        progress.value++;
      }

      if (firstCreatedTransactionId) {
        options?.onTransactionCreated?.(firstCreatedTransactionId);
      }

      await invalidateDebtRelated(queryClient, userId);
      if (!options?.skipSuccessToast) {
        toast({ title: 'Все долги закрыты', variant: 'success' });
      }
      return true;
    } catch (e) {
      console.error('Failed to close all debts:', e);
      error.value = `Ошибка при закрытии долга ${progress.value + 1} из ${total.value}`;
      toast({
        title: options?.errorToastTitle ?? 'Не удалось закрыть все долги',
        variant: 'error',
      });
      // Some payments may have succeeded — restore the snapshot, then refetch
      // the actual partial result from the server.
      if (snapshot) restoreDebtCaches(queryClient, snapshot);
      await invalidateDebtRelated(queryClient, userId).catch(() => {});
      return false;
    } finally {
      isClosing.value = false;
    }
  }

  return {
    isClosing,
    error,
    progress,
    total,
    closeAllDebts,
  };
}
