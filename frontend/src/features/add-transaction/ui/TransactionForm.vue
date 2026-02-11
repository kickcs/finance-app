<script setup lang="ts">
import { computed, watch } from 'vue'
import { UInput, UButton, UTabs, UIcon } from '@/shared/ui'
import { CategoryCard } from '@/entities/category'
import type { Category } from '@/entities/category'
import { getCurrencyByCode } from '@/entities/currency'
import { formatCurrency } from '@/shared/lib/format/currency'
import { useExchangeRates } from '@/shared/api'
import type { TransactionFormData } from '../model/useAddTransaction'
import type { AccountWithBalances } from '@/entities/account'
import { SplitExpenseSection } from '@/features/split-expense'
import type { SplitExpenseData, SplitMethod } from '@/features/split-expense'

const props = defineProps<{
  formData: TransactionFormData
  accounts: AccountWithBalances[]
  expenseCategories: Category[]
  incomeCategories: Category[]
  userCurrency?: string
  isSubmitting?: boolean
  error?: string | null
  splitData?: SplitExpenseData
  splitValidationError?: string | null
}>()

const emit = defineEmits<{
  'update:formData': [value: TransactionFormData]
  submit: []
  addParticipant: [name: string]
  removeParticipant: [id: string]
  updateParticipantAmount: [id: string, amount: number]
  updateParticipantName: [id: string, name: string]
  setSplitMethod: [method: SplitMethod]
  setMyShare: [amount: number]
  setSplitEnabled: [enabled: boolean]
}>()

const tabItems = [
  { id: 'expense', label: 'Расход' },
  { id: 'income', label: 'Доход' },
  { id: 'transfer', label: 'Перевод' },
]

// Exchange rates for auto-conversion
const baseCurrency = computed(() => props.userCurrency || 'UZS')
const { convertBetween } = useExchangeRates(baseCurrency)

const isTransfer = computed(() => props.formData.type === 'transfer')

const categories = computed(() =>
  props.formData.type === 'expense' ? props.expenseCategories : props.incomeCategories
)

const selectedAccount = computed(() =>
  props.accounts.find(a => a.id === props.formData.accountId)
)

const targetAccount = computed(() =>
  props.accounts.find(a => a.id === props.formData.toAccountId)
)

// Available target accounts for transfer
// Include current account if it has multiple currencies (for currency conversion)
const availableTargetAccounts = computed(() => {
  const current = selectedAccount.value
  // If current account has multiple currencies, include it in the list
  if (current && current.balances.length > 1) {
    return props.accounts
  }
  // Otherwise exclude current account
  return props.accounts.filter(a => a.id !== props.formData.accountId)
})

// Get available currencies for selected account
const availableCurrencies = computed(() => {
  if (!selectedAccount.value) return []
  return selectedAccount.value.balances.map(b => b.currency)
})

// Target account currencies - filter out source currency if same account
const targetAccountCurrencies = computed(() => {
  if (!targetAccount.value) return []
  const currencies = targetAccount.value.balances.map(b => b.currency)
  // If same account, exclude the source currency
  if (targetAccount.value.id === props.formData.accountId) {
    return currencies.filter(c => c !== props.formData.currency)
  }
  return currencies
})

// Check if account has multiple currencies
const isMultiCurrency = computed(() => availableCurrencies.value.length > 1)

// Баланс выбранной валюты на исходном счёте
const currentBalance = computed(() => {
  if (!selectedAccount.value) return 0
  return selectedAccount.value.balances.find(
    b => b.currency === props.formData.currency
  )?.balance ?? 0
})

// Достаточно ли средств для списания (для расходов и трансферов)
const hasSufficientFunds = computed(() => {
  if (props.formData.type === 'income') return true
  return props.formData.amount <= currentBalance.value
})

// Show to_amount field when currencies differ
const showToAmountField = computed(() => {
  return isTransfer.value &&
    props.formData.currency &&
    props.formData.toCurrency &&
    props.formData.currency !== props.formData.toCurrency
})

// Get currency symbol for display
const currencySymbol = computed(() => {
  const currency = getCurrencyByCode(props.formData.currency)
  return currency?.symbol || props.formData.currency
})

// Calculate converted amount using exchange rates
function calculateConvertedAmount(amount: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return amount
  if (amount <= 0) return 0
  const converted = convertBetween(amount, fromCurrency, toCurrency)
  return Math.round(converted * 100) / 100
}

