<script setup lang="ts">
import { computed, watch } from 'vue';
import { UIcon } from '@/shared/ui';
import { getCurrencyByCode } from '@/entities/currency';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useExchangeRates } from '@/shared/api';
import type { AccountWithBalances } from '@/entities/account';
import type { TransactionFormData } from '../model/useTransactionForm';
import { usePanelState } from '../model/usePanelState';
import HeroAmount from './HeroAmount.vue';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/shared/ui/primitives/popover';

const props = defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  userCurrency?: string;
}>();

const emit = defineEmits<{
  'update:formData': [value: TransactionFormData];
}>();

const {
  selectedAccount,
  availableCurrencies,
  isMultiCurrency,
  currencySymbol,
  currentBalance,
  hasSufficientFunds,
  updateField,
} = usePanelState(props, emit);

const baseCurrency = computed(() => props.userCurrency || 'UZS');
const { convertBetween } = useExchangeRates(baseCurrency);

// Target account state
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

const targetAccountCurrencies = computed(() => {
  if (!targetAccount.value) return [];
  const currencies = targetAccount.value.balances.map((b) => b.currency);
  if (targetAccount.value.id === props.formData.accountId) {
    return currencies.filter((c) => c !== props.formData.currency);
  }
  return currencies;
});

const targetBalance = computed(() => {
  if (!targetAccount.value || !props.formData.toCurrency) return undefined;
  return (
    targetAccount.value.balances.find(
      (b) => b.currency === props.formData.toCurrency,
    )?.balance ?? 0
  );
});

const showConversion = computed(
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

function handleSourceSelect(accountId: string) {
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

function handleTargetSelect(accountId: string) {
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

function handleSwap() {
  if (!props.formData.toAccountId || !props.formData.toCurrency) return;

  const newSourceId = props.formData.toAccountId;
  const newSourceCurrency = props.formData.toCurrency;
  const newTargetId = props.formData.accountId;
  const newTargetCurrency = props.formData.currency;
  const newToAmount = calculateConvertedAmount(
    props.formData.amount,
    newSourceCurrency,
    newTargetCurrency,
  );

  emit('update:formData', {
    ...props.formData,
    accountId: newSourceId,
    currency: newSourceCurrency,
    toAccountId: newTargetId,
    toCurrency: newTargetCurrency,
    toAmount: newToAmount,
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
  <div class="space-y-2">
    <HeroAmount
      :amount="formData.amount"
      :currency="formData.currency"
      :currency-symbol="currencySymbol"
      :available-currencies="availableCurrencies"
      :is-multi-currency="isMultiCurrency"
      :show-insufficient-funds="!hasSufficientFunds"
      :current-balance="currentBalance"
      label="Сумма перевода"
      @update:amount="updateField('amount', $event)"
      @update:currency="updateField('currency', $event)"
    />

    <!-- Source account card -->
    <Popover>
      <PopoverTrigger as-child>
        <button
          type="button"
          class="w-full flex items-center gap-3 p-3 rounded-xl
            bg-card-light dark:bg-card-dark
            border border-border-light dark:border-border-dark
            transition-colors hover:bg-surface-light dark:hover:bg-surface-dark"
        >
          <span
            v-if="selectedAccount"
            class="w-3 h-3 rounded-full shrink-0"
            :style="{ backgroundColor: selectedAccount.color }"
          />
          <div class="flex-1 text-left">
            <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
              Откуда
            </p>
            <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              {{ selectedAccount?.name || 'Выберите счёт' }}
            </p>
          </div>
          <span
            v-if="selectedAccount"
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            {{ formatCurrency(currentBalance, formData.currency) }}
          </span>
          <UIcon
            name="expand_more"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" :side-offset="4" class="w-[var(--reka-popover-trigger-width)] p-1">
        <button
          v-for="account in accounts"
          :key="account.id"
          type="button"
          :class="[
            'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors',
            account.id === formData.accountId
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark',
          ]"
          @click="handleSourceSelect(account.id)"
        >
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0"
            :style="{ backgroundColor: account.color }"
          />
          <span class="flex-1 text-left">{{ account.name }}</span>
          <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            {{ formatCurrency(account.balances[0]?.balance ?? 0, account.balances[0]?.currency ?? '') }}
          </span>
        </button>
      </PopoverContent>
    </Popover>

    <!-- Swap button -->
    <div class="flex justify-center -my-1">
      <button
        type="button"
        class="w-8 h-8 rounded-full flex items-center justify-center
          bg-primary/10 hover:bg-primary/20 active:scale-90
          transition-all duration-150"
        :disabled="!formData.toAccountId"
        @click="handleSwap"
      >
        <UIcon name="swap_vert" size="sm" class="text-primary" />
      </button>
    </div>

    <!-- Target account card -->
    <Popover>
      <PopoverTrigger as-child>
        <button
          type="button"
          class="w-full flex items-center gap-3 p-3 rounded-xl
            bg-card-light dark:bg-card-dark
            border border-border-light dark:border-border-dark
            transition-colors hover:bg-surface-light dark:hover:bg-surface-dark"
        >
          <span
            v-if="targetAccount"
            class="w-3 h-3 rounded-full shrink-0"
            :style="{ backgroundColor: targetAccount.color }"
          />
          <div class="flex-1 text-left">
            <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
              Куда
            </p>
            <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              {{ targetAccount?.name || 'Выберите счёт' }}
            </p>
          </div>
          <span
            v-if="targetAccount && targetBalance !== undefined"
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            {{ formatCurrency(targetBalance, formData.toCurrency ?? '') }}
          </span>
          <UIcon
            name="expand_more"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" :side-offset="4" class="w-[var(--reka-popover-trigger-width)] p-1">
        <button
          v-for="account in availableTargetAccounts"
          :key="account.id"
          type="button"
          :class="[
            'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors',
            account.id === formData.toAccountId
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark',
          ]"
          @click="handleTargetSelect(account.id)"
        >
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0"
            :style="{ backgroundColor: account.color }"
          />
          <span class="flex-1 text-left">{{ account.name }}</span>
          <span
            v-if="account.id === formData.accountId"
            class="text-xs opacity-60"
          >
            (конв.)
          </span>
        </button>
      </PopoverContent>
    </Popover>

    <!-- Target currency selector (when target has multiple currencies) -->
    <div v-if="targetAccount && targetAccountCurrencies.length > 1" class="flex gap-1.5 flex-wrap">
      <button
        v-for="cur in targetAccountCurrencies"
        :key="cur"
        type="button"
        :class="[
          'px-2.5 py-1 rounded-md text-sm font-medium transition-all',
          formData.toCurrency === cur
            ? 'bg-primary text-white'
            : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark',
        ]"
        @click="handleToCurrencyChange(cur)"
      >
        {{ getCurrencyByCode(cur)?.flag }} {{ cur }}
      </button>
    </div>

    <!-- Conversion info -->
    <div v-if="showConversion && formData.toAmount" class="text-center">
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        Получит:
        <span class="font-medium text-text-primary-light dark:text-text-primary-dark">
          {{ formatCurrency(formData.toAmount, formData.toCurrency ?? '') }}
        </span>
      </p>
      <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
        {{ formatCurrency(formData.amount, formData.currency) }} →
        {{ formatCurrency(formData.toAmount, formData.toCurrency ?? '') }}
      </p>
    </div>
  </div>
</template>
