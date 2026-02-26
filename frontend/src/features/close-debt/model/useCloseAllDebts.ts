import { ref } from 'vue';
import { usePartialPayment } from '@/features/partial-payment';
import { debtQueryKeys } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import type { Debt } from '@/shared/api/database.types';

export function useCloseAllDebts() {
  const isClosing = ref(false);
  const error = ref<string | null>(null);
  const progress = ref(0);
  const total = ref(0);

  const { makePartialPayment } = usePartialPayment();

  async function invalidateAll(userId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(userId) }),
      invalidateTransactionRelated(queryClient, userId),
      invalidateAccountRelated(queryClient, userId),
    ]);
  }

  async function closeAllDebts(
    debts: Debt[],
    selectedAccountId: string,
    userId: string,
  ): Promise<boolean> {
    if (debts.length === 0) return true;

    isClosing.value = true;
    error.value = null;
    progress.value = 0;
    total.value = debts.length;

    try {
      for (const debt of debts) {
        const success = await makePartialPayment(
          debt,
          debt.remaining_amount,
          selectedAccountId,
          userId,
          { skipInvalidation: true },
        );

        if (!success) {
          throw new Error(`Failed to close debt ${debt.id}`);
        }

        progress.value++;
      }

      await invalidateAll(userId);
      return true;
    } catch (e) {
      console.error('Failed to close all debts:', e);
      error.value = `Ошибка при закрытии долга ${progress.value + 1} из ${total.value}`;
      await invalidateAll(userId).catch(() => {});
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
