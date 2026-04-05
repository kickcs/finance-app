<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { UIcon } from '@/shared/ui';
import { getCurrencyByCode, DEFAULT_CURRENCY } from '@/entities/currency';
import { formatCurrency, sanitizeCurrencyInput } from '@/shared/lib/format/currency';
import { useExchangeRates } from '@/shared/api';
import type { AccountWithBalances } from '@/entities/account';
import type { TransactionFormData } from '../model/useTransactionForm';
import { usePanelState } from '../model/usePanelState';
import HeroAmount from './HeroAmount.vue';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';

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
} = usePanelState(props, emit);

const sourceOpen = ref(false);
const targetOpen = ref(false);

const baseCurrency = computed(() => props.userCurrency || DEFAULT_CURRENCY);
const { convertBetween, rates } = useExchangeRates(baseCurrency);

const exchangeRate = ref<number | null>(null);
const isUserEditingRate = ref(false);

function loadRateFromApi(fromCurrency: string, toCurrency: string): number | null {
  if (fromCurrency === toCurrency) return null;
  const ratesData = rates.value;
  if (!ratesData) return null;
  if (fromCurrency !== baseCurrency.value && !ratesData[fromCurrency]) return null;
  if (toCurrency !== baseCurrency.value && !ratesData[toCurrency]) return null;
  return convertBetween(1, fromCurrency, toCurrency);
}

function recalcToAmount(amount: number, rate: number | null): number | null {
  if (rate === null || rate <= 0) return null;
  return Math.round(amount * rate * 100) / 100;
}

function applyApiRate(fromCurrency: string, toCurrency: string): number | null {
  const rate = loadRateFromApi(fromCurrency, toCurrency);
  exchangeRate.value = rate;
  isUserEditingRate.value = false;
  return recalcToAmount(props.formData.amount, rate);
}

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
    targetAccount.value.balances.find((b) => b.currency === props.formData.toCurrency)?.balance ?? 0
  );
});

const showConversion = computed(
  () =>
    props.formData.currency &&
    props.formData.toCurrency &&
    props.formData.currency !== props.formData.toCurrency,
);

const isIntraAccount = computed(
  () => props.formData.accountId === props.formData.toAccountId && !!props.formData.accountId,
);

watch(
  () => [props.formData.currency, props.formData.toCurrency, rates.value] as const,
  ([fromCurrency, toCurrency]) => {
    if (fromCurrency && toCurrency && fromCurrency !== toCurrency && !isUserEditingRate.value) {
      const rate = loadRateFromApi(fromCurrency, toCurrency);
      if (rate === exchangeRate.value) return;
      exchangeRate.value = rate;
      const toAmount = recalcToAmount(props.formData.amount, rate);
      if (toAmount !== null) {
        emit('update:formData', { ...props.formData, toAmount });
      }
    }
  },
  { immediate: true },
);

// Auto-select target account when source is set but target is empty
watch(
  () =>
    [props.formData.accountId, props.formData.toAccountId, availableTargetAccounts.value] as const,
  ([sourceId, targetId, targets]) => {
    if (sourceId && !targetId && targets.length > 0) {
      const firstTarget = targets.find((a) => a.id !== sourceId) ?? targets[0];
      if (firstTarget) {
        handleTargetSelect(firstTarget.id);
      }
    }
  },
  { immediate: true },
);

function handleSourceSelect(accountId: string) {
  const account = props.accounts.find((a) => a.id === accountId);
  const firstCurrency = account?.balances[0]?.currency || DEFAULT_CURRENCY;

  const updates: Partial<TransactionFormData> = {
    accountId,
    currency: firstCurrency,
  };

  if (props.formData.toAccountId === accountId) {
    const otherCurrencies = account?.balances.filter((b) => b.currency !== firstCurrency) || [];
    if (otherCurrencies.length > 0) {
      updates.toCurrency = otherCurrencies[0].currency;
      updates.toAmount = applyApiRate(firstCurrency, otherCurrencies[0].currency);
    } else {
      updates.toAccountId = null;
      updates.toCurrency = null;
      updates.toAmount = null;
      exchangeRate.value = null;
      isUserEditingRate.value = false;
    }
  }

  emit('update:formData', { ...props.formData, ...updates });
  sourceOpen.value = false;
}

