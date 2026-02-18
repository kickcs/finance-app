# add-transaction Рефакторинг: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Декомпозировать `features/add-transaction` на три независимых панели, три composable и тонкий оркестратор TransactionForm (~150 строк).

**Architecture:** `TransactionForm.vue` делегирует: форм-стейт → `useTransactionForm`, scroll-snap → `useScrollableTabs`, API → `useSubmitTransaction`, рендеринг → `ExpensePanel` / `IncomePanel` / `TransferPanel`. `AddTransactionPage.vue` обновляет импорты. Старый `useAddTransaction.ts` удаляется.

**Tech Stack:** Vue 3 Composition API, TypeScript, Tailwind CSS v4 (семантические токены), TanStack Vue Query

---

### Task 1: Создать `useTransactionForm.ts`

**Files:**
- Create: `frontend/src/features/add-transaction/model/useTransactionForm.ts`

**Step 1: Создать файл с форм-стейтом и валидацией**

```typescript
// frontend/src/features/add-transaction/model/useTransactionForm.ts
import { ref, computed } from 'vue';

export interface TransactionFormData {
  accountId: string | null;
  categoryId: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  date: number;
  toAccountId: string | null;
  toAmount: number | null;
  toCurrency: string | null;
}

export function useTransactionForm() {
  const formData = ref<TransactionFormData>({
    accountId: null,
    categoryId: '',
    amount: 0,
    currency: 'UZS',
    type: 'expense',
    description: '',
    date: Date.now(),
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
  });

  const isValid = computed(() => {
    const base =
      formData.value.accountId !== null &&
      formData.value.amount > 0 &&
      formData.value.currency !== '';

    if (formData.value.type === 'transfer') {
      return (
        base &&
        formData.value.toAccountId !== null &&
        (formData.value.toAccountId !== formData.value.accountId ||
          formData.value.currency !== formData.value.toCurrency) &&
        formData.value.toCurrency !== null &&
        formData.value.toAmount !== null &&
        formData.value.toAmount > 0
      );
    }

    return base && formData.value.categoryId !== '';
  });

  function updateField<K extends keyof TransactionFormData>(
    field: K,
    value: TransactionFormData[K],
  ) {
    formData.value[field] = value;
  }

  function setType(type: 'income' | 'expense' | 'transfer') {
    formData.value.type = type;
    formData.value.categoryId = type === 'transfer' ? 'transfer' : '';
    if (type !== 'transfer') {
      formData.value.toAccountId = null;
      formData.value.toAmount = null;
      formData.value.toCurrency = null;
    }
  }

  function setCurrency(currency: string) {
    formData.value.currency = currency;
  }

  function setTransferTarget(toAccountId: string, toCurrency: string) {
    formData.value.toAccountId = toAccountId;
    formData.value.toCurrency = toCurrency;
    if (formData.value.currency === toCurrency) {
      formData.value.toAmount = formData.value.amount;
    }
  }

  function setToAmount(amount: number) {
    formData.value.toAmount = amount;
  }

  function resetForm() {
    formData.value = {
      accountId: null,
      categoryId: '',
      amount: 0,
      currency: 'UZS',
      type: 'expense',
      description: '',
      date: Date.now(),
      toAccountId: null,
      toAmount: null,
      toCurrency: null,
    };
  }

  return {
    formData,
    isValid,
    updateField,
    setType,
    setCurrency,
    setTransferTarget,
    setToAmount,
    resetForm,
  };
}
```

**Step 2: Проверить сборку**

```bash
cd frontend && bun run build
```

Ожидаемый результат: сборка проходит без ошибок.

**Step 3: Коммит**

```bash
git add frontend/src/features/add-transaction/model/useTransactionForm.ts
git commit -m "feat: extract useTransactionForm composable from useAddTransaction"
```

---

### Task 2: Создать `useSubmitTransaction.ts`

**Files:**
- Create: `frontend/src/features/add-transaction/model/useSubmitTransaction.ts`

**Step 1: Создать файл с API-логикой**

