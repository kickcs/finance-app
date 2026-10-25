import { ref } from 'vue';
import { usePayDebt } from './usePayDebt';
import { applyDebtUpdate, buildDebtPaymentPatch, debtQueryKeys, debtsApi } from '@/entities/debt';
import { DEFAULT_CURRENCY } from '@/entities/currency';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import type { Debt } from '@/shared/api/database.types';
import { sortDebtsByDateAsc } from './sortDebts';
import { canSettleTogether, hasBothDirections, planMutualSettlement } from './mutualSettlement';

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

  const { payDebt } = usePayDebt();

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

    let offsetDone = false;
    try {
      // Летящие запросы отменяем, чтобы ответ, посланный до платежей, не
      // приземлился посреди пачки и не дёрнул список под шторкой.
      await queryClient.cancelQueries({ queryKey: debtQueryKeys.all });

      // Встречные долги сначала гасят друг друга на сервере, а платёж закрывает
      // остаток — его и показывает шторка. Кэш не трогаем до конца пачки.
      let openDebts = debts;
      let offsetDebts: Debt[] = [];
      if (hasBothDirections(debts)) {
        const personName = debts[0].person_name;
        if (!personName || !canSettleTogether(debts)) {
          throw new Error('Встречные долги сводятся только у одного человека в одной валюте');
        }
        const plan = planMutualSettlement(debts);
        const result = await debtsApi.offset(personName, debts[0].currency || DEFAULT_CURRENCY);
        offsetDone = true;
        offsetDebts = result.debts;
        const byId = new Map(offsetDebts.map((d) => [d.id, d]));
        openDebts = debts.map((d) => byId.get(d.id) ?? d).filter((d) => !d.is_closed);
        // Список на экране мог устареть: если зачёт разошёлся с показанным, остаток
        // может лежать на другой стороне, и платить по нему нельзя.
        if (
          result.offset_amount !== plan.offsetAmount ||
          openDebts.some((d) => d.debt_type !== plan.direction)
        ) {
          throw new Error('Зачёт разошёлся с долгами на экране');
        }
        progress.value += debts.length - openDebts.length;
      }

      const totalDebt = openDebts.reduce((sum, d) => sum + d.remaining_amount, 0);
      const paymentAmount = options?.paymentAmount ?? totalDebt;
      const excessAmount = Math.max(0, paymentAmount - totalDebt);
      const sorted = sortDebtsByDateAsc(openDebts);

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

      // Execute payments sequentially (same account — parallel would cause balance race conditions)
      let firstCreatedTransactionId: string | null = null;
      for (const plan of paymentPlan) {
        const success = await payDebt(plan.debt, plan.amount, selectedAccountId, userId, {
          bulk: true,
          forgiveRemainder: plan.forgive,
          excessCategoryId: plan.excessCategoryId,
          transactionDate: options?.transactionDate,
          onTransactionCreated: (id) => {
            if (!firstCreatedTransactionId) firstCreatedTransactionId = id;
          },
        });

        if (!success) {
          throw new Error(`Failed to close debt ${plan.debt.id}`);
        }

        progress.value++;
      }

      // Кэши правятся один раз и только когда пачка отработала: у платежей
      // внутри неё оптимистичная правка выключена. Применённый до цикла план
      // убирал долги из кэша на всё время запросов, и открытая шторка вместе
      // со списком за ней схлопывались в «Вы без долгов!».
      for (const debt of offsetDebts) applyDebtUpdate(queryClient, debt.id, debt);
      for (const plan of paymentPlan) {
        applyDebtUpdate(
          queryClient,
          plan.debt.id,
          buildDebtPaymentPatch(plan.debt, plan.amount, plan.forgive),
        );
      }

      if (firstCreatedTransactionId) {
        options?.onTransactionCreated?.(firstCreatedTransactionId);
      }

      // Перезапрос не ждём: кэши уже в конечном состоянии, а ожидание держало
      // бы на экране список, который вызывающий закрывает прямо сейчас.
      invalidateDebtRelated(queryClient, userId).catch(() => {});
      if (!options?.skipSuccessToast) {
        toast({ title: 'Все долги закрыты', variant: 'success' });
      }
      return true;
    } catch (e) {
      console.error('Failed to close all debts:', e);
      error.value = `Ошибка при закрытии долга ${progress.value + 1} из ${total.value}`;
      toast({
        title: offsetDone
          ? 'Зачёт проведён, остаток не закрыт'
          : (options?.errorToastTitle ?? 'Не удалось закрыть все долги'),
        variant: 'error',
      });
      // Часть платежей могла пройти, а оптимистичных правок до сюда не было —
      // откатывать нечего, состояние спрашиваем у сервера.
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
