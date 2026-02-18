// frontend/src/features/add-transaction/model/useSubmitTransaction.ts
import { ref } from 'vue';
import { transactionsApi } from '@/entities/transaction';
import { queryClient } from '@/shared/api/queryClient';
import {
  invalidateTransactionRelated,
  invalidateAccountRelated,
} from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import type { TransactionFormData } from './useTransactionForm';

export function useSubmitTransaction() {
  const { toast } = useToast();
  const isSubmitting = ref(false);
  const error = ref<string | null>(null);

  async function submit(
    userId: string,
    formData: TransactionFormData,
  ): Promise<string | null> {
    isSubmitting.value = true;
    error.value = null;

    try {
      const isTransfer = formData.type === 'transfer';
      const categoryId = isTransfer ? 'transfer' : formData.categoryId;

      const data = await transactionsApi.create({
        user_id: userId,
        account_id: formData.accountId!,
        category_id: categoryId,
        amount: formData.amount,
        currency: formData.currency,
        type: formData.type,
        description: formData.description || null,
        date: new Date(formData.date).toISOString(),
        to_account_id: isTransfer ? formData.toAccountId : null,
        to_amount: isTransfer ? formData.toAmount : null,
        to_currency: isTransfer ? formData.toCurrency : null,
      });

      await Promise.all([
        invalidateTransactionRelated(queryClient, userId),
        invalidateAccountRelated(queryClient, userId),
      ]);

      const typeLabels = {
        income: 'Доход',
        expense: 'Расход',
        transfer: 'Перевод',
      };
      toast({
        title: `${typeLabels[formData.type]} добавлен`,
        variant: 'success',
        duration: 2500,
      });

      return data.id;
    } catch (e) {
      error.value = 'Не удалось добавить транзакцию';
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить транзакцию',
        variant: 'error',
        duration: 4000,
      });
      console.error('Failed to add transaction:', e);
      return null;
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
    isSubmitting,
    error,
    submit,
  };
}