```typescript
// frontend/src/features/add-transaction/model/useSubmitTransaction.ts
import { ref } from 'vue';
import { transactionsApi } from '@/entities/transaction';
import { queryClient } from '@/shared/api/queryClient';
import {
  invalidateTransactionRelated,
  invalidateAccountRelated,
} from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import type { TransactionFormData } from './useTransactionForm';

export function useSubmitTransaction() {
  const { toast } = useToast();
  const isSubmitting = ref(false);
  const error = ref<string | null>(null);

  async function submit(
    userId: string,
    formData: TransactionFormData,
  ): Promise<string | null> {
    isSubmitting.value = true;
    error.value = null;

    try {
      const isTransfer = formData.type === 'transfer';
      const categoryId = isTransfer ? 'transfer' : formData.categoryId;

      const data = await transactionsApi.create({
        user_id: userId,
        account_id: formData.accountId!,
        category_id: categoryId,
        amount: formData.amount,
        currency: formData.currency,
        type: formData.type,
        description: formData.description || null,
        date: new Date(formData.date).toISOString(),
        to_account_id: isTransfer ? formData.toAccountId : null,
        to_amount: isTransfer ? formData.toAmount : null,
        to_currency: isTransfer ? formData.toCurrency : null,
      });

      await Promise.all([
        invalidateTransactionRelated(queryClient, userId),
        invalidateAccountRelated(queryClient, userId),
      ]);

      const typeLabels = {
        income: 'Доход',
        expense: 'Расход',
        transfer: 'Перевод',
      };
      toast({
        title: `${typeLabels[formData.type]} добавлен`,
        variant: 'success',
        duration: 2500,
      });

      return data.id;
    } catch (e) {
      error.value = 'Не удалось добавить транзакцию';
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить транзакцию',
        variant: 'error',
        duration: 4000,
      });
      console.error('Failed to add transaction:', e);
      return null;
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
    isSubmitting,
    error,
    submit,
  };
}
```

**Step 2: Проверить сборку**

```bash
cd frontend && bun run build
```

**Step 3: Коммит**

```bash
git add frontend/src/features/add-transaction/model/useSubmitTransaction.ts
git commit -m "feat: extract useSubmitTransaction composable"
```

---

### Task 3: Создать `useScrollableTabs.ts`

**Files:**
- Create: `frontend/src/features/add-transaction/model/useScrollableTabs.ts`

**Step 1: Создать файл**

```typescript
// frontend/src/features/add-transaction/model/useScrollableTabs.ts
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { Ref } from 'vue';

export const TRANSACTION_TYPE_ORDER = ['expense', 'income', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPE_ORDER)[number];

export function useScrollableTabs(
  type: Ref<TransactionType>,
  onTypeChange: (type: TransactionType) => void,
) {
  const scrollContainer = ref<HTMLElement | null>(null);
  let isScrollingProgrammatically = false;
  let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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

    scrollContainer.value.addEventListener('scrollend', resetProgrammaticFlag, {
      once: true,
    });
    setTimeout(resetProgrammaticFlag, 600);
  }

  function detectPanelFromScroll() {
    if (isScrollingProgrammatically || !scrollContainer.value) return;

    const container = scrollContainer.value;
    const panelWidth = container.offsetWidth;
    const scrollLeft = container.scrollLeft;
    const index = Math.round(scrollLeft / panelWidth);
    const clampedIndex = Math.max(
      0,
      Math.min(index, TRANSACTION_TYPE_ORDER.length - 1),
    );
    const newType = TRANSACTION_TYPE_ORDER[clampedIndex];

    if (newType !== type.value) {
      onTypeChange(newType);
    }
  }

  function handleTabClick(clickedType: string) {
    const index = TRANSACTION_TYPE_ORDER.indexOf(
      clickedType as TransactionType,
    );
    if (index === -1) return;
    onTypeChange(clickedType as TransactionType);
    scrollToPanel(index);
  }

  function handleScrollEnd() {
    detectPanelFromScroll();
  }

  function handleScroll() {
    if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
    scrollDebounceTimer = setTimeout(() => {
      detectPanelFromScroll();
    }, 150);
  }

  onMounted(() => {
    nextTick(() => {
      const index = TRANSACTION_TYPE_ORDER.indexOf(type.value);
      if (index > 0) {
        scrollToPanel(index, false);
      }
    });
  });

  onUnmounted(() => {
    if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
  });

  watch(type, (newType) => {
    const index = TRANSACTION_TYPE_ORDER.indexOf(newType);
    if (index === -1 || !scrollContainer.value) return;

    const panelWidth = scrollContainer.value.offsetWidth;
    const currentIndex = Math.round(
      scrollContainer.value.scrollLeft / panelWidth,
    );

    if (currentIndex !== index) {
      scrollToPanel(index);
    }
  });

  return {
    scrollContainer,
    handleTabClick,
    handleScrollEnd,
    handleScroll,
  };
}
```

**Step 2: Проверить сборку**

```bash
cd frontend && bun run build
```

**Step 3: Коммит**

```bash
git add frontend/src/features/add-transaction/model/useScrollableTabs.ts
git commit -m "feat: extract useScrollableTabs composable"
```

---

### Task 4: Создать `ExpensePanel.vue`

**Files:**
- Create: `frontend/src/features/add-transaction/ui/ExpensePanel.vue`

**Step 1: Создать компонент**

```vue
<!-- frontend/src/features/add-transaction/ui/ExpensePanel.vue -->
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
      if (!account.balances.some((b) => b.currency === props.formData.currency)) {
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
```

**Step 2: Проверить сборку**

