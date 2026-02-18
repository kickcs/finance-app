<script setup lang="ts">
import { computed, watch } from 'vue';
import { UInput, UIcon } from '@/shared/ui';
import { getCurrencyByCode } from '@/entities/currency';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useExchangeRates } from '@/shared/api';
import type { AccountWithBalances } from '@/entities/account';
import type { TransactionFormData } from '../model/useTransactionForm';
import AmountInput from './AmountInput.vue';
import AccountSelector from './AccountSelector.vue';

const props = defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  userCurrency?: string;
}>();

const emit = defineEmits<{
  'update:formData': [value: TransactionFormData];
}>();

const baseCurrency = computed(() => props.userCurrency || 'UZS');
const { convertBetween } = useExchangeRates(baseCurrency);

const selectedAccount = computed(() =>
  props.accounts.find((a) => a.id === props.formData.accountId),
);

const targetAccount = computed(() =>
  props.accounts.find((a) => a.id === props.formData.toAccountId),
);

const availableTargetAccounts = computed(() => {
  const current = selectedAccount.value;
  if (current && current.balances.length > 1) {
    return props.accounts;
  }
  return props.accounts.filter((a) => a.id !== props.formData.accountId);
});

const availableCurrencies = computed(() => {
  if (!selectedAccount.value) return [];
  return selectedAccount.value.balances.map((b) => b.currency);
});

