<script setup lang="ts">
import { computed, watch, ref, nextTick, onMounted, onUnmounted } from 'vue';
import { UInput, UButton, UTabs, UIcon } from '@/shared/ui';
import { CategoryCard } from '@/entities/category';
import type { Category } from '@/entities/category';
import { getCurrencyByCode } from '@/entities/currency';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useExchangeRates } from '@/shared/api';
import type { TransactionFormData } from '../model/useAddTransaction';
import type { AccountWithBalances } from '@/entities/account';
import { SplitExpenseSection } from '@/features/split-expense';
import type { SplitExpenseData, SplitMethod } from '@/features/split-expense';
import AmountInput from './AmountInput.vue';
import AccountSelector from './AccountSelector.vue';

const props = defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  userCurrency?: string;
  isSubmitting?: boolean;
  error?: string | null;
  splitData?: SplitExpenseData;
  splitValidationError?: string | null;
}>();

const emit = defineEmits<{
  'update:formData': [value: TransactionFormData];
  submit: [];
  addParticipant: [name: string];
  removeParticipant: [id: string];
  updateParticipantAmount: [id: string, amount: number];
  updateParticipantName: [id: string, name: string];
  setSplitMethod: [method: SplitMethod];
  setMyShare: [amount: number];
  setSplitEnabled: [enabled: boolean];
}>();

const tabItems = [
  { id: 'expense', label: 'Расход' },
  { id: 'income', label: 'Доход' },
  { id: 'transfer', label: 'Перевод' },
];

const typeOrder = ['expense', 'income', 'transfer'] as const;

// Scroll-snap refs and state
const scrollContainer = ref<HTMLElement | null>(null);
let isScrollingProgrammatically = false;
let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Exchange rates for auto-conversion
const baseCurrency = computed(() => props.userCurrency || 'UZS');
const { convertBetween } = useExchangeRates(baseCurrency);

const isTransfer = computed(() => props.formData.type === 'transfer');

const selectedAccount = computed(() =>
  props.accounts.find((a) => a.id === props.formData.accountId),
);

const targetAccount = computed(() =>
  props.accounts.find((a) => a.id === props.formData.toAccountId),
);

// Available target accounts for transfer
const availableTargetAccounts = computed(() => {
  const current = selectedAccount.value;
  if (current && current.balances.length > 1) {
    return props.accounts;
  }
  return props.accounts.filter((a) => a.id !== props.formData.accountId);
});

// Get available currencies for selected account
const availableCurrencies = computed(() => {
  if (!selectedAccount.value) return [];
  return selectedAccount.value.balances.map((b) => b.currency);
});

// Target account currencies - filter out source currency if same account
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

const hasSufficientFunds = computed(() => {
  if (props.formData.type === 'income') return true;
  return props.formData.amount <= currentBalance.value;
});

const showToAmountField = computed(() => {
  return (
    isTransfer.value &&
    props.formData.currency &&
    props.formData.toCurrency &&
    props.formData.currency !== props.formData.toCurrency
  );
});

const currencySymbol = computed(() => {
  const currency = getCurrencyByCode(props.formData.currency);
  return currency?.symbol || props.formData.currency;
});

// Calculate converted amount using exchange rates
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

function applyTypeChange(type: string) {
  emit('update:formData', {
    ...props.formData,
    type: type as 'income' | 'expense' | 'transfer',
    categoryId: type === 'transfer' ? 'transfer' : '',
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
  });
}

// --- Scroll-snap sync ---

function resetProgrammaticFlag() {
  isScrollingProgrammatically = false;
}

function scrollToPanel(index: number, smooth = true) {
  if (!scrollContainer.value) return;

  isScrollingProgrammatically = true;
  const panelWidth = scrollContainer.value.offsetWidth;
  scrollContainer.value.scrollTo({
    left: panelWidth * index,
    behavior: smooth ? 'smooth' : 'instant',
  });

  // Reset flag via scrollend event (with timeout safety fallback)
  scrollContainer.value.addEventListener('scrollend', resetProgrammaticFlag, {
    once: true,
  });
  setTimeout(resetProgrammaticFlag, 600);
}

// Tab click → scroll to panel
function handleTabClick(type: string) {
  const index = typeOrder.indexOf(type as (typeof typeOrder)[number]);
  if (index === -1) return;

  applyTypeChange(type);
  scrollToPanel(index);
}

// Detect active panel from scroll position and update type
function detectPanelFromScroll() {
  if (isScrollingProgrammatically || !scrollContainer.value) return;

  const container = scrollContainer.value;
  const panelWidth = container.offsetWidth;
  const scrollLeft = container.scrollLeft;
  const index = Math.round(scrollLeft / panelWidth);
  const clampedIndex = Math.max(0, Math.min(index, typeOrder.length - 1));
  const newType = typeOrder[clampedIndex];

  if (newType !== props.formData.type) {
    applyTypeChange(newType);
  }
}

// scrollend handler (native, for supported browsers)
function handleScrollEnd() {
  detectPanelFromScroll();
}

// scroll handler (debounced fallback for browsers without scrollend)
function handleScroll() {
  if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
  scrollDebounceTimer = setTimeout(() => {
    detectPanelFromScroll();
  }, 150);
}

onUnmounted(() => {
  if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
});

// Scroll to initial position on mount (if type is not 'expense')
onMounted(() => {
  nextTick(() => {
    const index = typeOrder.indexOf(
      props.formData.type as (typeof typeOrder)[number],
    );
    if (index > 0) {
      scrollToPanel(index, false);
    }
  });
});

