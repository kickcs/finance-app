import { ref } from 'vue';
import { transactionsApi } from '@/entities/transaction';
import { debtsApi, debtQueryKeys } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import type { Debt } from '@/shared/api/database.types';

export function usePartialPayment() {
  const isPaying = ref(false);
  const error = ref<string | null>(null);

  /**
   * Make partial payment on a debt.
   * Unified logic for all debt types (regular and split-expense):
   * creates income/expense transaction on the selected account.
   */
  async function makePartialPayment(
    debt: Debt,
    paymentAmount: number,
    selectedAccountId: string,
    userId: string,
  ): Promise<boolean> {
    if (paymentAmount <= 0 || paymentAmount > debt.remaining_amount) {
      error.value = 'Некорректная сумма платежа';
      return false;
    }

    isPaying.value = true;
    error.value = null;

    const debtCurrency = debt.currency || 'UZS';

    try {
      const isGiven = debt.debt_type === 'given';
      const transactionType = isGiven ? 'income' : 'expense';
      const categoryId = isGiven ? 'debt_return_to_me' : 'debt_return_from_me';

      // Mark as debt-related if the original debt had a balance-affecting transaction
      const hadBalanceEffect = !!debt.transaction_id || !!debt.source_transaction_id;

      const newRemaining = debt.remaining_amount - paymentAmount;
      const isClosed = newRemaining <= 0;

      // Build description based on context
      let description: string;
      if (isClosed && debt.source_transaction_id) {
        description = `Возврат от ${debt.person_name}: доля в общем счёте`;
      } else if (isClosed) {
        description = `Закрытие долга: ${debt.person_name || debt.name}`;
      } else {
        description = `Частичный платёж: ${debt.person_name || debt.name}`;
      }

      // 1. Create payment transaction (backend handles balance)
      const transaction = await transactionsApi.create({
        user_id: userId,
        account_id: selectedAccountId,
        category_id: categoryId,
        amount: paymentAmount,
        currency: debtCurrency,
        type: transactionType,
        description,
        date: new Date().toISOString(),
        is_debt_related: hadBalanceEffect,
      });

      // 2. Update debt remaining amount (and save close_transaction_id if fully closed)
      await debtsApi.update(debt.id, {
        remaining_amount: Math.max(0, newRemaining),
        is_closed: isClosed,
        ...(isClosed ? { close_transaction_id: transaction.id } : {}),
      });

      // Invalidate caches
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(userId) }),
        invalidateTransactionRelated(queryClient, userId),
        invalidateAccountRelated(queryClient, userId),
      ]);

      return true;
    } catch (e) {
      console.error('Failed to make partial payment:', e);
      error.value = 'Не удалось внести платёж';
      return false;
    } finally {
      isPaying.value = false;
    }
  }

  return {
    isPaying,
    error,
    makePartialPayment,
  };
}
