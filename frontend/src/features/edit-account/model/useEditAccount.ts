import { ref, toValue, type MaybeRefOrGetter } from 'vue';
import { useAccounts, conversionTargetBalance } from '@/entities/account';
import { transactionsApi } from '@/entities/transaction';
import { useProfile } from '@/shared/api';
import type { Account } from '@/shared/api/database.types';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';

const CONVERSION_DESCRIPTION = 'Перевод счёта в кредитную карту';

// ValidationPipe отдаёт `message` списком, обычные 400 — строкой.
function serverValidationMessage(e: unknown): string | undefined {
  if (!e || typeof e !== 'object' || !('status' in e) || !('data' in e)) return undefined;
  const httpError = e as { status: number; data?: { message?: string | string[] } };
  if (httpError.status !== 400) return undefined;
  const message = httpError.data?.message;
  if (Array.isArray(message)) return message.join('. ') || undefined;
  return message || undefined;
}

export function useEditAccount(userId: MaybeRefOrGetter<string | null>) {
  const { toast } = useToast();
  const { updateAccount, deleteAccount, getAccountById } = useAccounts(userId);
  const { defaultAccountId } = useProfile(userId);

  const isUpdating = ref(false);
  const isDeleting = ref(false);
  const error = ref<string | null>(null);

  // Сначала PATCH, потом корректировка: при сбое второго шага остаётся кредитка
  // со старым балансом и кнопкой «Скорректировать», а не обычный счёт в минусе.
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
        toast({
          title: 'Не удалось обновить счёт',
          description: serverValidationMessage(e),
          variant: 'error',
        });
        console.error('Failed to update account:', e);
        return false;
      }

      const debts = options?.debtByCurrency;
      if (debts && Object.keys(debts).length > 0) {
        // Балансы из кэша — только эвристика пропуска: дельту сервер считает сам.
        const current = getAccountById(accountId);
        let attempted = false;
        try {
          for (const [currency, debt] of Object.entries(debts)) {
            const balance = current?.balances.find((b) => b.currency === currency)?.balance ?? 0;
            const target = conversionTargetBalance(balance, debt);
            if (target === null) continue;
            attempted = true;
            await transactionsApi.adjustBalance({
              accountId,
              targetBalance: target,
              currency,
              description: CONVERSION_DESCRIPTION,
            });
          }
        } catch (e) {
          console.error('Failed to adjust balance after conversion:', e);
          toast({
            title: 'Счёт переведён, но баланс не скорректирован',
            description: 'Поправьте его кнопкой «Скорректировать баланс» на экране счёта',
            variant: 'warning',
          });
          return true;
        } finally {
          // Даже оборванная на полпути серия записей делает кэш устаревшим.
          if (attempted) {
            const uid = toValue(userId) ?? '';
            await Promise.all([
              invalidateAccountRelated(queryClient, uid),
              invalidateTransactionRelated(queryClient, uid),
            ]);
          }
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
