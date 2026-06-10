import { ref } from 'vue';
import { transactionsApi } from '@/entities/transaction';
import {
  debtsApi,
  getDebtDisplayName,
  snapshotDebtCaches,
  restoreDebtCaches,
  applyDebtUpdate,
  buildDebtPaymentPatch,
  type DebtCacheSnapshot,
} from '@/entities/debt';
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

    // Optimistically apply the expected end state of the debt before the
    // multi-step API flow. Skipped in bulk mode (skipInvalidation=true) —
    // useCloseAllDebts applies the whole payment plan upfront itself.
    let snapshot: DebtCacheSnapshot | null = null;
    if (!options?.skipInvalidation) {
      snapshot = await snapshotDebtCaches(queryClient);
      applyDebtUpdate(
        queryClient,
        debt.id,
        buildDebtPaymentPatch(debt, paymentAmount, !!options?.forgiveRemainder),
      );
    }

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
          // The optimistic patch above was built from the (possibly stale)
          // cached debt — re-apply it with the fresh remaining amount
          if (snapshot && freshDebt.remaining_amount !== debt.remaining_amount) {
            applyDebtUpdate(
              queryClient,
              debt.id,
              buildDebtPaymentPatch(effectiveDebt, paymentAmount, !!options?.forgiveRemainder),
            );
          }
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

      // 3. Create an informational forgiveness record (visible in feed, ignored by balance/analytics).
      // Always created when there's a remainder to forgive — even when the original debt expense
      // already moved money, because the user needs to see the forgiveness event in their history.
      if (options?.forgiveRemainder && remainingAfterPayment > 0) {
        const forgivenType = isGiven ? 'expense' : 'income';
        const forgivenPayload = {
          user_id: userId,
          category_id: CATEGORY_IDS.DEBT_FORGIVEN,
          amount: remainingAfterPayment,
          currency: debtCurrency,
          type: forgivenType,
          description: `Прощение долга: ${getDebtDisplayName(effectiveDebt)}`,
          date: new Date().toISOString(),
          is_debt_related: false,
          is_informational: true,
          debt_id: effectiveDebt.id,
        } as const;

        // debts.account_id has no FK in the DB — it can dangle if the account was deleted.
        // We prefer debt.account_id (history accuracy) but retry on selectedAccountId if
        // the first POST fails on a 404/403, so the partial-payment flow does not end up
        // half-committed (payment-tx saved, debt not updated).
        const primaryAccountId = effectiveDebt.account_id ?? selectedAccountId;
        let tx: Awaited<ReturnType<typeof transactionsApi.create>>;
        try {
          tx = await transactionsApi.create({ ...forgivenPayload, account_id: primaryAccountId });
        } catch (forgiveErr: unknown) {
          const status = (forgiveErr as { status?: number } | null)?.status;
          const isAccountIssue = status === 404 || status === 403;
          if (!isAccountIssue || !selectedAccountId || selectedAccountId === primaryAccountId) {
            throw forgiveErr;
          }
          tx = await transactionsApi.create({
            ...forgivenPayload,
            account_id: selectedAccountId,
          });
        }

        if (!closeTransactionId) {
          closeTransactionId = tx.id;
        }
      }

      // 4. Update debt
      const willClose = isOverpayment || options?.forgiveRemainder || remainingAfterPayment <= 0;

      await debtsApi.update(effectiveDebt.id, {
        remaining_amount: willClose ? 0 : Math.max(0, remainingAfterPayment),
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
      if (snapshot) restoreDebtCaches(queryClient, snapshot);
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