function handleTargetSelect(accountId: string) {
  const account = props.accounts.find((a) => a.id === accountId);

  let firstCurrency: string;
  if (accountId === props.formData.accountId) {
    const otherCurrencies =
      account?.balances.filter((b) => b.currency !== props.formData.currency) || [];
    firstCurrency =
      otherCurrencies[0]?.currency || account?.balances[0]?.currency || DEFAULT_CURRENCY;
  } else {
    firstCurrency = account?.balances[0]?.currency || DEFAULT_CURRENCY;
  }

  const isSameCurrency = props.formData.currency === firstCurrency;
  const toAmount = isSameCurrency
    ? props.formData.amount
    : applyApiRate(props.formData.currency, firstCurrency);

  emit('update:formData', {
    ...props.formData,
    toAccountId: accountId,
    toCurrency: firstCurrency,
    toAmount,
  });
  targetOpen.value = false;
}

function handleSwap() {
  if (!props.formData.toAccountId || !props.formData.toCurrency) return;

  const newSourceId = props.formData.toAccountId;
  const newSourceCurrency = props.formData.toCurrency;
  const newTargetId = props.formData.accountId;
  const newTargetCurrency = props.formData.currency;

  const isSameCurrency = newSourceCurrency === newTargetCurrency;
  const newToAmount = isSameCurrency
    ? props.formData.amount
    : applyApiRate(newSourceCurrency, newTargetCurrency);

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
  const toAmount = applyApiRate(props.formData.currency, currency);

  emit('update:formData', {
    ...props.formData,
    toCurrency: currency,
    toAmount,
  });
}

function handleSourceCurrencyChange(newCurrency: string) {
  const updates: Partial<TransactionFormData> = { currency: newCurrency };

  if (
    props.formData.toAccountId === props.formData.accountId &&
    props.formData.toCurrency === newCurrency
  ) {
    const account = props.accounts.find((a) => a.id === props.formData.accountId);
    const otherCurrency = account?.balances.find((b) => b.currency !== newCurrency)?.currency;
    if (otherCurrency) {
      updates.toCurrency = otherCurrency;
      updates.toAmount = applyApiRate(newCurrency, otherCurrency);
    }
  } else if (props.formData.toCurrency && props.formData.toCurrency !== newCurrency) {
    updates.toAmount = applyApiRate(newCurrency, props.formData.toCurrency);
  }

  emit('update:formData', { ...props.formData, ...updates });
}

function handleAmountChange(newAmount: number) {
  const toAmount = !showConversion.value
    ? newAmount
    : recalcToAmount(newAmount, exchangeRate.value);
  emit('update:formData', {
    ...props.formData,
    amount: newAmount,
    toAmount: toAmount ?? null,
  });
}

function handleTargetAmountChange(newToAmount: number) {
  if (!props.formData.currency || !props.formData.toCurrency) return;

  if (props.formData.amount > 0) {
    exchangeRate.value = newToAmount / props.formData.amount;
  }
  isUserEditingRate.value = true;

  emit('update:formData', {
    ...props.formData,
    toAmount: newToAmount,
  });
}

function handleRateChange(value: string) {
  const num = parseFloat(sanitizeCurrencyInput(value));
  if (Number.isNaN(num) || num <= 0) {
    exchangeRate.value = null;
    return;
  }
  exchangeRate.value = num;
  isUserEditingRate.value = true;
  const toAmount = recalcToAmount(props.formData.amount, num);
  if (toAmount !== null) {
    emit('update:formData', { ...props.formData, toAmount });
  }
}

const feeDisplayAmount = computed(() => {
  if (
    props.formData.feeType === 'percent' &&
    props.formData.amount > 0 &&
    props.formData.feeAmount > 0
  ) {
    return Math.round(((props.formData.amount * props.formData.feeAmount) / 100) * 100) / 100;
  }
  return props.formData.feeAmount;
});

const rawFeeValue = ref(props.formData.feeAmount ? String(props.formData.feeAmount) : '');
const isFeeInputFocused = ref(false);

watch(
  () => props.formData.feeAmount,
  (newAmount) => {
    if (isFeeInputFocused.value) return;
    const currentParsed = parseFloat(rawFeeValue.value) || 0;
    if (currentParsed !== newAmount) {
      rawFeeValue.value = newAmount ? String(newAmount) : '';
    }
  },
);

function handleFeeAmountChange(value: string) {
  const sanitized = sanitizeCurrencyInput(value);
  rawFeeValue.value = sanitized;
  const num = parseFloat(sanitized);
  emit('update:formData', { ...props.formData, feeAmount: Number.isNaN(num) ? 0 : num });
}

function handleFeeTypeToggle() {
  const newType = props.formData.feeType === 'fixed' ? 'percent' : 'fixed';
  rawFeeValue.value = '';
  emit('update:formData', { ...props.formData, feeType: newType, feeAmount: 0 });
}
</script>

