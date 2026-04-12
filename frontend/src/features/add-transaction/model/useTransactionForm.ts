import { ref, computed } from 'vue';
import { CATEGORY_IDS } from '@/entities/category';
import { DEFAULT_CURRENCY } from '@/entities/currency';

export interface TransactionFormData {
  accountId: string | null;
  categoryId: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer' | 'debt';
  description: string;
  date: number;
  toAccountId: string | null;
  toAmount: number | null;
  toCurrency: string | null;
  feeAmount: number;
  feeType: 'fixed' | 'percent';
}

const DEFAULT_FORM_DATA: Omit<TransactionFormData, 'date'> = {
  accountId: null,
  categoryId: '',
  amount: 0,
  currency: DEFAULT_CURRENCY,
  type: 'expense',
  description: '',
  toAccountId: null,
  toAmount: null,
  toCurrency: null,
  feeAmount: 0,
  feeType: 'fixed',
};

export function useTransactionForm() {
  const formData = ref<TransactionFormData>({
    ...DEFAULT_FORM_DATA,
    date: Date.now(),
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

  function setType(type: 'income' | 'expense' | 'transfer' | 'debt') {
    formData.value.type = type;
    formData.value.categoryId = type === 'transfer' ? CATEGORY_IDS.TRANSFER : '';
    if (type !== 'transfer') {
      formData.value.toAccountId = null;
      formData.value.toAmount = null;
      formData.value.toCurrency = null;
      formData.value.feeAmount = 0;
      formData.value.feeType = 'fixed';
    }
  }

  function setTransferTarget(toAccountId: string, toCurrency: string) {
    formData.value.toAccountId = toAccountId;
    formData.value.toCurrency = toCurrency;
    if (formData.value.currency === toCurrency) {
      formData.value.toAmount = formData.value.amount;
    }
  }

  function resetForm() {
    formData.value = {
      ...DEFAULT_FORM_DATA,
      date: Date.now(),
    };
  }

  return {
    formData,
    isValid,
    updateField,
    setType,
    setTransferTarget,
    resetForm,
  };
}
