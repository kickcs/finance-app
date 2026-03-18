import { ref } from 'vue';
import { transactionsApi } from '@/entities/transaction';
import { debtsApi, getDebtDisplayName } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import { CATEGORY_IDS } from '@/entities/category';
import { DEFAULT_CURRENCY } from '@/entities/currency';
import type { Debt } from '@/shared/api/database.types';

interface PartialPaymentOptions {
  skipInvalidation?: boolean;
  skipToast?: boolean;
  forgiveRemainder?: boolean;
  excessCategoryId?: string;
}

export function usePartialPayment() {
  const { toast } = useToast();
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

    // Pre-check overpayment for validation (recomputed after fresh fetch)
    const preCheckExcess = paymentAmount - debt.remaining_amount;
    if (preCheckExcess > 0 && !options?.excessCategoryId) {
      error.value = 'Выберите категорию для переплаты';
      return false;
    }

    isPaying.value = true;
    error.value = null;

    const debtCurrency = debt.currency || DEFAULT_CURRENCY;

    try {
      // In single-payment mode, re-fetch debt to prevent stale cache double-close.
      // Skipped in bulk mode (skipInvalidation=true) where caller manages freshness.
      let effectiveDebt = debt;
      if (!options?.skipInvalidation) {
        const freshDebt = await debtsApi.getById(debt.id);
        if (freshDebt?.is_closed) {
          await invalidateDebtRelated(queryClient, userId);
          if (!options?.skipToast) toast({ title: 'Долг уже закрыт', variant: 'default' });
          return true;
        }
        // Use fresh remaining_amount if available
        if (freshDebt) {
          effectiveDebt = { ...debt, remaining_amount: freshDebt.remaining_amount };
        }
      }

      // Recompute against fresh remaining_amount
      const excess = paymentAmount - effectiveDebt.remaining_amount;
      const isOverpayment = excess > 0;

      const isGiven = effectiveDebt.debt_type === 'given';
      const transactionType = isGiven ? 'income' : 'expense';
      const categoryId = isGiven
        ? CATEGORY_IDS.DEBT_RETURN_TO_ME
        : CATEGORY_IDS.DEBT_RETURN_FROM_ME;
      const hadBalanceEffect =
        !!effectiveDebt.transaction_id || !!effectiveDebt.source_transaction_id;

      const actualPayment = isOverpayment ? effectiveDebt.remaining_amount : paymentAmount;

      let closeTransactionId: string | undefined;

      // 1. Create debt return transaction (if there's an actual payment)
      if (actualPayment > 0) {
        const isClosed =
          actualPayment >= effectiveDebt.remaining_amount || !!options?.forgiveRemainder;

        let description: string;
        if (isClosed && effectiveDebt.source_transaction_id) {
          description = `Возврат от ${getDebtDisplayName(effectiveDebt)}: доля в общем счёте`;
        } else if (isClosed) {
          description = `Закрытие долга: ${getDebtDisplayName(effectiveDebt)}`;
        } else {
          description = `Частичный платёж: ${getDebtDisplayName(effectiveDebt)}`;
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
          debt_id: effectiveDebt.id,
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
          description: `Переплата по долгу: ${getDebtDisplayName(effectiveDebt)}`,
          date: new Date().toISOString(),
          is_debt_related: false,
        });
      }

      // Remaining amount after payment (also used as forgiven amount when forgiving)
      const remainingAfterPayment = effectiveDebt.remaining_amount - actualPayment;

      // 3. Create forgiveness expense transaction (gift)
      // Only create balance-affecting forgiveness when debt has no source transaction,
      // otherwise the money was already accounted for in the original expense
      if (options?.forgiveRemainder) {
        if (remainingAfterPayment > 0 && !hadBalanceEffect) {
          const giftType = isGiven ? 'expense' : 'income';
          const giftCategoryId = isGiven ? CATEGORY_IDS.GIFTS : CATEGORY_IDS.GIFTS_INCOME;
          const tx = await transactionsApi.create({
            user_id: userId,
            account_id: selectedAccountId,
            category_id: giftCategoryId,
            amount: remainingAfterPayment,
            currency: debtCurrency,
            type: giftType,
            description: `Прощение долга: ${getDebtDisplayName(effectiveDebt)}`,
            date: new Date().toISOString(),
            is_debt_related: false,
          });

          if (!closeTransactionId) {
            closeTransactionId = tx.id;
          }
        }
      }

      // 4. Update debt
      const newRemaining = remainingAfterPayment;
      const willClose = isOverpayment || options?.forgiveRemainder || newRemaining <= 0;

      await debtsApi.update(effectiveDebt.id, {
        remaining_amount: willClose ? 0 : Math.max(0, newRemaining),
        is_closed: !!willClose,
        ...(willClose && closeTransactionId ? { close_transaction_id: closeTransactionId } : {}),
        ...(options?.forgiveRemainder
          ? {
              forgiven_amount: remainingAfterPayment,
            }
          : {}),
      });

      if (!options?.skipInvalidation) {
        await invalidateDebtRelated(queryClient, userId);
      }

      if (!options?.skipToast) toast({ title: 'Платёж проведён', variant: 'success' });
      return true;
    } catch (e) {
      console.error('Failed to make partial payment:', e);
      error.value = 'Не удалось внести платёж';
      if (!options?.skipToast) toast({ title: 'Не удалось внести платёж', variant: 'error' });
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