function updateField<K extends keyof TransactionFormData>(field: K, value: TransactionFormData[K]) {
  emit('update:formData', { ...props.formData, [field]: value })
}

function handleTypeChange(type: string) {
  emit('update:formData', {
    ...props.formData,
    type: type as 'income' | 'expense' | 'transfer',
    categoryId: type === 'transfer' ? 'transfer' : '',
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
  })
}

function handleAccountChange(accountId: string) {
  const account = props.accounts.find(a => a.id === accountId)
  const firstCurrency = account?.balances[0]?.currency || 'UZS'

  // Reset target account if it's the same and will have no valid currencies
  let updates: Partial<TransactionFormData> = {
    accountId,
    currency: firstCurrency,
  }

  // If in transfer mode and target is the same account, reset toCurrency
  if (props.formData.type === 'transfer' && props.formData.toAccountId === accountId) {
    const otherCurrencies = account?.balances.filter(b => b.currency !== firstCurrency) || []
    if (otherCurrencies.length > 0) {
      updates.toCurrency = otherCurrencies[0].currency
      updates.toAmount = calculateConvertedAmount(props.formData.amount, firstCurrency, otherCurrencies[0].currency)
    } else {
      updates.toAccountId = null
      updates.toCurrency = null
      updates.toAmount = null
    }
  }

  emit('update:formData', { ...props.formData, ...updates })
}

function handleTargetAccountChange(accountId: string) {
  const account = props.accounts.find(a => a.id === accountId)

  // If same account, pick a different currency than the source
  let firstCurrency: string
  if (accountId === props.formData.accountId) {
    const otherCurrencies = account?.balances.filter(b => b.currency !== props.formData.currency) || []
    firstCurrency = otherCurrencies[0]?.currency || account?.balances[0]?.currency || 'UZS'
  } else {
    firstCurrency = account?.balances[0]?.currency || 'UZS'
  }

  // Calculate converted amount
  const toAmount = calculateConvertedAmount(props.formData.amount, props.formData.currency, firstCurrency)

  emit('update:formData', {
    ...props.formData,
    toAccountId: accountId,
    toCurrency: firstCurrency,
    toAmount,
  })
}

function handleToCurrencyChange(currency: string) {
  // Calculate converted amount
  const toAmount = calculateConvertedAmount(props.formData.amount, props.formData.currency, currency)

  emit('update:formData', {
    ...props.formData,
    toCurrency: currency,
    toAmount,
  })
}

function handleToAmountChange(amount: number) {
  emit('update:formData', {
    ...props.formData,
    toAmount: amount,
  })
}

// Watch for account changes and auto-select currency
watch(selectedAccount, (account) => {
  if (account && account.balances.length > 0) {
    if (!account.balances.some(b => b.currency === props.formData.currency)) {
      updateField('currency', account.balances[0].currency)
    }
  }
}, { immediate: true })

