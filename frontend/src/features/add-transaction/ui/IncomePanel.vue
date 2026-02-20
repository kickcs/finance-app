<script setup lang="ts">
import type { Category } from '@/entities/category';
import type { AccountWithBalances } from '@/entities/account';
import type { TransactionFormData } from '../model/useTransactionForm';
import { usePanelState } from '../model/usePanelState';
import HeroAmount from './HeroAmount.vue';
import { CategoryChips } from '@/entities/category';
import { AccountSelector } from '@/entities/account';

const props = defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  categories: Category[];
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
</script>

<template>
  <div class="space-y-2">
    <HeroAmount
      :amount="formData.amount"
      :currency="formData.currency"
      :currency-symbol="currencySymbol"
      :available-currencies="availableCurrencies"
      :is-multi-currency="isMultiCurrency"
      :current-balance="currentBalance"
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
