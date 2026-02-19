# Add Transaction Refactor v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor add-transaction feature to eliminate duplication, delete dead code, redesign TransferPanel with card-based layout, and add balance to IncomePanel.

**Architecture:** Extract shared panel logic into `usePanelState` composable. Redesign TransferPanel with Popover-based account cards and swap button. Clean up dead code in `useTransactionForm` and delete unused `AmountInput.vue`.

**Tech Stack:** Vue 3 Composition API, TypeScript, Tailwind CSS v4 semantic tokens, Reka UI Popover

---

### Task 1: Create `usePanelState` composable

**Files:**
- Create: `frontend/src/features/add-transaction/model/usePanelState.ts`

**Context:** ExpensePanel, IncomePanel, TransferPanel all duplicate these computeds: `selectedAccount`, `availableCurrencies`, `isMultiCurrency`, `currencySymbol`, `currentBalance`, `hasSufficientFunds`, `updateField`, `handleAccountChange`, and a `watch(selectedAccount)` currency guard. Extract all of them.

**Step 1: Create the composable**

```ts
// frontend/src/features/add-transaction/model/usePanelState.ts
import { computed, watch, type WritableComputedRef } from 'vue';
import { getCurrencyByCode } from '@/entities/currency';
import type { AccountWithBalances } from '@/entities/account';
import type { TransactionFormData } from './useTransactionForm';

interface PanelProps {
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
}

interface PanelEmit {
  (e: 'update:formData', value: TransactionFormData): void;
}

export function usePanelState(
  props: PanelProps,
  emit: PanelEmit,
) {
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

  // Auto-correct currency if selected account doesn't support it
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

  return {
    selectedAccount,
    availableCurrencies,
    isMultiCurrency,
    currencySymbol,
    currentBalance,
    hasSufficientFunds,
    updateField,
    handleAccountChange,
  };
}
```

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS (new file, nothing imports it yet)

**Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/model/usePanelState.ts
git commit -m "refactor: extract usePanelState composable from panel duplication"
```

---

### Task 2: Refactor ExpensePanel to use `usePanelState`

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/ExpensePanel.vue`

**Context:** ExpensePanel currently has ~40 lines of duplicated computed/watch logic. Replace with a single `usePanelState(props, emit)` call. Keep split-expense-specific emits and props as-is.

**Step 1: Refactor the script**

Replace the entire `<script setup>` with:

```vue
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
```

Template stays unchanged.

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/ui/ExpensePanel.vue
git commit -m "refactor: use usePanelState in ExpensePanel"
```

---

### Task 3: Refactor IncomePanel to use `usePanelState` + show balance

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/IncomePanel.vue`

**Context:** IncomePanel is nearly identical to ExpensePanel minus split and balance. Now use `usePanelState` and add `currentBalance` to HeroAmount (informational, no insufficient funds warning).

**Step 1: Refactor script and template**

Full replacement:

```vue
<script setup lang="ts">
import type { Category } from '@/entities/category';
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
```

Note: `HeroAmount` receives `:current-balance` but NOT `:show-insufficient-funds` — so it shows "Баланс: X" without warning.

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/ui/IncomePanel.vue
git commit -m "refactor: use usePanelState in IncomePanel, show balance"
```

---

### Task 4: Redesign TransferPanel with card-based layout

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/TransferPanel.vue`

**Context:** Replace the current chip-based layout with two Popover-based account cards connected by a swap button. Use `usePanelState` for source account. Keep all existing transfer logic (target account selection, currency conversion, toAmount auto-calculation).

**Step 1: Rewrite TransferPanel**

Full replacement:

```vue
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

// Popover states
const sourceOpen = computed({ get: () => false, set: () => {} });
const targetOpen = computed({ get: () => false, set: () => {} });

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

  // Handle conflict if same as target
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
```

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/ui/TransferPanel.vue
git commit -m "feat: redesign TransferPanel with card-based account selection and swap"
```

---

### Task 5: Clean up dead code

**Files:**
- Delete: `frontend/src/features/add-transaction/ui/AmountInput.vue`
- Modify: `frontend/src/features/add-transaction/model/useTransactionForm.ts`

**Step 1: Delete AmountInput.vue**

Delete the file `frontend/src/features/add-transaction/ui/AmountInput.vue`.

**Step 2: Clean up useTransactionForm**

Replace the full file with:

```ts
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

const DEFAULT_FORM_DATA: Omit<TransactionFormData, 'date'> = {
  accountId: null,
  categoryId: '',
  amount: 0,
  currency: 'UZS',
  type: 'expense',
  description: '',
  toAccountId: null,
  toAmount: null,
  toCurrency: null,
};

export function useTransactionForm() {
  const formData = ref<TransactionFormData>({
    ...DEFAULT_FORM_DATA,
    date: Date.now(),
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

  function setTransferTarget(toAccountId: string, toCurrency: string) {
    formData.value.toAccountId = toAccountId;
    formData.value.toCurrency = toCurrency;
    if (formData.value.currency === toCurrency) {
      formData.value.toAmount = formData.value.amount;
    }
  }

  function resetForm() {
    formData.value = {
      ...DEFAULT_FORM_DATA,
      date: Date.now(),
    };
  }

  return {
    formData,
    isValid,
    updateField,
    setType,
    setTransferTarget,
    resetForm,
  };
}
```

Changes: extracted `DEFAULT_FORM_DATA` constant, removed unused `setCurrency()` and `setToAmount()`.

**Step 3: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

**Step 4: Commit**

```bash
git rm frontend/src/features/add-transaction/ui/AmountInput.vue
git add frontend/src/features/add-transaction/model/useTransactionForm.ts
git commit -m "refactor: remove dead code (AmountInput, setCurrency, setToAmount), extract DEFAULT_FORM_DATA"
```

---

### Task 6: Verify icons in iconMap

**Files:**
- Possibly modify: `frontend/src/shared/ui/icon/iconMap.ts`

**Context:** TransferPanel now uses `swap_vert` icon. Verify it exists in iconMap. If not, add the mapping.

**Step 1: Check iconMap for swap_vert**

Search `iconMap.ts` for `swap_vert`. If missing, add a mapping (e.g. `swap_vert` → `ArrowUpDown` from lucide).

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

**Step 3: Commit (if changed)**

```bash
git add frontend/src/shared/ui/icon/iconMap.ts
git commit -m "feat: add swap_vert icon mapping"
```