// Watch for external type changes (e.g. from query params)
watch(
  () => props.formData.type,
  (newType) => {
    const index = typeOrder.indexOf(newType as (typeof typeOrder)[number]);
    if (index === -1 || !scrollContainer.value) return;

    const panelWidth = scrollContainer.value.offsetWidth;
    const currentIndex = Math.round(
      scrollContainer.value.scrollLeft / panelWidth,
    );

    if (currentIndex !== index) {
      scrollToPanel(index);
    }
  },
);

// --- Account and transfer handlers ---

function handleAccountChange(accountId: string) {
  const account = props.accounts.find((a) => a.id === accountId);
  const firstCurrency = account?.balances[0]?.currency || 'UZS';

  const updates: Partial<TransactionFormData> = {
    accountId,
    currency: firstCurrency,
  };

  if (
    props.formData.type === 'transfer' &&
    props.formData.toAccountId === accountId
  ) {
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
  emit('update:formData', {
    ...props.formData,
    toAmount: amount,
  });
}

// Watch for account changes and auto-select currency
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

// Auto-recalculate toAmount when amount or currencies change
watch(
  () =>
    [
      props.formData.amount,
      props.formData.currency,
      props.formData.toCurrency,
    ] as const,
  ([newAmount, fromCurrency, toCurrency]) => {
    if (
      props.formData.type === 'transfer' &&
      fromCurrency &&
      toCurrency &&
      newAmount > 0
    ) {
      const converted = calculateConvertedAmount(
        newAmount,
        fromCurrency,
        toCurrency,
      );
      if (converted !== props.formData.toAmount) {
        emit('update:formData', {
          ...props.formData,
          toAmount: converted,
        });
      }
    }
  },
);
</script>

<template>
  <form
    class="space-y-4 transition-opacity duration-200"
    :class="isSubmitting && 'opacity-60 pointer-events-none'"
    @submit.prevent="$emit('submit')"
  >
    <!-- Type Tabs -->
    <UTabs
      :model-value="formData.type"
      :items="tabItems"
      @update:model-value="handleTabClick"
    />

    <!-- Swipeable panels -->
    <div
      ref="scrollContainer"
      class="flex overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4"
      @scrollend="handleScrollEnd"
      @scroll="handleScroll"
    >
      <!-- Panel: Expense -->
      <div class="min-w-full snap-start px-4">
        <div class="space-y-4">
          <AmountInput
            :amount="formData.amount"
            :currency="formData.currency"
            :currency-symbol="currencySymbol"
            :available-currencies="availableCurrencies"
            :is-multi-currency="isMultiCurrency"
            :show-insufficient-funds="!hasSufficientFunds"
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

          <!-- Category Grid -->
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
                v-for="category in expenseCategories"
                :key="category.id"
                :category="category"
                :selected="formData.categoryId === category.id"
                size="medium"
                @click="updateField('categoryId', category.id)"
              />
            </div>
          </div>

          <!-- Split Expense Section -->
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
      </div>

      <!-- Panel: Income -->
      <div class="min-w-full snap-start px-4">
        <div class="space-y-4">
          <AmountInput
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

          <!-- Category Grid -->
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
                v-for="category in incomeCategories"
                :key="category.id"
                :category="category"
                :selected="formData.categoryId === category.id"
                size="medium"
                @click="updateField('categoryId', category.id)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Panel: Transfer -->
      <div class="min-w-full snap-start px-4">
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

          <!-- Transfer arrow indicator -->
          <div class="flex justify-center">
            <div
              class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center"
            >
              <UIcon name="arrow_downward" size="sm" class="text-indigo-500" />
            </div>
          </div>

          <!-- Target Account -->
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
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all text-sm',
                  'border',
                  formData.toAccountId === account.id
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
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

            <!-- Target Currency Selector -->
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
                      ? 'bg-indigo-500 text-white'
                      : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark',
                  ]"
                  @click="handleToCurrencyChange(currency)"
                >
                  {{ getCurrencyByCode(currency)?.flag }} {{ currency }}
                </button>
              </div>
            </div>

            <!-- Target Amount (when currencies differ) -->
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
                  formatCurrency(
                    formData.toAmount || 0,
                    formData.toCurrency || '',
                  )
                }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Common fields (outside swipe area) -->

    <!-- Description & Date Row -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <UInput
        :model-value="formData.description"
        label="Комментарий"
        placeholder="Добавьте описание..."
        @update:model-value="updateField('description', $event as string)"
        @keydown.enter.prevent
      />
      <UInput
        :model-value="new Date(formData.date).toISOString().split('T')[0]"
        label="Дата"
        type="date"
        @update:model-value="
          (v: string | number) => {
            const p = String(v).split('-');
            updateField('date', new Date(+p[0], +p[1] - 1, +p[2]).getTime());
          }
        "
      />
    </div>

    <!-- Error Message -->
    <p v-if="error" class="text-xs text-danger">
      {{ error }}
    </p>

    <!-- Submit Button -->
    <UButton
      type="submit"
      variant="primary"
      size="lg"
      full-width
      :loading="isSubmitting"
      :disabled="
        !hasSufficientFunds ||
        (isTransfer
          ? !formData.accountId ||
            !formData.toAccountId ||
            formData.amount <= 0 ||
            !formData.toAmount ||
            formData.toAmount <= 0
          : !formData.accountId || !formData.categoryId || formData.amount <= 0)
      "
    >
      {{
        formData.type === 'transfer'
          ? 'Перевести'
          : formData.type === 'income'
            ? 'Добавить доход'
            : 'Добавить расход'
      }}
    </UButton>
  </form>
</template>
