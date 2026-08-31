import { ref } from 'vue';
import {
  debtsApi,
  snapshotDebtCaches,
  restoreDebtCaches,
  applyDebtUpdate,
  buildDebtPaymentPatch,
} from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { HttpError } from '@/shared/api/http';
import { useToast } from '@/shared/ui';
import type { Debt } from '@/shared/api/database.types';

export interface PayDebtOptions {
  forgiveRemainder?: boolean;
  excessCategoryId?: string;
  /** ISO-дата создаваемых записей (по умолчанию — сейчас). Для импорта — occurred_at. */
  transactionDate?: string;
  /** Отдаёт id записи платежа (нужен confirm'у импорта). */
  onTransactionCreated?: (transactionId: string) => void;
  /**
   * Пачка платежей: кэши синхронизирует вызывающий, один раз в конце, вместо
   * перезапроса истории и балансов после каждого долга.
   */
  bulk?: boolean;
}

/**
 * Платёж по долгу.
 *
 * Раньше здесь жило правило долга: клиент сам считал новый остаток, решал,
 * закрылся ли долг, и слал четыре запроса подряд — упал третий, и в истории
 * оставался возврат по долгу, который цел. Теперь это один POST, а всю
 * арифметику и записи делает сервер в одной транзакции БД.
 */
export function usePayDebt() {
  const { toast } = useToast();
  const isPaying = ref(false);
  const error = ref<string | null>(null);

  async function payDebt(
    debt: Debt,
    paymentAmount: number,
    selectedAccountId: string,
    userId: string,
    options?: PayDebtOptions,
  ): Promise<boolean> {
    // Те же проверки есть на сервере, но здесь они пишут сообщение в форму —
    // пользователю нужен текст под полем, а не тост про 400.
    if (paymentAmount < 0 || (paymentAmount === 0 && !options?.forgiveRemainder)) {
      error.value = 'Некорректная сумма платежа';
      return false;
    }
    if (paymentAmount > debt.remaining_amount && !options?.excessCategoryId) {
      error.value = 'Выберите категорию для переплаты';
      return false;
    }

    isPaying.value = true;
    error.value = null;

    // Шторка закрывается до ответа сервера, поэтому остаток на экране должен
    // измениться сразу. В пачке план целиком применяет вызывающий.
    const snapshot = options?.bulk ? null : await snapshotDebtCaches(queryClient);
    if (!options?.bulk) {
      applyDebtUpdate(
        queryClient,
        debt.id,
        buildDebtPaymentPatch(debt, paymentAmount, !!options?.forgiveRemainder),
      );
    }

    try {
      const result = await debtsApi.pay(debt.id, {
        amount: paymentAmount,
        accountId: selectedAccountId,
        date: options?.transactionDate,
        forgiveRemainder: options?.forgiveRemainder,
        excessCategoryId: options?.excessCategoryId,
      });

      applyDebtUpdate(queryClient, debt.id, result.debt);
      if (result.payment_transaction_id) {
        options?.onTransactionCreated?.(result.payment_transaction_id);
      }

      if (!options?.bulk) {
        await invalidateDebtRelated(queryClient, userId);
        toast({ title: 'Платёж проведён', variant: 'success' });
      }
      return true;
    } catch (e) {
      if (snapshot) restoreDebtCaches(queryClient, snapshot);

      // Кто-то закрыл долг раньше — платёж не нужен, а не провалился.
      if (e instanceof HttpError && e.status === 409) {
        await invalidateDebtRelated(queryClient, userId).catch(() => {});
        if (!options?.bulk) toast({ title: 'Долг уже закрыт', variant: 'default' });
        return true;
      }

      // Запись могла долететь до сервера: перезапрашиваем реальное состояние,
      // а не делаем вид, что платежа не было.
      await invalidateDebtRelated(queryClient, userId).catch(() => {});
      console.error('Failed to pay debt:', e);
      error.value = 'Не удалось внести платёж';
      if (!options?.bulk) toast({ title: 'Не удалось внести платёж', variant: 'error' });
      return false;
    } finally {
      isPaying.value = false;
    }
  }

  return { isPaying, error, payDebt };
}
