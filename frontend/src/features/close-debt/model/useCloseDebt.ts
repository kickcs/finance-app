import { ref } from 'vue';
import { transactionsApi, transactionQueryKeys } from '@/entities/transaction';
import { debtsApi, debtQueryKeys } from '@/entities/debt';
import { accountQueryKeys } from '@/entities/account';
import { queryClient } from '@/shared/api/queryClient';
import type { Debt } from '@/shared/api/database.types';

export function useCloseDebt() {
  const isClosing = ref(false);
  const isDeleting = ref(false);
  const error = ref<string | null>(null);

  /**
   * Close a debt (mark as paid)
   * Creates a reverse transaction (income for given debts, expense for taken)
   * This works for both regular and split-expense debts
   */
  async function closeDebt(debt: Debt, userId: string): Promise<boolean> {
    if (!debt.account_id) {
      error.value = 'Долг не связан со счётом';
      return false;
    }

    isClosing.value = true;
    error.value = null;

    // Use debt's own currency
    const debtCurrency = debt.currency || 'UZS';

    try {
      // For ALL debts: create reverse transaction
      // Backend automatically updates account balance when transaction is created
      const isGiven = debt.debt_type === 'given';
      const transactionType = isGiven ? 'income' : 'expense';
      const categoryId = isGiven ? 'debt_return_to_me' : 'debt_return_from_me';

      // Build description based on debt type
      const description = debt.source_transaction_id
        ? `Возврат от ${debt.person_name}: доля в общем счёте`
        : `Закрытие долга: ${debt.person_name || debt.name}`;

      // Only mark as debt-related if the original debt had a transaction that affected balance
      // (either a direct debt transaction or a linked source expense)
      // If created with "Не списывать с баланса", no transaction existed, so the return
      // should not offset expenses in stats calculations
      const hadBalanceEffect = !!(debt.transaction_id || debt.source_transaction_id);

      // 1. Create closing transaction (backend handles balance)
      const transaction = await transactionsApi.create({
        user_id: userId,
        account_id: debt.account_id,
        category_id: categoryId,
        amount: debt.remaining_amount,
        currency: debtCurrency,
        type: transactionType,
        description,
        date: new Date().toISOString(),
        is_debt_related: hadBalanceEffect,
      });

      // 2. Mark debt as closed
      await debtsApi.update(debt.id, {
        is_closed: true,
        remaining_amount: 0,
        close_transaction_id: transaction.id,
      });

      // Invalidate caches (including infinite queries and monthly stats)
      // Use resetQueries for accounts to ensure fresh data is fetched (bypasses staleTime)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(userId) }),
        queryClient.invalidateQueries({
          queryKey: transactionQueryKeys.list(userId),
        }),
        queryClient.resetQueries({ queryKey: accountQueryKeys.list(userId) }),
        // Invalidate infinite queries
        queryClient.invalidateQueries({
          queryKey: ['transactions', 'infinite', userId],
        }),
        queryClient.invalidateQueries({
          queryKey: transactionQueryKeys.infiniteByAccount(debt.account_id),
        }),
        // Invalidate monthly stats (for dashboard)
        queryClient.invalidateQueries({
          queryKey: ['transactions', 'monthly-stats'],
        }),
      ]);

      return true;
    } catch (e) {
      console.error('Failed to close debt:', e);
      error.value = 'Не удалось закрыть долг';
      return false;
    } finally {
      isClosing.value = false;
    }
  }

  /**
   * Delete a debt completely (revert original transaction and balance)
   * Used when debt was created by mistake
   */
  async function deleteDebt(debt: Debt, userId: string): Promise<boolean> {
    isDeleting.value = true;
    error.value = null;

    try {
      // 1. If there's a linked transaction (regular debt), delete it
      // Note: Backend automatically reverses balance when transaction is deleted
      if (debt.transaction_id) {
        await transactionsApi.delete(debt.transaction_id);
      }

      // 2. If there's a close transaction, delete it too
      // Note: Backend automatically reverses balance when transaction is deleted
      if (debt.close_transaction_id) {
        await transactionsApi.delete(debt.close_transaction_id);
      }

      // 3. Delete the debt
      await debtsApi.delete(debt.id);

      // 4. Invalidate caches (including infinite queries and monthly stats)
      // Use resetQueries for accounts to ensure fresh data is fetched (bypasses staleTime)
      const invalidatePromises = [
        queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(userId) }),
        queryClient.invalidateQueries({
          queryKey: transactionQueryKeys.list(userId),
        }),
        queryClient.resetQueries({ queryKey: accountQueryKeys.list(userId) }),
        // Invalidate infinite queries
        queryClient.invalidateQueries({
          queryKey: ['transactions', 'infinite', userId],
        }),
        // Invalidate monthly stats (for dashboard)
        queryClient.invalidateQueries({
          queryKey: ['transactions', 'monthly-stats'],
        }),
      ];

      // Also invalidate account-specific cache if debt had an account
      if (debt.account_id) {
        invalidatePromises.push(
          queryClient.invalidateQueries({
            queryKey: transactionQueryKeys.infiniteByAccount(debt.account_id),
          }),
        );
      }

      await Promise.all(invalidatePromises);

      return true;
    } catch (e) {
      console.error('Failed to delete debt:', e);
      error.value = 'Не удалось удалить долг';
      return false;
    } finally {
      isDeleting.value = false;
    }
  }

  return {
    isClosing,
    isDeleting,
    error,
    closeDebt,
    deleteDebt,
  };
}
