import { ref, type MaybeRefOrGetter, toValue } from 'vue';
import {
  transactionsApi,
  transactionQueryKeys,
  snapshotTransactionCaches,
  restoreTransactionCaches,
  applyTransactionUpdateToCaches,
  removeTransactionsFromCaches,
  paymentGroupIds,
  type TransactionUpdates,
} from '@/entities/transaction';
import { debtsApi } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { getServerErrorMessage } from '@/shared/api/http';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import type { Transaction } from '@/shared/api/database.types';

export function useEditTransaction(userId: MaybeRefOrGetter<string | null>) {
  const { toast } = useToast();
  const isUpdating = ref(false);
  const isDeleting = ref(false);
  const error = ref<string | null>(null);

  async function update(transaction: Transaction, updates: TransactionUpdates) {
    // Informational records (e.g. debt forgiveness) are immutable — they have no balance
    // impact and exist only as history. Editing would desync them from their source debt.
    if (transaction.is_informational) {
      error.value = 'Информационные записи нельзя редактировать';
      return false;
    }

    // Debt-related transactions cannot be edited (exclude adjustments which reuse is_debt_related as direction flag).
    // Запись расчёта сервер правит сам, запрещая только сумму и тип.
    if (
      !transaction.settlement_id &&
      transaction.is_debt_related &&
      transaction.type !== 'adjustment'
    ) {
      error.value = 'Транзакции долгов нельзя редактировать. Управляйте долгом в разделе "Долги"';
      return false;
    }

    // Transfers cannot be edited
    if (transaction.type === 'transfer') {
      error.value = 'Переводы нельзя редактировать, только удалять';
      return false;
    }

    isUpdating.value = true;
    error.value = null;

    const uid = toValue(userId) ?? '';
    // Optimistic: patch every cache holding this transaction (description/category
    // are client-known; amount/account_id also patched here for instant feedback,
    // but balances themselves are never touched — only invalidation refreshes those.
    // Иначе ответ уже летящего рефетча затрёт оптимистичную правку.
    await queryClient.cancelQueries({ queryKey: transactionQueryKeys.all });
    const snapshot = snapshotTransactionCaches(queryClient, uid);
    applyTransactionUpdateToCaches(queryClient, uid, transaction, updates);

    try {
      // Update transaction
      // Note: Backend should handle balance recalculation in production
      // Currently, amount/type changes may not update balances correctly
      await transactionsApi.update(transaction.id, updates);

      // invalidateDebtRelated covers debts + transactions + accounts
      await invalidateDebtRelated(queryClient, uid);

      toast({ title: 'Транзакция обновлена', variant: 'success' });
      return true;
    } catch (e) {
      restoreTransactionCaches(queryClient, snapshot);
      // Отменённые выше загрузки сами не возобновятся.
      void queryClient.invalidateQueries({ queryKey: transactionQueryKeys.all });
      const message = getServerErrorMessage(e) ?? 'Не удалось обновить транзакцию';
      error.value = message;
      toast({ title: message, variant: 'error' });
      console.error('Failed to update transaction:', e);
      return false;
    } finally {
      isUpdating.value = false;
    }
  }

  async function remove(transaction: Transaction) {
    // Запись расчёта по долгу сервер снимает вместе со всем расчётом и решает сам,
    // можно ли это сделать: остальные запреты ниже её не касаются.
    const isSettlementRecord = !!transaction.settlement_id;

    // Debt-related transactions cannot be deleted directly (exclude adjustments which reuse is_debt_related as direction flag)
    if (!isSettlementRecord && transaction.is_debt_related && transaction.type !== 'adjustment') {
      error.value = 'Транзакции долгов нельзя удалять. Удалите долг в разделе "Долги"';
      return false;
    }

    isDeleting.value = true;
    error.value = null;

    // Check if there are OPEN split debts linked to this transaction
    // Closed debts are OK - the transaction amount already reflects payments
    if (!isSettlementRecord) {
      try {
        const allDebts = await debtsApi.getAll();
        // Оплата с двух счетов удаляется целиком — долги проверяем у обеих частей.
        const groupIds = paymentGroupIds(transaction);
        const linkedDebts = allDebts.filter(
          (d) =>
            d.source_transaction_id && groupIds.includes(d.source_transaction_id) && !d.is_closed,
        );

        if (linkedDebts.length > 0) {
          error.value =
            'Нельзя удалить транзакцию с открытыми долгами. Сначала закройте или удалите связанные долги';
          isDeleting.value = false;
          return false;
        }
      } catch {
        // Ignore check error, continue with deletion
      }
    }

    const uid = toValue(userId) ?? '';
    // Optimistic removal from every list; balance is only ever corrected via invalidation below.
    // Иначе ответ уже летящего рефетча затрёт оптимистичную правку.
    // У записи расчёта строку не убираем: вместе с ней уйдут и остальные записи
    // расчёта, а какие именно — знает только сервер; список обновит инвалидация.
    let snapshot: ReturnType<typeof snapshotTransactionCaches> | null = null;
    if (!isSettlementRecord) {
      await queryClient.cancelQueries({ queryKey: transactionQueryKeys.all });
      snapshot = snapshotTransactionCaches(queryClient, uid);
      removeTransactionsFromCaches(queryClient, uid, paymentGroupIds(transaction));
    }

    try {
      // Delete transaction
      // Note: Backend automatically reverses account balance when deleting
      await transactionsApi.delete(transaction.id);

      // invalidateDebtRelated covers debts + transactions + accounts
      await invalidateDebtRelated(queryClient, uid);

      toast({ title: 'Транзакция удалена', variant: 'success' });
      return true;
    } catch (e: unknown) {
      if (snapshot) {
        restoreTransactionCaches(queryClient, snapshot);
        // Отменённые выше загрузки сами не возобновятся.
        void queryClient.invalidateQueries({ queryKey: transactionQueryKeys.all });
      }
      // Бэкенд объясняет отказ сам: открытые долги, более поздний расчёт и т. п.
      const message = getServerErrorMessage(e);
      if (message) {
        error.value = message;
        toast({ title: message, variant: 'error' });
        return false;
      }
      error.value = 'Не удалось удалить транзакцию';
      toast({ title: 'Не удалось удалить транзакцию', variant: 'error' });
      console.error('Failed to delete transaction:', e);
      return false;
    } finally {
      isDeleting.value = false;
    }
  }

  return {
    isUpdating,
    isDeleting,
    error,
    update,
    remove,
  };
}
