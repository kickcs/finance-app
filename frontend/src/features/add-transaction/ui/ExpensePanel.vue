<script setup lang="ts">
import { computed, watch } from 'vue';
import { CategoryCard } from '@/entities/category';
import type { Category } from '@/entities/category';
import { getCurrencyByCode } from '@/entities/currency';
import { SplitExpenseSection } from '@/features/split-expense';
import type { SplitExpenseData, SplitMethod } from '@/features/split-expense';
import type { AccountWithBalances } from '@/entities/account';
import type { TransactionFormData } from '../model/useTransactionForm';
import AmountInput from './AmountInput.vue';
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

const selectedAccount = computed(() =>
  props.accounts.find((a) => a.id === props.formData.accountId),
);

const availableCurrencies = computed(() => {
  if (!selectedAccount.value) return [];
  return selectedAccount.value.balances.map((b) => b.currency);
});

const isMultiCurrency = computed(() => availableCurrencies.value.length > 1);

const currentBalance = computed(() => {
  if (!selectedAccount.value) return 0;
  return (
    selectedAccount.value.balances.find(
      (b) => b.currency === props.formData.currency,
    )?.balance ?? 0
  );
});

const hasSufficientFunds = computed(
  () => props.formData.amount <= currentBalance.value,
);

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

// Validate currency is available when account changes externally
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
    <AmountInput
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

    <div class="space-y-2">
      <label
        class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
      >
        Категория
      </label>
      <div
        class="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[168px] overflow-y-auto"
      >
        <CategoryCard
          v-for="category in categories"
          :key="category.id"
          :category="category"
          :selected="formData.categoryId === category.id"
          size="medium"
          @click="updateField('categoryId', category.id)"
        />
      </div>
    </div>

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
