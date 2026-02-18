import { ref, computed, watch } from 'vue';
import { ACCOUNT_ICONS, ACCOUNT_COLORS } from '@/entities/account';
import type { AccountType } from '@/entities/account';
import { accountsApi } from '@/entities/account';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateAccountRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';

export interface CurrencyBalance {
  currency: string;
  balance: number;
}

export interface AccountFormData {
  name: string;
  balances: CurrencyBalance[];
  icon: string;
  color: string;
  type: AccountType;
  // Credit card fields
  creditLimit: number | null;
  gracePeriodDays: number | null;
  billingDay: number | null;
  // Loan fields
  totalAmount: number | null;
  interestRate: number | null;
  monthlyPayment: number | null;
  startDate: string | null;
  endDate: string | null;
  // Deposit fields
  maturityDate: string | null;
  isReplenishable: boolean | null;
  isWithdrawable: boolean | null;
}

function getDefaultFormData(): AccountFormData {
  return {
    name: '',
    balances: [{ currency: 'UZS', balance: 0 }],
    icon: ACCOUNT_ICONS[0],
    color: ACCOUNT_COLORS[0],
    type: 'basic',
    creditLimit: null,
    gracePeriodDays: null,
    billingDay: null,
    totalAmount: null,
    interestRate: null,
    monthlyPayment: null,
    startDate: null,
    endDate: null,
    maturityDate: null,
    isReplenishable: null,
    isWithdrawable: null,
  };
}

export function useCreateAccount() {
  const { toast } = useToast();
  const formData = ref<AccountFormData>(getDefaultFormData());

  // Clear type-specific fields when type changes
  watch(
    () => formData.value.type,
    (newType, oldType) => {
      if (newType === oldType) return;
      // Reset all type-specific fields
      formData.value.creditLimit = null;
      formData.value.gracePeriodDays = null;
      formData.value.billingDay = null;
      formData.value.totalAmount = null;
      formData.value.interestRate = null;
      formData.value.monthlyPayment = null;
      formData.value.startDate = null;
      formData.value.endDate = null;
      formData.value.maturityDate = null;
      formData.value.isReplenishable = null;
      formData.value.isWithdrawable = null;
    },
  );

  const isValid = computed(() => {
    return (
      formData.value.name.trim().length > 0 &&
      formData.value.balances.length > 0 &&
      formData.value.balances.every((b) => b.currency.length > 0)
    );
  });

  const nameError = computed(() => {
    const name = formData.value.name;
    if (name.length === 0) return null;
    if (name.trim().length === 0) {
      return 'Название не может состоять только из пробелов';
    }
    if (name.trim().length < 2) {
      return 'Название должно содержать минимум 2 символа';
    }
    if (name.trim().length > 50) {
      return 'Название не должно превышать 50 символов';
    }
    return null;
  });

  const isSubmitting = ref(false);
  const error = ref<string | null>(null);

  async function createAccount(userId: string) {
    if (!isValid.value) {
      error.value = 'Введите название счёта и добавьте хотя бы одну валюту';
      return null;
    }

    isSubmitting.value = true;
    error.value = null;

    try {
      const fd = formData.value;

      // For credit cards, user enters debt as positive number — negate for storage
      const balances =
        fd.type === 'credit_card'
          ? fd.balances.map((b) => ({
              ...b,
              balance: b.balance !== 0 ? -Math.abs(b.balance) : 0,
            }))
          : fd.balances;

      const account = await accountsApi.createWithBalances(
        {
          user_id: userId,
          name: fd.name.trim(),
          icon: fd.icon,
          color: fd.color,
          type: fd.type,
          credit_limit: fd.creditLimit,
          grace_period_days: fd.gracePeriodDays,
          billing_day: fd.billingDay,
          total_amount: fd.totalAmount,
          interest_rate: fd.interestRate,
          monthly_payment: fd.monthlyPayment,
          start_date: fd.startDate,
          end_date: fd.endDate,
          maturity_date: fd.maturityDate,
          is_replenishable: fd.isReplenishable,
          is_withdrawable: fd.isWithdrawable,
        },
        balances,
      );

      // Invalidate accounts + balances cache so Dashboard and other pages refresh
      await invalidateAccountRelated(queryClient, userId);

      toast({
        title: 'Счёт создан',
        description: `Счёт "${formData.value.name}" успешно создан`,
        variant: 'success',
        duration: 2500,
      });

      return account.id;
    } catch (e) {
      error.value = 'Не удалось создать счёт';
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать счёт',
        variant: 'error',
        duration: 4000,
      });
      console.error('Failed to create account:', e);
      return null;
    } finally {
      isSubmitting.value = false;
    }
  }

  function updateField<K extends keyof AccountFormData>(
    field: K,
    value: AccountFormData[K],
  ) {
    formData.value[field] = value;
  }

  // Balance management
  function addCurrency(currency: string = 'USD') {
    // Don't add if currency already exists
    if (formData.value.balances.some((b) => b.currency === currency)) {
      return;
    }
    formData.value.balances.push({ currency, balance: 0 });
  }

  function removeCurrency(index: number) {
    if (formData.value.balances.length > 1) {
      formData.value.balances.splice(index, 1);
    }
  }

  function updateBalance(index: number, balance: number) {
    if (formData.value.balances[index]) {
      formData.value.balances[index].balance = balance;
    }
  }

  function updateCurrency(index: number, currency: string) {
    if (formData.value.balances[index]) {
      formData.value.balances[index].currency = currency;
    }
  }

  function resetForm() {
    formData.value = getDefaultFormData();
    error.value = null;
  }

  // Get primary currency (first one)
  const primaryCurrency = computed(
    () => formData.value.balances[0]?.currency ?? 'UZS',
  );

  return {
    formData,
    isValid,
    isSubmitting,
    error,
    nameError,
    primaryCurrency,
    createAccount,
    updateField,
    addCurrency,
    removeCurrency,
    updateBalance,
    updateCurrency,
    resetForm,
  };
}
