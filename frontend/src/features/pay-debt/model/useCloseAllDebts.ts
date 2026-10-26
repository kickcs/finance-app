import { ref } from 'vue';
import { applyDebtUpdate, debtQueryKeys, debtsApi } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { getServerErrorMessage } from '@/shared/api/http';
import { useToast } from '@/shared/ui';
import type { Debt } from '@/shared/api/database.types';
import { buildCloseAllInput, type CloseAllInputOptions } from './closeAllInput';

interface CloseAllOptions extends CloseAllInputOptions {
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

  async function closeAllDebts(
    debts: Debt[],
    selectedAccountId: string,
    userId: string,
    options?: CloseAllOptions,
  ): Promise<boolean> {
    if (debts.length === 0) return true;

    isClosing.value = true;

    try {
      // Летящие запросы отменяем, чтобы ответ списка, посланный до расчёта, не
      // приземлился поверх правки кэша и не дёрнул экран под шторкой.
      await queryClient.cancelQueries({ queryKey: debtQueryKeys.all });

      const result = await debtsApi.closeAll(buildCloseAllInput(debts, selectedAccountId, options));

      // Кэш идёт из «до» сразу в «после»: правим один раз, по ответу сервера. Правка
      // раньше ответа убирала долги из кэша, и шторка схлопывалась в «Вы без долгов!».
      for (const debt of result.debts) applyDebtUpdate(queryClient, debt.id, debt);

      const firstPaymentId = result.payment_transaction_ids[0];
      if (firstPaymentId) options?.onTransactionCreated?.(firstPaymentId);

      // Перезапрос не ждём: кэши уже в конечном состоянии, а ожидание держало
      // бы на экране список, который вызывающий закрывает прямо сейчас.
      invalidateDebtRelated(queryClient, userId).catch(() => {});
      if (!options?.skipSuccessToast) {
        toast({ title: 'Все долги закрыты', variant: 'success' });
      }
      return true;
    } catch (e) {
      console.error('Failed to close all debts:', e);
      toast({
        title: options?.errorToastTitle ?? 'Не удалось закрыть все долги',
        description: getServerErrorMessage(e),
        variant: 'error',
      });
      // Правок кэша не было; сеть могла оборвать ответ уже после записи —
      // состояние спрашиваем у сервера.
      await invalidateDebtRelated(queryClient, userId).catch(() => {});
      return false;
    } finally {
      isClosing.value = false;
    }
  }

  return {
    isClosing,
    closeAllDebts,
  };
}
