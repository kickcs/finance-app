import { ref } from 'vue';
import { usePartialPayment } from '@/features/partial-payment';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import type { Debt } from '@/shared/api/database.types';
import { sortDebtsByDateAsc } from './sortDebts';

interface CloseAllOptions {
  paymentAmount?: number;
  forgiveRemainder?: boolean;
  excessCategoryId?: string;
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

    try {
      let budget = paymentAmount;

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

        const success = await makePartialPayment(
          debt,
          allocated + (hasExcess ? excessAmount : 0),
          selectedAccountId,
          userId,
          {
            skipInvalidation: true,
            skipToast: true,
            forgiveRemainder: options?.forgiveRemainder && allocated < debt.remaining_amount,
            excessCategoryId: hasExcess ? options?.excessCategoryId : undefined,
          },
        );

        if (!success) {
          throw new Error(`Failed to close debt ${debt.id}`);
        }

        progress.value++;
      }

      await invalidateDebtRelated(queryClient, userId);
      toast({ title: 'Все долги закрыты', variant: 'success' });
      return true;
    } catch (e) {
      console.error('Failed to close all debts:', e);
      error.value = `Ошибка при закрытии долга ${progress.value + 1} из ${total.value}`;
      toast({ title: 'Не удалось закрыть все долги', variant: 'error' });
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
