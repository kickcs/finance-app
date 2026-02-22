import { computed, watch } from 'vue';
import { getCurrencyByCode } from '@/entities/currency';
import type { AccountWithBalances } from '@/entities/account';
import type { TransactionFormData } from './useTransactionForm';

interface PanelProps {
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
}

interface PanelEmit {
  (e: 'update:formData', value: TransactionFormData): void;
}

export function usePanelState(props: PanelProps, emit: PanelEmit) {
  const selectedAccount = computed(() =>
    props.accounts.find((a) => a.id === props.formData.accountId),
  );

  const availableCurrencies = computed(() => {
    if (!selectedAccount.value) return [];
    return selectedAccount.value.balances.map((b) => b.currency);
  });

  const isMultiCurrency = computed(() => availableCurrencies.value.length > 1);

  const currencySymbol = computed(() => {
    const currency = getCurrencyByCode(props.formData.currency);
    return currency?.symbol || props.formData.currency;
  });

  const currentBalance = computed(() => {
    if (!selectedAccount.value) return 0;
    return (
      selectedAccount.value.balances.find((b) => b.currency === props.formData.currency)?.balance ??
      0
    );
  });

  const hasSufficientFunds = computed(() => props.formData.amount <= currentBalance.value);

  function updateField<K extends keyof TransactionFormData>(
    field: K,
    value: TransactionFormData[K],
  ) {
    emit('update:formData', { ...props.formData, [field]: value });
  }

  function handleAccountChange(accountId: string) {
    const account = props.accounts.find((a) => a.id === accountId);
    const firstCurrency = account?.balances[0]?.currency || 'UZS';
    emit('update:formData', {
      ...props.formData,
      accountId,
      currency: firstCurrency,
    });
  }

  // Auto-correct currency if selected account doesn't support it
  watch(
    selectedAccount,
    (account) => {
      if (account && account.balances.length > 0) {
        if (!account.balances.some((b) => b.currency === props.formData.currency)) {
          updateField('currency', account.balances[0].currency);
        }
      }
    },
    { immediate: true },
  );

  return {
    selectedAccount,
    availableCurrencies,
    isMultiCurrency,
    currencySymbol,
    currentBalance,
    hasSufficientFunds,
    updateField,
    handleAccountChange,
  };
}
