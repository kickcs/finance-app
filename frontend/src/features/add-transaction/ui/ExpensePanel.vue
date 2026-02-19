<script setup lang="ts">
import type { Category } from '@/entities/category';
import { SplitExpenseSection } from '@/features/split-expense';
import type { SplitExpenseData, SplitMethod } from '@/features/split-expense';
import type { AccountWithBalances } from '@/entities/account';
import type { TransactionFormData } from '../model/useTransactionForm';
import { usePanelState } from '../model/usePanelState';
import HeroAmount from './HeroAmount.vue';
import CategoryChips from './CategoryChips.vue';
import AccountSelector from './AccountSelector.vue';

const props = defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  categories: Category[];
  splitData?: SplitExpenseData;
  splitValidationError?: string | null;
  autofocusAmount?: boolean;
}>();

const emit = defineEmits<{
  'update:formData': [value: TransactionFormData];
  addParticipant: [name: string];
  removeParticipant: [id: string];
  updateParticipantAmount: [id: string, amount: number];
  updateParticipantName: [id: string, name: string];
  setSplitMethod: [method: SplitMethod];
  setMyShare: [amount: number];
  setSplitEnabled: [enabled: boolean];
}>();

const {
  availableCurrencies,
  isMultiCurrency,
  currencySymbol,
  currentBalance,
  hasSufficientFunds,
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
      :show-insufficient-funds="!hasSufficientFunds"
      :current-balance="currentBalance"
      :autofocus="autofocusAmount"
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

    <SplitExpenseSection
      v-if="splitData"
      :total-amount="formData.amount"
      :currency="formData.currency"
      :split-data="splitData"
      :validation-error="splitValidationError"
      @add-participant="$emit('addParticipant', $event)"
      @remove-participant="$emit('removeParticipant', $event)"
      @update-participant-amount="
        (id, amount) => $emit('updateParticipantAmount', id, amount)
      "
      @update-participant-name="
        (id, name) => $emit('updateParticipantName', id, name)
      "
      @set-method="$emit('setSplitMethod', $event)"
      @set-my-share="$emit('setMyShare', $event)"
      @set-enabled="$emit('setSplitEnabled', $event)"
    />
  </div>
</template>