<template>
  <div class="space-y-4">
    <HeroAmount
      :amount="formData.amount"
      :currency="formData.currency"
      :currency-symbol="currencySymbol"
      :available-currencies="availableCurrencies"
      :is-multi-currency="isMultiCurrency"
      :show-insufficient-funds="!hasSufficientFunds"
      :current-balance="currentBalance"
      label="Сумма списания"
      @update:amount="handleAmountChange"
      @update:currency="handleSourceCurrencyChange"
    />

    <!-- Transfer flow: source → swap → target -->
    <div class="relative">
      <!-- Timeline connector -->
      <div
        v-if="targetAccount"
        class="absolute left-[1px] top-6 bottom-6 w-px border-l-2 border-dashed border-border-light dark:border-border-dark opacity-40 z-0"
      />

      <!-- Source account card -->
      <Popover v-model:open="sourceOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            class="w-full flex items-center gap-3 p-3.5 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark transition-colors hover:bg-surface-light/50 dark:hover:bg-surface-dark/50 overflow-hidden relative z-10"
          >
            <!-- Color accent bar -->
            <span
              class="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
              :style="{
                backgroundColor: selectedAccount?.color || 'var(--color-border-light)',
              }"
            />
            <div class="flex-1 text-left pl-1.5">
              <p
                class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wider"
              >
                Откуда
              </p>
              <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                {{ selectedAccount?.name || 'Выберите счёт' }}
              </p>
            </div>
            <div v-if="selectedAccount" class="text-right">
              <p
                class="text-sm font-medium tabular-nums text-text-primary-light dark:text-text-primary-dark"
              >
                {{ formatCurrency(currentBalance, formData.currency) }}
              </p>
            </div>
            <UIcon
              name="expand_more"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          :side-offset="4"
          class="w-[var(--reka-popover-trigger-width)] p-1"
        >
          <button
            v-for="account in accounts"
            :key="account.id"
            type="button"
            :class="[
              'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm transition-colors',
              account.id === formData.accountId
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark',
            ]"
            @click="handleSourceSelect(account.id)"
          >
            <span
              class="w-3 h-3 rounded-full shrink-0"
              :style="{ backgroundColor: account.color }"
            />
            <span class="flex-1 text-left">{{ account.name }}</span>
            <span
              class="text-xs tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              {{
                formatCurrency(
                  account.balances[0]?.balance ?? 0,
                  account.balances[0]?.currency ?? '',
                )
              }}
            </span>
          </button>
        </PopoverContent>
      </Popover>

      <!-- Swap button — centered between cards -->
      <div class="flex justify-center -my-2 relative z-20">
        <button
          type="button"
          class="w-10 h-10 rounded-full flex items-center justify-center bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:bg-primary/10 active:scale-90 active:rotate-180 transition-all duration-300 disabled:opacity-40"
          :disabled="!formData.toAccountId"
          @click="handleSwap"
        >
          <UIcon
            :name="isIntraAccount ? 'currency_exchange' : 'swap_vert'"
            size="md"
            class="text-primary"
          />
        </button>
      </div>

      <!-- Target account card -->
      <Popover v-model:open="targetOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            :class="[
              'w-full flex items-center gap-3 p-3.5 rounded-xl transition-colors overflow-hidden relative z-10',
              targetAccount
                ? 'bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark hover:bg-surface-light/50 dark:hover:bg-surface-dark/50'
                : 'bg-transparent border-2 border-dashed border-border-light dark:border-border-dark hover:border-primary/40',
            ]"
          >
            <!-- Color accent bar (only when account selected) -->
            <span
              v-if="targetAccount"
              class="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
              :style="{ backgroundColor: targetAccount.color }"
            />
            <div class="flex-1 text-left" :class="targetAccount ? 'pl-1.5' : ''">
              <p
                class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wider"
              >
                {{ isIntraAccount ? 'В валюту' : 'Куда' }}
              </p>
              <p
                :class="[
                  'text-sm font-semibold',
                  targetAccount
                    ? 'text-text-primary-light dark:text-text-primary-dark'
                    : 'text-text-tertiary-light dark:text-text-tertiary-dark',
                ]"
              >
                {{ targetAccount?.name || 'Выберите счёт' }}
              </p>
            </div>
            <div v-if="targetAccount && targetBalance !== undefined" class="text-right">
              <p
                class="text-sm font-medium tabular-nums text-text-primary-light dark:text-text-primary-dark"
              >
                {{ formatCurrency(targetBalance, formData.toCurrency ?? '') }}
              </p>
            </div>
            <UIcon
              :name="targetAccount ? 'expand_more' : 'add'"
              size="sm"
              :class="
                targetAccount
                  ? 'text-text-tertiary-light dark:text-text-tertiary-dark'
                  : 'text-primary'
              "
              class="shrink-0"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          :side-offset="4"
          class="w-[var(--reka-popover-trigger-width)] p-1"
        >
          <button
            v-for="account in availableTargetAccounts"
            :key="account.id"
            type="button"
            :class="[
              'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm transition-colors',
              account.id === formData.toAccountId
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark',
            ]"
            @click="handleTargetSelect(account.id)"
          >
            <span
              class="w-3 h-3 rounded-full shrink-0"
              :style="{ backgroundColor: account.color }"
            />
            <span class="flex-1 text-left">{{ account.name }}</span>
            <span
              v-if="account.id === formData.accountId"
              class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              конвертация
            </span>
          </button>
        </PopoverContent>
      </Popover>

      <!-- Exchange rate input (only when currencies differ) -->
      <Transition name="fee">
        <div
          v-if="showConversion"
          class="mt-3 px-3 py-2.5 rounded-xl bg-surface-light/50 dark:bg-surface-dark/50 border border-border-light dark:border-border-dark"
        >
          <div class="flex items-center gap-2">
            <UIcon
              name="currency_exchange"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
            />
            <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark shrink-0">
              Курс обмена
            </span>
            <input
              type="number"
              inputmode="decimal"
              step="any"
              :value="exchangeRate ?? ''"
              placeholder="0"
              class="flex-1 min-w-0 bg-transparent text-sm text-right text-text-primary-light dark:text-text-primary-dark outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              @input="handleRateChange(($event.target as HTMLInputElement).value)"
            />
            <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark shrink-0">
              {{ formData.toCurrency }}
            </span>
          </div>
          <p class="mt-1 text-[11px] text-text-tertiary-light dark:text-text-tertiary-dark pl-7">
            1 {{ formData.currency }} = {{ exchangeRate ?? '—' }} {{ formData.toCurrency }}
          </p>
        </div>
      </Transition>

      <!-- Commission input (only when target selected) -->
      <Transition name="fee">
        <div
          v-if="targetAccount"
          class="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-light/50 dark:bg-surface-dark/50 border border-border-light dark:border-border-dark"
        >
          <UIcon
            name="receipt_long"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
          />
          <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark shrink-0">
            Комиссия
          </span>
          <input
            type="text"
            inputmode="decimal"
            :value="rawFeeValue"
            placeholder="0"
            class="flex-1 min-w-0 bg-transparent text-sm text-right text-text-primary-light dark:text-text-primary-dark outline-none tabular-nums"
            @input="handleFeeAmountChange(($event.target as HTMLInputElement).value)"
            @focus="isFeeInputFocused = true"
            @blur="isFeeInputFocused = false"
          />
          <button
            type="button"
            class="shrink-0 px-2 py-1 rounded-lg text-xs font-medium transition-colors"
            :class="
              formData.feeType === 'percent'
                ? 'bg-primary/10 text-primary'
                : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'
            "
            @click="handleFeeTypeToggle"
          >
            {{ formData.feeType === 'percent' ? '%' : formData.currency }}
          </button>
          <span
            v-if="formData.feeType === 'percent' && feeDisplayAmount > 0"
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark tabular-nums shrink-0"
          >
            ≈ {{ feeDisplayAmount }} {{ formData.currency }}
          </span>
        </div>
      </Transition>
    </div>

    <!-- Secondary amount input for target account when currencies differ -->
    <div
      v-if="showConversion"
      class="pt-2 border-t border-border-light dark:border-border-dark border-dashed"
    >
      <HeroAmount
        :amount="formData.toAmount || 0"
        :currency="formData.toCurrency || ''"
        :currency-symbol="getCurrencyByCode(formData.toCurrency || '')?.symbol || ''"
        :available-currencies="targetAccountCurrencies"
        :is-multi-currency="targetAccountCurrencies.length > 1"
        label="Сумма зачисления"
        @update:amount="handleTargetAmountChange"
        @update:currency="handleToCurrencyChange"
      />
    </div>
  </div>
</template>

<style scoped>
.fee-enter-active,
.fee-leave-active {
  transition: all 0.2s ease;
}
.fee-enter-from,
.fee-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
