// frontend/src/features/add-transaction/model/useTransactionForm.ts
import { ref, computed } from 'vue';

export interface TransactionFormData {
  accountId: string | null;
  categoryId: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  date: number;
  toAccountId: string | null;
  toAmount: number | null;
  toCurrency: string | null;
}

export function useTransactionForm() {
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
        (formData.value.toAccountId !== formData.value.accountId ||
          formData.value.currency !== formData.value.toCurrency) &&
        formData.value.toCurrency !== null &&
        formData.value.toAmount !== null &&
        formData.value.toAmount > 0
      );
    }

    return base && formData.value.categoryId !== '';
  });

  function updateField<K extends keyof TransactionFormData>(
    field: K,
    value: TransactionFormData[K],
  ) {
    formData.value[field] = value;
  }

  function setType(type: 'income' | 'expense' | 'transfer') {
    formData.value.type = type;
    formData.value.categoryId = type === 'transfer' ? 'transfer' : '';
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
  }

  return {
    formData,
    isValid,
    updateField,
    setType,
    setCurrency,
    setTransferTarget,
    setToAmount,
    resetForm,
  };
}
