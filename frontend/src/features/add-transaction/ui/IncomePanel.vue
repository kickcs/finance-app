<script setup lang="ts">
import { computed, watch } from 'vue';
import type { Category } from '@/entities/category';
import { getCurrencyByCode } from '@/entities/currency';
import type { AccountWithBalances } from '@/entities/account';
import type { TransactionFormData } from '../model/useTransactionForm';
import HeroAmount from './HeroAmount.vue';
import CategoryChips from './CategoryChips.vue';
import AccountSelector from './AccountSelector.vue';

const props = defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  categories: Category[];
}>();

const emit = defineEmits<{
  'update:formData': [value: TransactionFormData];
}>();

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

watch(
  selectedAccount,
  (account) => {
    if (account && account.balances.length > 0) {
      if (
        !account.balances.some((b) => b.currency === props.formData.currency)
      ) {
        updateField('currency', account.balances[0].currency);
      }
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-4">
    <HeroAmount
      :amount="formData.amount"
      :currency="formData.currency"
      :currency-symbol="currencySymbol"
      :available-currencies="availableCurrencies"
      :is-multi-currency="isMultiCurrency"
      @update:amount="updateField('amount', $event)"
      @update:currency="updateField('currency', $event)"
    />

    <AccountSelector
      :accounts="accounts"
      :selected-id="formData.accountId"
      label="Счёт"
      @select="handleAccountChange"
    />

    <CategoryChips
      :categories="categories"
      :selected-id="formData.categoryId"
      label="Категория"
      @select="updateField('categoryId', $event)"
    />
  </div>
</template>