// Auto-recalculate toAmount when amount or currencies change
watch(
  () => [props.formData.amount, props.formData.currency, props.formData.toCurrency] as const,
  ([newAmount, fromCurrency, toCurrency]) => {
    if (props.formData.type === 'transfer' && fromCurrency && toCurrency && newAmount > 0) {
      const converted = calculateConvertedAmount(newAmount, fromCurrency, toCurrency)
      if (converted !== props.formData.toAmount) {
        emit('update:formData', {
          ...props.formData,
          toAmount: converted,
        })
      }
    }
  }
)
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
      @update:model-value="handleTypeChange"
    />

    <!-- Amount Input with Currency Selector -->
    <div class="space-y-1.5">
      <label v-if="isTransfer" class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Сумма списания
      </label>
      <div class="flex gap-2">
        <!-- Currency Selector (only for multi-currency accounts) -->
        <div v-if="isMultiCurrency" class="relative shrink-0">
          <select
            :value="formData.currency"
            class="appearance-none h-full bg-surface-light dark:bg-surface-dark rounded-lg px-2.5 pr-7 text-sm font-medium border border-border-light dark:border-border-dark focus:outline-none focus:ring-2 focus:ring-primary"
            @change="updateField('currency', ($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="currency in availableCurrencies"
              :key="currency"
              :value="currency"
            >
              {{ getCurrencyByCode(currency)?.flag }} {{ currency }}
            </option>
          </select>
          <UIcon
            name="expand_more"
            size="sm"
            class="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </div>

        <!-- Amount Input -->
        <div class="flex-1">
          <UInput
            :model-value="String(formData.amount || '')"
            placeholder="0"
            variant="currency"
            type="number"
            :suffix="currencySymbol"
            @update:model-value="updateField('amount', Number($event) || 0)"
            @keydown.enter.prevent
          />
        </div>
      </div>
      <!-- Предупреждение о недостатке средств -->
      <p
        v-if="!hasSufficientFunds && formData.amount > 0"
        class="text-xs text-warning"
      >
        Недостаточно средств. Баланс: {{ formatCurrency(currentBalance, formData.currency) }}
      </p>
    </div>

    <!-- Account Selector -->
    <div class="space-y-2">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        {{ isTransfer ? 'Со счёта' : 'Счёт' }}
      </label>
      <div class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          v-for="account in accounts"
          :key="account.id"
          type="button"
          :class="[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all text-sm',
            'border',
            formData.accountId === account.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-gray-200 dark:border-gray-700 text-text-secondary-light dark:text-text-secondary-dark',
          ]"
          @click="handleAccountChange(account.id)"
        >
          <span
            class="w-2.5 h-2.5 rounded-full"
            :style="{ backgroundColor: account.color }"
          />
          {{ account.name }}
          <span
            v-if="account.balances.length > 1"
            class="text-xs opacity-60"
          >
            ({{ account.balances.length }})
          </span>
        </button>
      </div>
    </div>

    <!-- Transfer Target Account (only for transfers) -->
    <div v-if="isTransfer" class="space-y-2">
      <!-- Transfer arrow indicator -->
      <div class="flex justify-center">
        <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <UIcon name="arrow_downward" size="sm" class="text-indigo-500" />
        </div>
      </div>

      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
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
          <span v-if="account.id === formData.accountId" class="text-xs opacity-60">
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

      <!-- Target Currency Selector (if target account has multiple currencies or same account) -->
      <div v-if="targetAccount && targetAccountCurrencies.length > 0" class="mt-1.5">
        <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block">
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

      <!-- Target Amount (when currencies differ - for conversion) -->
      <div v-if="showToAmountField" class="mt-2">
        <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block">
          Сумма зачисления ({{ formData.toCurrency }})
        </label>
        <UInput
          :model-value="String(formData.toAmount || '')"
          placeholder="0"
          variant="currency"
          type="number"
          :suffix="getCurrencyByCode(formData.toCurrency ?? '')?.symbol || formData.toCurrency || ''"
          @update:model-value="handleToAmountChange(Number($event) || 0)"
          @keydown.enter.prevent
        />
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5">
          {{ formatCurrency(formData.amount, formData.currency) }} → {{ formatCurrency(formData.toAmount || 0, formData.toCurrency || '') }}
        </p>
      </div>
    </div>

    <!-- Category Horizontal Scroll (hide for transfers) -->
    <div v-if="!isTransfer" class="space-y-2">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Категория
      </label>
      <div class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
        <CategoryCard
          v-for="category in categories"
          :key="category.id"
          :category="category"
          :selected="formData.categoryId === category.id"
          size="large"
          class="snap-start shrink-0"
          @click="updateField('categoryId', category.id)"
        />
      </div>
    </div>

    <!-- Split Expense Section (only for expenses) -->
    <SplitExpenseSection
      v-if="formData.type === 'expense' && splitData"
      :total-amount="formData.amount"
      :currency="formData.currency"
      :split-data="splitData"
      :validation-error="splitValidationError"
      @add-participant="$emit('addParticipant', $event)"
      @remove-participant="$emit('removeParticipant', $event)"
      @update-participant-amount="(id, amount) => $emit('updateParticipantAmount', id, amount)"
      @update-participant-name="(id, name) => $emit('updateParticipantName', id, name)"
      @set-method="$emit('setSplitMethod', $event)"
      @set-my-share="$emit('setMyShare', $event)"
      @set-enabled="$emit('setSplitEnabled', $event)"
    />

    <!-- Description -->
    <UInput
      :model-value="formData.description"
      label="Комментарий"
      placeholder="Добавьте описание..."
      @update:model-value="updateField('description', $event as string)"
      @keydown.enter.prevent
    />

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
      :disabled="!hasSufficientFunds || (isTransfer
        ? (!formData.accountId || !formData.toAccountId || formData.amount <= 0 || !formData.toAmount || formData.toAmount <= 0)
        : (!formData.accountId || !formData.categoryId || formData.amount <= 0))"
    >
      {{ formData.type === 'transfer' ? 'Перевести' : (formData.type === 'income' ? 'Добавить доход' : 'Добавить расход') }}
    </UButton>
  </form>
</template>
