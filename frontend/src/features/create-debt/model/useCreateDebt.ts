import { ref, computed } from 'vue';
import { useMutation } from '@tanstack/vue-query';
import { transactionsApi } from '@/entities/transaction';
import { debtsApi } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import { getTodayISO } from '@/shared/lib/date';
import { CATEGORY_IDS } from '@/entities/category';
import { DEFAULT_CURRENCY } from '@/entities/currency';
import type { DebtDirection } from '@/entities/debt';

export interface DebtFormData {
  debt_type: DebtDirection;
  person_name: string;
  amount: number;
  currency: string;
  account_id: string | null;
  debt_date: string | null;
  description: string;
  skipTransaction: boolean;
  is_private: boolean;
  due_date: string | null;
}

const initialFormData: DebtFormData = {
  debt_type: 'taken',
  person_name: '',
  amount: 0,
  currency: DEFAULT_CURRENCY,
  account_id: null,
  debt_date: getTodayISO(),
  description: '',
  skipTransaction: false,
  is_private: false,
  due_date: null,
};

export function useCreateDebt() {
  const { toast } = useToast();
  const formData = ref<DebtFormData>({ ...initialFormData });
  const error = ref<string | null>(null);

  const isValid = computed(() => {
    return (
      formData.value.person_name.trim().length > 0 &&
      formData.value.amount > 0 &&
      formData.value.account_id !== null &&
      formData.value.currency !== ''
    );
  });

  const mutation = useMutation({
    mutationFn: async (userId: string): Promise<string> => {
      const isGiven = formData.value.debt_type === 'given';
      const accountId = formData.value.account_id!;
      const currency = formData.value.currency;
      const categoryId = isGiven ? CATEGORY_IDS.DEBT_GIVEN : CATEGORY_IDS.DEBT_TAKEN;

      let transactionId: string | null = null;

      try {
        // 1. Create the linked transaction (backend handles balance update) — unless skipTransaction
        if (!formData.value.skipTransaction) {
          const transaction = await transactionsApi.create({
            user_id: userId,
            account_id: accountId,
            category_id: categoryId,
            amount: formData.value.amount,
            currency,
            type: isGiven ? 'expense' : 'income',
            description:
              formData.value.description ||
              `${isGiven ? 'Дал в долг' : 'Взял в долг'}: ${formData.value.person_name}`,
            date: formData.value.debt_date
              ? `${formData.value.debt_date}T12:00:00.000Z`
              : new Date().toISOString(),
            is_debt_related: true,
          });
          transactionId = transaction.id;
        }

        // 2. Create the debt record
        const debtName = `${isGiven ? 'Долг от' : 'Долг для'} ${formData.value.person_name}`;
        const debt = await debtsApi.create({
          user_id: userId,
          name: debtName,
          total_amount: formData.value.amount,
          remaining_amount: formData.value.amount,
          debt_type: formData.value.debt_type,
          person_name: formData.value.person_name,
          account_id: accountId,
          transaction_id: transactionId,
          is_closed: false,
          currency,
          description: formData.value.description || null,
          is_private: formData.value.is_private,
          next_payment_date: formData.value.due_date,
        });

        // 3. Link transaction back to debt (debt_id for reliable cleanup on deletion)
        if (transactionId) {
          await transactionsApi.update(transactionId, { debt_id: debt.id });
        }

        return debt.id;
      } catch (e) {
        // Rollback: delete transaction if it was created (backend reverses balance on delete)
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

    onSuccess: async (_, userId) => {
      await invalidateDebtRelated(queryClient, userId);
      const isGiven = formData.value.debt_type === 'given';
      toast({
        title: 'Долг создан',
        description: isGiven
          ? `Вы дали в долг ${formData.value.person_name}`
          : `Вы взяли в долг у ${formData.value.person_name}`,
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

  const isSubmitting = mutation.isPending;

  async function createDebt(userId: string): Promise<string | null> {
    if (!isValid.value || !formData.value.account_id) {
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

  function updateField<K extends keyof DebtFormData>(field: K, value: DebtFormData[K]) {
    formData.value[field] = value;
  }

  function resetForm() {
    formData.value = { ...initialFormData };
    error.value = null;
    mutation.reset();
  }

  return {
    formData,
    isValid,
    isSubmitting,
    error,
    createDebt,
    updateField,
    resetForm,
  };
}
