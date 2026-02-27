import { ref } from 'vue';
import { transactionsApi } from '@/entities/transaction';
import { debtsApi, debtQueryKeys } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import type { Debt } from '@/shared/api/database.types';

interface PartialPaymentOptions {
  skipInvalidation?: boolean;
  forgiveRemainder?: boolean;
  excessCategoryId?: string;
}

export function usePartialPayment() {
  const isPaying = ref(false);
  const error = ref<string | null>(null);

  async function makePartialPayment(
    debt: Debt,
    paymentAmount: number,
    selectedAccountId: string,
    userId: string,
    options?: PartialPaymentOptions,
  ): Promise<boolean> {
    if (paymentAmount < 0) {
      error.value = 'Некорректная сумма платежа';
      return false;
    }

    if (paymentAmount === 0 && !options?.forgiveRemainder) {
      error.value = 'Некорректная сумма платежа';
      return false;
    }

    const excess = paymentAmount - debt.remaining_amount;
    const isOverpayment = excess > 0;
    if (isOverpayment && !options?.excessCategoryId) {
      error.value = 'Выберите категорию для переплаты';
      return false;
    }

    isPaying.value = true;
    error.value = null;

    const debtCurrency = debt.currency || 'UZS';

    try {
      const isGiven = debt.debt_type === 'given';
      const transactionType = isGiven ? 'income' : 'expense';
      const categoryId = isGiven ? 'debt_return_to_me' : 'debt_return_from_me';
      const hadBalanceEffect = !!debt.transaction_id || !!debt.source_transaction_id;

      const actualPayment = isOverpayment ? debt.remaining_amount : paymentAmount;

      let closeTransactionId: string | undefined;

      // 1. Create debt return transaction (if there's an actual payment)
      if (actualPayment > 0) {
        const isClosed = actualPayment >= debt.remaining_amount || !!options?.forgiveRemainder;

        let description: string;
        if (isClosed && debt.source_transaction_id) {
          description = `Возврат от ${debt.person_name}: доля в общем счёте`;
        } else if (isClosed) {
          description = `Закрытие долга: ${debt.person_name || debt.name}`;
        } else {
          description = `Частичный платёж: ${debt.person_name || debt.name}`;
        }

        const transaction = await transactionsApi.create({
          user_id: userId,
          account_id: selectedAccountId,
          category_id: categoryId,
          amount: actualPayment,
          currency: debtCurrency,
          type: transactionType,
          description,
          date: new Date().toISOString(),
          is_debt_related: hadBalanceEffect,
          debt_id: debt.id,
        });

        closeTransactionId = transaction.id;
      }

      // 2. Create excess income transaction (overpayment bonus)
      if (isOverpayment && options?.excessCategoryId) {
        const excessType = isGiven ? 'income' : 'expense';
        await transactionsApi.create({
          user_id: userId,
          account_id: selectedAccountId,
          category_id: options.excessCategoryId,
          amount: excess,
          currency: debtCurrency,
          type: excessType,
          description: `Переплата по долгу: ${debt.person_name || debt.name}`,
          date: new Date().toISOString(),
          is_debt_related: false,
        });
      }

      // 3. Create forgiveness expense transaction (gift)
      if (options?.forgiveRemainder) {
        const forgivenAmount = debt.remaining_amount - actualPayment;
        if (forgivenAmount > 0) {
          const giftType = isGiven ? 'expense' : 'income';
          const giftCategoryId = isGiven ? 'gifts' : 'gifts_income';
          const tx = await transactionsApi.create({
            user_id: userId,
            account_id: selectedAccountId,
            category_id: giftCategoryId,
            amount: forgivenAmount,
            currency: debtCurrency,
            type: giftType,
            description: `Прощение долга: ${debt.person_name || debt.name}`,
            date: new Date().toISOString(),
            is_debt_related: false,
          });

          if (!closeTransactionId) {
            closeTransactionId = tx.id;
          }
        }
      }

      // 4. Update debt
      const newRemaining = debt.remaining_amount - actualPayment;
      const willClose = isOverpayment || options?.forgiveRemainder || newRemaining <= 0;

      await debtsApi.update(debt.id, {
        remaining_amount: willClose ? 0 : Math.max(0, newRemaining),
        is_closed: !!willClose,
        ...(willClose && closeTransactionId ? { close_transaction_id: closeTransactionId } : {}),
      });

      if (!options?.skipInvalidation) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(userId) }),
          invalidateTransactionRelated(queryClient, userId),
          invalidateAccountRelated(queryClient, userId),
        ]);
      }

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
