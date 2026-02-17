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
   * Make partial payment on a debt
   * - For split expense debts: reduces the source transaction amount
   * - For regular debts: creates income/expense transaction
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
      // Check if this is a split expense debt
      if (debt.source_transaction_id) {
        // Split expense debt: reduce the source transaction amount

        // 1. Get the source transaction
        const transactions = await transactionsApi.getAll(userId);
        const sourceTx = transactions.find(
          (tx) => tx.id === debt.source_transaction_id,
        );

        if (!sourceTx) throw new Error('Source transaction not found');

        // 2. Reduce the source transaction amount by payment amount
        // Note: Backend transaction update doesn't auto-recalculate balances
        // This may need backend enhancement for proper balance handling
        const newAmount = sourceTx.amount - paymentAmount;
        await transactionsApi.update(debt.source_transaction_id, {
          amount: newAmount,
        });

        // 3. Update debt remaining amount
        const newRemaining = debt.remaining_amount - paymentAmount;
        const isClosed = newRemaining <= 0;

        await debtsApi.update(debt.id, {
          remaining_amount: Math.max(0, newRemaining),
          is_closed: isClosed,
        });
      } else {
        // Regular debt: create transaction
        // Note: Backend automatically updates account balance when transaction is created
        const isGiven = debt.debt_type === 'given';
        const transactionType = isGiven ? 'income' : 'expense';
        const categoryId = isGiven
          ? 'debt_return_to_me'
          : 'debt_return_from_me';

        // Only mark as debt-related if the original debt had a balance-affecting transaction
        const hadBalanceEffect = !!debt.transaction_id;

        // 1. Create partial payment transaction (backend handles balance)
        await transactionsApi.create({
          user_id: userId,
          account_id: selectedAccountId,
          category_id: categoryId,
          amount: paymentAmount,
          currency: debtCurrency,
          type: transactionType,
          description: `Частичный платёж: ${debt.person_name || debt.name}`,
          date: new Date().toISOString(),
          is_debt_related: hadBalanceEffect,
        });

        // 2. Update debt remaining amount
        const newRemaining = debt.remaining_amount - paymentAmount;
        const isClosed = newRemaining <= 0;

        await debtsApi.update(debt.id, {
          remaining_amount: Math.max(0, newRemaining),
          is_closed: isClosed,
        });
      }

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
