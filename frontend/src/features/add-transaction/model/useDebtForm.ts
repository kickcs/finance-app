import { ref, computed } from 'vue';
import { useMutation } from '@tanstack/vue-query';
import { transactionsApi } from '@/entities/transaction';
import { debtsApi } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import { calendarDateToIso } from '@/shared/lib/date';
import {
  useDebtFormModel,
  debtCategoryId,
  debtTransactionType,
  buildDebtName,
  type DebtFormFields,
} from '@/entities/debt';

export type DebtFormData = DebtFormFields;

/** Создание долга поверх общей модели формы: она держит поля, здесь — запрос. */
export function useDebtForm() {
  const { toast } = useToast();
  const { fields, isValid, updateField, reset } = useDebtFormModel();
  const error = ref<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (userId: string): Promise<string> => {
      const f = fields.value;
      const accountId = f.account_id;
      if (!accountId) throw new Error('account_id is required');

      let transactionId: string | null = null;

      try {
        if (!f.skip_transaction) {
          const transaction = await transactionsApi.create({
            user_id: userId,
            account_id: accountId,
            category_id: debtCategoryId(f.debt_type),
            amount: f.amount,
            currency: f.currency,
            type: debtTransactionType(f.debt_type),
            description:
              f.description ||
              `${f.debt_type === 'given' ? 'Дал в долг' : 'Взял в долг'}: ${f.person_name}`,
            date: calendarDateToIso(f.date),
            is_debt_related: true,
          });
          transactionId = transaction.id;
        }

        // Комиссию заводит сам долг: её расход привязывается к нему, иначе
        // потом эту запись не найти и комиссию не исправить.
        const debt = await debtsApi.create({
          user_id: userId,
          name: buildDebtName(f.debt_type, f.person_name),
          total_amount: f.amount,
          remaining_amount: f.amount,
          debt_type: f.debt_type,
          person_name: f.person_name,
          account_id: accountId,
          transaction_id: transactionId,
          is_closed: false,
          currency: f.currency,
          description: f.description || null,
          is_private: f.is_private,
          next_payment_date: f.due_date,
          fee_amount: f.skip_transaction ? 0 : f.fee,
          // Выбранная дата — дата самого долга, а не только его транзакции:
          // без неё долг, заведённый задним числом, штампуется сегодняшним днём.
          created_at: calendarDateToIso(f.date),
        });

        if (transactionId) {
          await transactionsApi.update(transactionId, { debt_id: debt.id });
        }

        return debt.id;
      } catch (e) {
        if (transactionId) {
          try {
            await transactionsApi.delete(transactionId);
          } catch (rollbackError) {
            console.error('Failed to rollback debt creation:', rollbackError);
          }
        }
        throw e;
      }
    },

    onSuccess: (_, userId) => {
      invalidateDebtRelated(queryClient, userId).catch(console.error);
      const { debt_type, person_name } = fields.value;
      toast({
        title: 'Долг создан',
        description:
          debt_type === 'given'
            ? `Вы дали в долг ${person_name}`
            : `Вы взяли в долг у ${person_name}`,
        variant: 'success',
        duration: 2500,
      });
      resetForm();
    },

    onError: () => {
      error.value = 'Не удалось создать долг';
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать долг',
        variant: 'error',
        duration: 4000,
      });
    },
  });

  const isSubmitting = computed(() => mutation.isPending.value);

  async function createDebt(userId: string): Promise<string | null> {
    if (!isValid.value) {
      error.value = 'Заполните все обязательные поля';
      return null;
    }
    error.value = null;
    try {
      return await mutation.mutateAsync(userId);
    } catch {
      return null;
    }
  }

  function resetForm() {
    reset();
    error.value = null;
    mutation.reset();
  }

  return {
    formData: fields,
    isValid,
    isSubmitting,
    error,
    createDebt,
    updateField,
    resetForm,
  };
}
