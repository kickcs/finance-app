import { ref, computed } from 'vue';
import { transactionsApi } from '@/entities/transaction';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';

export interface TransactionFormData {
  accountId: string | null;
  categoryId: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  date: number;
  // Transfer-specific fields
  toAccountId: string | null;
  toAmount: number | null;
  toCurrency: string | null;
}

export function useAddTransaction() {
  const { toast } = useToast();

  const formData = ref<TransactionFormData>({
    accountId: null,
    categoryId: '',
    amount: 0,
    currency: 'UZS',
    type: 'expense',
    description: '',
    date: Date.now(),
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
  });

  const isValid = computed(() => {
    const base =
      formData.value.accountId !== null &&
      formData.value.amount > 0 &&
      formData.value.currency !== '';

    if (formData.value.type === 'transfer') {
      return (
        base &&
        formData.value.toAccountId !== null &&
        // Allow same account if currencies are different (currency conversion)
        (formData.value.toAccountId !== formData.value.accountId ||
          formData.value.currency !== formData.value.toCurrency) &&
        formData.value.toCurrency !== null &&
        formData.value.toAmount !== null &&
        formData.value.toAmount > 0
      );
    }

    return base && formData.value.categoryId !== '';
  });

  const isSubmitting = ref(false);
  const error = ref<string | null>(null);

  async function addTransaction(userId: string) {
    if (!isValid.value || !formData.value.accountId) {
      error.value = 'Заполните все обязательные поля';
      return null;
    }

    isSubmitting.value = true;
    error.value = null;

    try {
      const isTransfer = formData.value.type === 'transfer';
      const categoryId = isTransfer ? 'transfer' : formData.value.categoryId;

      // Create transaction via API
      // Note: Backend automatically updates account balances when transaction is created
      const data = await transactionsApi.create({
        user_id: userId,
        account_id: formData.value.accountId,
        category_id: categoryId,
        amount: formData.value.amount,
        currency: formData.value.currency,
        type: formData.value.type,
        description: formData.value.description || null,
        date: new Date(formData.value.date).toISOString(),
        to_account_id: isTransfer ? formData.value.toAccountId : null,
        to_amount: isTransfer ? formData.value.toAmount : null,
        to_currency: isTransfer ? formData.value.toCurrency : null,
      });

      // Invalidate all related caches
      await Promise.all([
        invalidateTransactionRelated(queryClient, userId),
        invalidateAccountRelated(queryClient, userId),
      ]);

      // Show success toast
      const typeLabels = {
        income: 'Доход',
        expense: 'Расход',
        transfer: 'Перевод',
      };
      toast({
        title: `${typeLabels[formData.value.type]} добавлен`,
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

  function updateField<K extends keyof TransactionFormData>(
    field: K,
    value: TransactionFormData[K],
  ) {
    formData.value[field] = value;
  }

  function setType(type: 'income' | 'expense' | 'transfer') {
    formData.value.type = type;
    formData.value.categoryId = type === 'transfer' ? 'transfer' : '';
    // Reset transfer fields when changing type
    if (type !== 'transfer') {
      formData.value.toAccountId = null;
      formData.value.toAmount = null;
      formData.value.toCurrency = null;
    }
  }

  function setCurrency(currency: string) {
    formData.value.currency = currency;
  }

  function setTransferTarget(toAccountId: string, toCurrency: string) {
    formData.value.toAccountId = toAccountId;
    formData.value.toCurrency = toCurrency;
    // Default to same amount if currencies match
    if (formData.value.currency === toCurrency) {
      formData.value.toAmount = formData.value.amount;
    }
  }

  function setToAmount(amount: number) {
    formData.value.toAmount = amount;
  }

  function resetForm() {
    formData.value = {
      accountId: null,
      categoryId: '',
      amount: 0,
      currency: 'UZS',
      type: 'expense',
      description: '',
      date: Date.now(),
      toAccountId: null,
      toAmount: null,
      toCurrency: null,
    };
    error.value = null;
  }

  return {
    formData,
    isValid,
    isSubmitting,
    error,
    addTransaction,
    updateField,
    setType,
    setCurrency,
    setTransferTarget,
    setToAmount,
    resetForm,
  };
}