const targetAccountCurrencies = computed(() => {
  if (!targetAccount.value) return [];
  const currencies = targetAccount.value.balances.map((b) => b.currency);
  if (targetAccount.value.id === props.formData.accountId) {
    return currencies.filter((c) => c !== props.formData.currency);
  }
  return currencies;
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

const showToAmountField = computed(
  () =>
    props.formData.currency &&
    props.formData.toCurrency &&
    props.formData.currency !== props.formData.toCurrency,
);

function calculateConvertedAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): number {
  if (fromCurrency === toCurrency) return amount;
  if (amount <= 0) return 0;
  const converted = convertBetween(amount, fromCurrency, toCurrency);
  return Math.round(converted * 100) / 100;
}

function updateField<K extends keyof TransactionFormData>(
  field: K,
  value: TransactionFormData[K],
) {
  emit('update:formData', { ...props.formData, [field]: value });
}

function handleAccountChange(accountId: string) {
  const account = props.accounts.find((a) => a.id === accountId);
  const firstCurrency = account?.balances[0]?.currency || 'UZS';

  const updates: Partial<TransactionFormData> = {
    accountId,
    currency: firstCurrency,
  };

  if (props.formData.toAccountId === accountId) {
    const otherCurrencies =
      account?.balances.filter((b) => b.currency !== firstCurrency) || [];
    if (otherCurrencies.length > 0) {
      updates.toCurrency = otherCurrencies[0].currency;
      updates.toAmount = calculateConvertedAmount(
        props.formData.amount,
        firstCurrency,
        otherCurrencies[0].currency,
      );
    } else {
      updates.toAccountId = null;
      updates.toCurrency = null;
      updates.toAmount = null;
    }
  }

  emit('update:formData', { ...props.formData, ...updates });
}

function handleTargetAccountChange(accountId: string) {
  const account = props.accounts.find((a) => a.id === accountId);

  let firstCurrency: string;
  if (accountId === props.formData.accountId) {
    const otherCurrencies =
      account?.balances.filter((b) => b.currency !== props.formData.currency) ||
      [];
    firstCurrency =
      otherCurrencies[0]?.currency || account?.balances[0]?.currency || 'UZS';
  } else {
    firstCurrency = account?.balances[0]?.currency || 'UZS';
  }

  const toAmount = calculateConvertedAmount(
    props.formData.amount,
    props.formData.currency,
    firstCurrency,
  );

  emit('update:formData', {
    ...props.formData,
    toAccountId: accountId,
    toCurrency: firstCurrency,
    toAmount,
  });
}

function handleToCurrencyChange(currency: string) {
  const toAmount = calculateConvertedAmount(
    props.formData.amount,
    props.formData.currency,
    currency,
  );

  emit('update:formData', {
    ...props.formData,
    toCurrency: currency,
    toAmount,
  });
}

function handleToAmountChange(amount: number) {
  emit('update:formData', { ...props.formData, toAmount: amount });
}

// Auto-recalculate toAmount when amount or currencies change
watch(
  () =>
    [
      props.formData.amount,
      props.formData.currency,
      props.formData.toCurrency,
    ] as const,
  ([newAmount, fromCurrency, toCurrency]) => {
    if (fromCurrency && toCurrency && newAmount > 0) {
      const converted = calculateConvertedAmount(
        newAmount,
        fromCurrency,
        toCurrency,
      );
      if (converted !== props.formData.toAmount) {
        emit('update:formData', { ...props.formData, toAmount: converted });
      }
    }
  },
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
      label="Сумма списания"
      @update:amount="updateField('amount', $event)"
      @update:currency="updateField('currency', $event)"
    />

    <AccountSelector
      :accounts="accounts"
      :selected-id="formData.accountId"
      label="Со счёта"
      @select="handleAccountChange"
    />

    <!-- Transfer arrow -->
    <div class="flex justify-center">
      <div
        class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"
      >
        <UIcon name="arrow_downward" size="sm" class="text-primary" />
      </div>
    </div>

    <!-- Target account -->
    <div class="space-y-2">
      <label
        class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
      >
        На счёт
      </label>
      <div class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          v-for="account in availableTargetAccounts"
          :key="account.id"
          type="button"
          :class="[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all text-sm border',
            formData.toAccountId === account.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-gray-200 dark:border-gray-700 text-text-secondary-light dark:text-text-secondary-dark',
          ]"
          @click="handleTargetAccountChange(account.id)"
        >
          <span
            class="w-2.5 h-2.5 rounded-full"
            :style="{ backgroundColor: account.color }"
          />
          {{ account.name }}
          <span
            v-if="account.id === formData.accountId"
            class="text-xs opacity-60"
          >
            (конв.)
          </span>
          <span
            v-else-if="account.balances.length > 1"
            class="text-xs opacity-60"
          >
            ({{ account.balances.length }})
          </span>
        </button>
      </div>

      <!-- Target currency selector -->
      <div
        v-if="targetAccount && targetAccountCurrencies.length > 0"
        class="mt-1.5"
      >
        <label
          class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block"
        >
          Валюта зачисления
        </label>
        <div class="flex gap-1.5 flex-wrap">
          <button
            v-for="currency in targetAccountCurrencies"
            :key="currency"
            type="button"
            :class="[
              'px-2.5 py-1 rounded-md text-sm font-medium transition-all',
              formData.toCurrency === currency
                ? 'bg-primary text-white'
                : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark',
            ]"
            @click="handleToCurrencyChange(currency)"
          >
            {{ getCurrencyByCode(currency)?.flag }} {{ currency }}
          </button>
        </div>
      </div>

      <!-- Target amount (when currencies differ) -->
      <div v-if="showToAmountField" class="mt-2">
        <label
          class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block"
        >
          Сумма зачисления ({{ formData.toCurrency }})
        </label>
        <UInput
          :model-value="String(formData.toAmount || '')"
          placeholder="0"
          variant="currency"
          type="number"
          :suffix="
            getCurrencyByCode(formData.toCurrency ?? '')?.symbol ||
            formData.toCurrency ||
            ''
          "
          @update:model-value="handleToAmountChange(Number($event) || 0)"
          @keydown.enter.prevent
        />
        <p
          class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5"
        >
          {{ formatCurrency(formData.amount, formData.currency) }} →
          {{
            formatCurrency(formData.toAmount || 0, formData.toCurrency || '')
          }}
        </p>
      </div>
    </div>
  </div>
</template>