```bash
cd frontend && bun run build
```

**Step 3: Коммит**

```bash
git add frontend/src/features/add-transaction/ui/ExpensePanel.vue
git commit -m "feat: add ExpensePanel component"
```

---

### Task 5: Создать `IncomePanel.vue`

**Files:**
- Create: `frontend/src/features/add-transaction/ui/IncomePanel.vue`

**Step 1: Создать компонент**

```vue
<!-- frontend/src/features/add-transaction/ui/IncomePanel.vue -->
<script setup lang="ts">
import { computed, watch } from 'vue';
import { CategoryCard } from '@/entities/category';
import type { Category } from '@/entities/category';
import { getCurrencyByCode } from '@/entities/currency';
import type { AccountWithBalances } from '@/entities/account';
import type { TransactionFormData } from '../model/useTransactionForm';
import AmountInput from './AmountInput.vue';
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
      if (!account.balances.some((b) => b.currency === props.formData.currency)) {
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
  </div>
</template>
```

**Step 2: Проверить сборку**

```bash
cd frontend && bun run build
```

**Step 3: Коммит**

```bash
git add frontend/src/features/add-transaction/ui/IncomePanel.vue
git commit -m "feat: add IncomePanel component"
```

---

### Task 6: Создать `TransferPanel.vue`

**Files:**
- Create: `frontend/src/features/add-transaction/ui/TransferPanel.vue`

**Замечание:** В оригинале использовался hardcoded `border-indigo-500 bg-indigo-500/10 text-indigo-500`. Здесь заменяем на `border-primary bg-primary/10 text-primary` (семантические токены как в `AccountSelector.vue`).

**Step 1: Создать компонент**

```vue
<!-- frontend/src/features/add-transaction/ui/TransferPanel.vue -->
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
      const converted = calculateConvertedAmount(newAmount, fromCurrency, toCurrency);
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
```

**Step 2: Проверить сборку**

```bash
cd frontend && bun run build
```

**Step 3: Коммит**

```bash
git add frontend/src/features/add-transaction/ui/TransferPanel.vue
git commit -m "feat: add TransferPanel component (fix hardcoded indigo tokens → primary)"
```

---

### Task 7: Рефакторинг `TransactionForm.vue`

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue`

**Step 1: Заменить содержимое файла**

Полностью заменить `TransactionForm.vue` на тонкий оркестратор:

```vue
<!-- frontend/src/features/add-transaction/ui/TransactionForm.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { UInput, UButton, UTabs } from '@/shared/ui';
import type { Category } from '@/entities/category';
import type { AccountWithBalances } from '@/entities/account';
import type { SplitExpenseData, SplitMethod } from '@/features/split-expense';
import type { TransactionFormData } from '../model/useTransactionForm';
import {
  useScrollableTabs,
  TRANSACTION_TYPE_ORDER,
} from '../model/useScrollableTabs';
import ExpensePanel from './ExpensePanel.vue';
import IncomePanel from './IncomePanel.vue';
import TransferPanel from './TransferPanel.vue';

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
  autofocusAmount?: boolean;
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

const type = computed(() => props.formData.type);

function applyTypeChange(newType: string) {
  emit('update:formData', {
    ...props.formData,
    type: newType as 'income' | 'expense' | 'transfer',
    categoryId: newType === 'transfer' ? 'transfer' : '',
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
  });
}

const { scrollContainer, handleTabClick, handleScrollEnd, handleScroll } =
  useScrollableTabs(type, applyTypeChange);

const isTransfer = computed(() => props.formData.type === 'transfer');

const isSubmitDisabled = computed(() => {
  if (isTransfer.value) {
    return (
      !props.formData.accountId ||
      !props.formData.toAccountId ||
      props.formData.amount <= 0 ||
      !props.formData.toAmount ||
      props.formData.toAmount <= 0
    );
  }
  return (
    !props.formData.accountId ||
    !props.formData.categoryId ||
    props.formData.amount <= 0
  );
});

