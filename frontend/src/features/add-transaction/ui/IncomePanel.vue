<script setup lang="ts">
import type { Category } from '@/entities/category';
import type { AccountWithBalances } from '@/entities/account';
import type { Transaction } from '@/shared/api/database.types';
import type { TransactionFormData } from '../model/useTransactionForm';
import { usePanelState } from '../model/usePanelState';
import { useAmountSuggestions } from '../model/useAmountSuggestions';
import HeroAmount from './HeroAmount.vue';
import AmountSuggestions from './AmountSuggestions.vue';
import { CategoryPicker } from '@/entities/category';
import { AccountSelector } from '@/entities/account';

const props = defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  categories: Category[];
  transactions?: Transaction[];
  autofocusAmount?: boolean;
}>();

const emit = defineEmits<{
  'update:formData': [value: TransactionFormData];
}>();

const {
  availableCurrencies,
  isMultiCurrency,
  currencySymbol,
  currentBalance,
  updateField,
  handleAccountChange,
} = usePanelState(props, emit);

const { suggestions } = useAmountSuggestions(
  () => props.transactions,
  () => 'income',
  () => props.formData.currency,
  () => props.formData.categoryId,
);
</script>

<template>
  <div class="space-y-3">
    <HeroAmount
      variant="hero"
      sign="plus"
      :amount="formData.amount"
      :currency="formData.currency"
      :currency-symbol="currencySymbol"
      :available-currencies="availableCurrencies"
      :is-multi-currency="isMultiCurrency"
      :current-balance="currentBalance"
      :autofocus="autofocusAmount"
      @update:amount="updateField('amount', $event)"
      @update:currency="updateField('currency', $event)"
    />

    <AmountSuggestions
      :amounts="suggestions"
      :current-amount="formData.amount"
      @select="updateField('amount', $event)"
    />

    <AccountSelector
      :accounts="accounts"
      :selected-id="formData.accountId"
      label="Счёт"
      @select="handleAccountChange"
    />

    <CategoryPicker
      :categories="categories"
      :selected-id="formData.categoryId"
      :transactions="transactions"
      label="Категория"
      @select="updateField('categoryId', $event)"
    />
  </div>
</template>
