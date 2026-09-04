import { ref, toValue, type MaybeRefOrGetter } from 'vue';
import { useAccounts } from '@/entities/account';
import { transactionsApi } from '@/entities/transaction';
import { useProfile } from '@/shared/api';
import type { Account } from '@/shared/api/database.types';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';

const CONVERSION_DESCRIPTION = 'Перевод счёта в кредитную карту';
// Копейки в целевом балансе не повод дёргать корректировку.
const BALANCE_EPSILON = 0.001;

export function useEditAccount(userId: MaybeRefOrGetter<string | null>) {
  const { toast } = useToast();
  const { updateAccount, deleteAccount, getAccountById } = useAccounts(userId);
  const { defaultAccountId } = useProfile(userId);

  const isUpdating = ref(false);
  const isDeleting = ref(false);
  const error = ref<string | null>(null);

  /**
   * Порядок «сначала PATCH, потом корректировка» намеренный: если упадёт второй
   * шаг, у пользователя останется кредитка со старым балансом и кнопка
   * «Скорректировать баланс» на экране. Обратный порядок оставил бы обычный
   * счёт в минусе.
   */
  async function update(
    accountId: string,
    updates: Partial<Account>,
    options?: { debtByCurrency?: Record<string, number> },
  ) {
    isUpdating.value = true;
    error.value = null;

    try {
      try {
        await updateAccount(accountId, updates);
      } catch (e) {
        error.value = 'Не удалось обновить счёт';
        toast({ title: 'Не удалось обновить счёт', variant: 'error' });
        console.error('Failed to update account:', e);
        return false;
      }

      const debts = options?.debtByCurrency;
      if (debts && Object.keys(debts).length > 0) {
        const current = getAccountById(accountId);
        try {
          for (const [currency, debt] of Object.entries(debts)) {
            const target = -debt;
            const balance = current?.balances.find((b) => b.currency === currency)?.balance ?? 0;
            if (Math.abs(target - balance) <= BALANCE_EPSILON) continue;
            await transactionsApi.adjustBalance({
              accountId,
              targetBalance: target,
              currency,
              description: CONVERSION_DESCRIPTION,
            });
          }
          const uid = toValue(userId) ?? '';
          await Promise.all([
            invalidateAccountRelated(queryClient, uid),
            invalidateTransactionRelated(queryClient, uid),
          ]);
        } catch (e) {
          console.error('Failed to adjust balance after conversion:', e);
          toast({
            title: 'Счёт переведён, но баланс не скорректирован',
            description: 'Поправьте его кнопкой «Скорректировать баланс» на экране счёта',
            variant: 'warning',
          });
          return true;
        }
      }

      toast({ title: 'Счёт обновлён', variant: 'success' });
      return true;
    } finally {
      isUpdating.value = false;
    }
  }

  async function remove(accountId: string) {
    // Check if this is the default account
    if (defaultAccountId.value === accountId) {
      error.value = 'Нельзя удалить счёт по умолчанию. Сначала назначьте другой счёт по умолчанию.';
      return false;
    }

    isDeleting.value = true;
    error.value = null;

    try {
      await deleteAccount(accountId);
      // Invalidate all related caches (accounts, balances, transactions, monthly stats)
      const uid = toValue(userId) ?? '';
      await Promise.all([
        invalidateAccountRelated(queryClient, uid),
        invalidateTransactionRelated(queryClient, uid),
      ]);
      toast({ title: 'Счёт удалён', variant: 'success' });
      return true;
    } catch (e) {
      error.value = 'Не удалось удалить счёт';
      toast({ title: 'Не удалось удалить счёт', variant: 'error' });
      console.error('Failed to delete account:', e);
      return false;
    } finally {
      isDeleting.value = false;
    }
  }

  // Check if account is the default one
  function isDefaultAccount(accountId: string): boolean {
    return defaultAccountId.value === accountId;
  }

  return {
    isUpdating,
    isDeleting,
    error,
    update,
    remove,
    isDefaultAccount,
  };
}