const submitLabel = computed(() => {
  if (props.formData.type === 'transfer') return 'Перевести';
  if (props.formData.type === 'income') return 'Добавить доход';
  return 'Добавить расход';
});
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
      <div
        v-for="panelType in TRANSACTION_TYPE_ORDER"
        :key="panelType"
        class="min-w-full snap-start px-4"
      >
        <ExpensePanel
          v-if="panelType === 'expense'"
          :form-data="formData"
          :accounts="accounts"
          :categories="expenseCategories"
          :split-data="splitData"
          :split-validation-error="splitValidationError"
          :autofocus-amount="autofocusAmount"
          @update:form-data="$emit('update:formData', $event)"
          @add-participant="$emit('addParticipant', $event)"
          @remove-participant="$emit('removeParticipant', $event)"
          @update-participant-amount="
            (id, amount) => $emit('updateParticipantAmount', id, amount)
          "
          @update-participant-name="
            (id, name) => $emit('updateParticipantName', id, name)
          "
          @set-split-method="$emit('setSplitMethod', $event)"
          @set-my-share="$emit('setMyShare', $event)"
          @set-split-enabled="$emit('setSplitEnabled', $event)"
        />
        <IncomePanel
          v-else-if="panelType === 'income'"
          :form-data="formData"
          :accounts="accounts"
          :categories="incomeCategories"
          @update:form-data="$emit('update:formData', $event)"
        />
        <TransferPanel
          v-else-if="panelType === 'transfer'"
          :form-data="formData"
          :accounts="accounts"
          :user-currency="userCurrency"
          @update:form-data="$emit('update:formData', $event)"
        />
      </div>
    </div>

    <!-- Description & Date -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <UInput
        :model-value="formData.description"
        label="Комментарий"
        placeholder="Добавьте описание..."
        @update:model-value="
          $emit('update:formData', {
            ...formData,
            description: $event as string,
          })
        "
        @keydown.enter.prevent
      />
      <UInput
        :model-value="new Date(formData.date).toISOString().split('T')[0]"
        label="Дата"
        type="date"
        @update:model-value="
          (v: string | number) => {
            const p = String(v).split('-');
            $emit('update:formData', {
              ...formData,
              date: new Date(+p[0], +p[1] - 1, +p[2]).getTime(),
            });
          }
        "
      />
    </div>

    <!-- Error -->
    <p v-if="error" class="text-xs text-danger">{{ error }}</p>

    <!-- Submit -->
    <UButton
      type="submit"
      variant="primary"
      size="lg"
      full-width
      :loading="isSubmitting"
      :disabled="isSubmitDisabled"
    >
      {{ submitLabel }}
    </UButton>
  </form>
</template>
```

**Step 2: Проверить сборку**

```bash
cd frontend && bun run build
```

Если сборка прошла — старый `TransactionForm.vue` полностью заменён.

**Step 3: Коммит**

```bash
git add frontend/src/features/add-transaction/ui/TransactionForm.vue
git commit -m "refactor: TransactionForm → тонкий оркестратор с 3 панелями"
```

---

### Task 8: Обновить `index.ts` и `AddTransactionPage.vue`

**Files:**
- Modify: `frontend/src/features/add-transaction/index.ts`
- Modify: `frontend/src/pages/transactions/new/AddTransactionPage.vue`

**Step 1: Обновить `index.ts`**

```typescript
// frontend/src/features/add-transaction/index.ts
export { default as TransactionForm } from './ui/TransactionForm.vue';
export { useTransactionForm } from './model/useTransactionForm';
export { useSubmitTransaction } from './model/useSubmitTransaction';
export type { TransactionFormData } from './model/useTransactionForm';
```

**Step 2: Обновить `AddTransactionPage.vue`**

В `<script setup>` заменить:

```typescript
// Было:
import { TransactionForm, useAddTransaction } from '@/features/add-transaction';
// ...
const { formData, isSubmitting, error, addTransaction, setType, updateField } =
  useAddTransaction();

// Стало:
import {
  TransactionForm,
  useTransactionForm,
  useSubmitTransaction,
} from '@/features/add-transaction';
// ...
const { formData, setType, updateField } = useTransactionForm();
const { isSubmitting, error, submit } = useSubmitTransaction();
```

В `handleSubmit` заменить:

```typescript
// Было:
const transactionId = await addTransaction(userId.value);

// Стало:
const transactionId = await submit(userId.value, formData.value);
```

**Step 3: Проверить сборку**

```bash
cd frontend && bun run build
```

**Step 4: Коммит**

```bash
git add frontend/src/features/add-transaction/index.ts \
        frontend/src/pages/transactions/new/AddTransactionPage.vue
git commit -m "refactor: обновить index.ts и AddTransactionPage под новые composables"
```

---

### Task 9: Удалить старый `useAddTransaction.ts`

**Files:**
- Delete: `frontend/src/features/add-transaction/model/useAddTransaction.ts`

**Step 1: Убедиться, что нигде не импортируется старый файл**

```bash
grep -r "useAddTransaction" frontend/src --include="*.ts" --include="*.vue"
```

Ожидаемый результат: **нет совпадений** (файл больше не импортируется).

**Step 2: Удалить файл**

```bash
rm frontend/src/features/add-transaction/model/useAddTransaction.ts
```

**Step 3: Проверить финальную сборку**

```bash
cd frontend && bun run build
```

Ожидаемый результат: сборка проходит без ошибок.

**Step 4: Финальный коммит**

```bash
git add -A
git commit -m "refactor: удалить useAddTransaction.ts — заменён useTransactionForm + useSubmitTransaction"
```
