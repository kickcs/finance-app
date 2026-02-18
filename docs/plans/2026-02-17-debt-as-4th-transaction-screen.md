# Долг как 4-й экран транзакции — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move debt creation from a separate page into a 4th swipeable panel in the transaction creation form, and decompose TransactionForm.vue into per-panel components.

**Architecture:** Extract each of the 3 existing panels (Expense, Income, Transfer) into standalone components, add a 4th DebtPanel that integrates `useCreateDebt` logic. TransactionForm.vue becomes an orchestrator (tabs, swipe, submit dispatch). Remove the standalone `/debts/new` route.

**Tech Stack:** Vue 3, TypeScript, Tailwind CSS v4, Reka UI, TanStack Vue Query

---

### Task 1: Create ExpensePanel.vue

**Files:**
- Create: `frontend/src/features/add-transaction/ui/ExpensePanel.vue`
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue`

**Step 1: Create ExpensePanel component**

Extract lines 397-459 from TransactionForm.vue template into a new component. Props receive everything it needs, emits bubble up.

```vue
<script setup lang="ts">
import type { TransactionFormData } from '../model/useAddTransaction';
import type { AccountWithBalances } from '@/entities/account';
import type { Category } from '@/entities/category';
import { CategoryCard } from '@/entities/category';
import { SplitExpenseSection } from '@/features/split-expense';
import type { SplitExpenseData, SplitMethod } from '@/features/split-expense';
import AmountInput from './AmountInput.vue';
import AccountSelector from './AccountSelector.vue';

defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  expenseCategories: Category[];
  currencySymbol: string;
  availableCurrencies: string[];
  isMultiCurrency: boolean;
  hasSufficientFunds: boolean;
  currentBalance: number;
  splitData?: SplitExpenseData;
  splitValidationError?: string | null;
}>();

const emit = defineEmits<{
  'update:amount': [value: number];
  'update:currency': [value: string];
  'update:categoryId': [value: string];
  'select-account': [accountId: string];
  addParticipant: [name: string];
  removeParticipant: [id: string];
  updateParticipantAmount: [id: string, amount: number];
  updateParticipantName: [id: string, name: string];
  setSplitMethod: [method: SplitMethod];
  setMyShare: [amount: number];
  setSplitEnabled: [enabled: boolean];
}>();
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
      @update:amount="emit('update:amount', $event)"
      @update:currency="emit('update:currency', $event)"
    />

    <AccountSelector
      :accounts="accounts"
      :selected-id="formData.accountId"
      label="Счёт"
      @select="emit('select-account', $event)"
    />

    <div class="space-y-2">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Категория
      </label>
      <div class="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[168px] overflow-y-auto">
        <CategoryCard
          v-for="category in expenseCategories"
          :key="category.id"
          :category="category"
          :selected="formData.categoryId === category.id"
          size="medium"
          @click="emit('update:categoryId', category.id)"
        />
      </div>
    </div>

    <SplitExpenseSection
      v-if="splitData"
      :total-amount="formData.amount"
      :currency="formData.currency"
      :split-data="splitData"
      :validation-error="splitValidationError"
      @add-participant="emit('addParticipant', $event)"
      @remove-participant="emit('removeParticipant', $event)"
      @update-participant-amount="(id, amount) => emit('updateParticipantAmount', id, amount)"
      @update-participant-name="(id, name) => emit('updateParticipantName', id, name)"
      @set-method="emit('setSplitMethod', $event)"
      @set-my-share="emit('setMyShare', $event)"
      @set-enabled="emit('setSplitEnabled', $event)"
    />
  </div>
</template>
```

**Step 2: Replace inline template in TransactionForm.vue**

Replace the `<!-- Panel: Expense -->` section (lines 397-459) with:
```vue
<ExpensePanel
  :form-data="formData"
  :accounts="accounts"
  :expense-categories="expenseCategories"
  :currency-symbol="currencySymbol"
  :available-currencies="availableCurrencies"
  :is-multi-currency="isMultiCurrency"
  :has-sufficient-funds="hasSufficientFunds"
  :current-balance="currentBalance"
  :split-data="splitData"
  :split-validation-error="splitValidationError"
  @update:amount="updateField('amount', $event)"
  @update:currency="updateField('currency', $event)"
  @update:category-id="updateField('categoryId', $event)"
  @select-account="handleAccountChange"
  @add-participant="$emit('addParticipant', $event)"
  @remove-participant="$emit('removeParticipant', $event)"
  @update-participant-amount="(id, amount) => $emit('updateParticipantAmount', id, amount)"
  @update-participant-name="(id, name) => $emit('updateParticipantName', id, name)"
  @set-split-method="$emit('setSplitMethod', $event)"
  @set-my-share="$emit('setMyShare', $event)"
  @set-split-enabled="$emit('setSplitEnabled', $event)"
/>
```

Add import at top of script: `import ExpensePanel from './ExpensePanel.vue';`

**Step 3: Verify build**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`
Expected: Build succeeds without errors

**Step 4: Commit**

```bash
git add frontend/src/features/add-transaction/ui/ExpensePanel.vue frontend/src/features/add-transaction/ui/TransactionForm.vue
git commit -m "refactor: extract ExpensePanel from TransactionForm"
```

---

### Task 2: Create IncomePanel.vue

**Files:**
- Create: `frontend/src/features/add-transaction/ui/IncomePanel.vue`
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue`

**Step 1: Create IncomePanel component**

Extract lines 462-502 template. Simpler than expense — no split, no balance check.

```vue
<script setup lang="ts">
import type { TransactionFormData } from '../model/useAddTransaction';
import type { AccountWithBalances } from '@/entities/account';
import type { Category } from '@/entities/category';
import { CategoryCard } from '@/entities/category';
import AmountInput from './AmountInput.vue';
import AccountSelector from './AccountSelector.vue';

defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  incomeCategories: Category[];
  currencySymbol: string;
  availableCurrencies: string[];
  isMultiCurrency: boolean;
}>();

const emit = defineEmits<{
  'update:amount': [value: number];
  'update:currency': [value: string];
  'update:categoryId': [value: string];
  'select-account': [accountId: string];
}>();
</script>

<template>
  <div class="space-y-4">
    <AmountInput
      :amount="formData.amount"
      :currency="formData.currency"
      :currency-symbol="currencySymbol"
      :available-currencies="availableCurrencies"
      :is-multi-currency="isMultiCurrency"
      @update:amount="emit('update:amount', $event)"
      @update:currency="emit('update:currency', $event)"
    />

    <AccountSelector
      :accounts="accounts"
      :selected-id="formData.accountId"
      label="Счёт"
      @select="emit('select-account', $event)"
    />

    <div class="space-y-2">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Категория
      </label>
      <div class="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[168px] overflow-y-auto">
        <CategoryCard
          v-for="category in incomeCategories"
          :key="category.id"
          :category="category"
          :selected="formData.categoryId === category.id"
          size="medium"
          @click="emit('update:categoryId', category.id)"
        />
      </div>
    </div>
  </div>
</template>
```

**Step 2: Replace in TransactionForm.vue**

Replace `<!-- Panel: Income -->` section with:
```vue
<IncomePanel
  :form-data="formData"
  :accounts="accounts"
  :income-categories="incomeCategories"
  :currency-symbol="currencySymbol"
  :available-currencies="availableCurrencies"
  :is-multi-currency="isMultiCurrency"
  @update:amount="updateField('amount', $event)"
  @update:currency="updateField('currency', $event)"
  @update:category-id="updateField('categoryId', $event)"
  @select-account="handleAccountChange"
/>
```

Add import: `import IncomePanel from './IncomePanel.vue';`

**Step 3: Verify build**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/features/add-transaction/ui/IncomePanel.vue frontend/src/features/add-transaction/ui/TransactionForm.vue
git commit -m "refactor: extract IncomePanel from TransactionForm"
```

---

### Task 3: Create TransferPanel.vue

**Files:**
- Create: `frontend/src/features/add-transaction/ui/TransferPanel.vue`
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue`

**Step 1: Create TransferPanel component**

Extract lines 504-639 template. This is the most complex panel with target account, currency selection, and conversion.

```vue
<script setup lang="ts">
import { UInput, UIcon } from '@/shared/ui';
import { getCurrencyByCode } from '@/entities/currency';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { TransactionFormData } from '../model/useAddTransaction';
import type { AccountWithBalances } from '@/entities/account';
import AmountInput from './AmountInput.vue';
import AccountSelector from './AccountSelector.vue';

defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  currencySymbol: string;
  availableCurrencies: string[];
  isMultiCurrency: boolean;
  hasSufficientFunds: boolean;
  currentBalance: number;
  availableTargetAccounts: AccountWithBalances[];
  targetAccount: AccountWithBalances | undefined;
  targetAccountCurrencies: string[];
  showToAmountField: boolean;
}>();

const emit = defineEmits<{
  'update:amount': [value: number];
  'update:currency': [value: string];
  'select-account': [accountId: string];
  'select-target-account': [accountId: string];
  'update:toCurrency': [currency: string];
  'update:toAmount': [amount: number];
}>();
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
      @update:amount="emit('update:amount', $event)"
      @update:currency="emit('update:currency', $event)"
    />

    <AccountSelector
      :accounts="accounts"
      :selected-id="formData.accountId"
      label="Со счёта"
      @select="emit('select-account', $event)"
    />

    <!-- Transfer arrow indicator -->
    <div class="flex justify-center">
      <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
        <UIcon name="arrow_downward" size="sm" class="text-indigo-500" />
      </div>
    </div>

    <!-- Target Account -->
    <div class="space-y-2">
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
          @click="emit('select-target-account', account.id)"
        >
          <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: account.color }" />
          {{ account.name }}
          <span v-if="account.id === formData.accountId" class="text-xs opacity-60">(конв.)</span>
          <span v-else-if="account.balances.length > 1" class="text-xs opacity-60">({{ account.balances.length }})</span>
        </button>
      </div>

      <!-- Target Currency Selector -->
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
            @click="emit('update:toCurrency', currency)"
          >
            {{ getCurrencyByCode(currency)?.flag }} {{ currency }}
          </button>
        </div>
      </div>

      <!-- Target Amount -->
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
          @update:model-value="emit('update:toAmount', Number($event) || 0)"
          @keydown.enter.prevent
        />
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5">
          {{ formatCurrency(formData.amount, formData.currency) }} →
          {{ formatCurrency(formData.toAmount || 0, formData.toCurrency || '') }}
        </p>
      </div>
    </div>
  </div>
</template>
```

**Step 2: Replace in TransactionForm.vue**

Replace `<!-- Panel: Transfer -->` section with:
```vue
<TransferPanel
  :form-data="formData"
  :accounts="accounts"
  :currency-symbol="currencySymbol"
  :available-currencies="availableCurrencies"
  :is-multi-currency="isMultiCurrency"
  :has-sufficient-funds="hasSufficientFunds"
  :current-balance="currentBalance"
  :available-target-accounts="availableTargetAccounts"
  :target-account="targetAccount"
  :target-account-currencies="targetAccountCurrencies"
  :show-to-amount-field="showToAmountField"
  @update:amount="updateField('amount', $event)"
  @update:currency="updateField('currency', $event)"
  @select-account="handleAccountChange"
  @select-target-account="handleTargetAccountChange"
  @update:to-currency="handleToCurrencyChange"
  @update:to-amount="handleToAmountChange"
/>
```

Add import: `import TransferPanel from './TransferPanel.vue';`

Remove unused imports from TransactionForm.vue that are now only used in panels: `SplitExpenseSection`, `SplitMethod`, `SplitExpenseData`, `CategoryCard`, `Category`, `formatCurrency`. Keep `getCurrencyByCode` only if still used in TransactionForm itself (it's not after extraction, so remove it too). Keep `UInput` only if still needed for description/date fields.

**Step 3: Verify build**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/features/add-transaction/ui/TransferPanel.vue frontend/src/features/add-transaction/ui/TransactionForm.vue
git commit -m "refactor: extract TransferPanel from TransactionForm"
```

---

### Task 4: Create DebtPanel.vue

**Files:**
- Create: `frontend/src/features/add-transaction/ui/DebtPanel.vue`

**Step 1: Create DebtPanel component**

Adapt the content from `features/create-debt/ui/DebtForm.vue` into a panel that fits the swipeable form. Uses same fields but styled consistently with other panels.

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { CalendarDate, type DateValue } from '@internationalized/date';
import { UInput, UTabs, UIcon } from '@/shared/ui';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/shared/ui/primitives/popover';
import { Calendar } from '@/shared/ui/primitives/calendar';
import { DEBT_DIRECTION_LABELS, type DebtDirection } from '@/entities/debt';
import { getCurrencyByCode } from '@/entities/currency';
import type { DebtFormData } from '@/features/create-debt';
import type { AccountWithBalances } from '@/entities/account';
import AccountSelector from './AccountSelector.vue';

const props = defineProps<{
  formData: DebtFormData;
  accounts: AccountWithBalances[];
}>();

const emit = defineEmits<{
  'update:formData': [value: DebtFormData];
}>();

const debtTypeTabs = Object.entries(DEBT_DIRECTION_LABELS).map(([id, label]) => ({
  id,
  label,
}));

const selectedAccount = computed(() =>
  props.accounts.find((a) => a.id === props.formData.account_id),
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

function updateField<K extends keyof DebtFormData>(field: K, value: DebtFormData[K]) {
  emit('update:formData', { ...props.formData, [field]: value });
}

function handleAccountChange(accountId: string) {
  const account = props.accounts.find((a) => a.id === accountId);
  const firstCurrency = account?.balances[0]?.currency || 'UZS';
  emit('update:formData', {
    ...props.formData,
    account_id: accountId,
    currency: firstCurrency,
  });
}

// Date picker
const isDatePickerOpen = ref(false);

function parseDate(dateStr: string | null): DateValue | undefined {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new CalendarDate(year, month, day);
}

const calendarValue = computed(() => {
  const dateStr = props.formData.debt_date || new Date().toISOString().split('T')[0];
  return parseDate(dateStr);
});

function handleDateChange(value: DateValue | undefined) {
  if (value) {
    const year = value.year;
    const month = String(value.month).padStart(2, '0');
    const day = String(value.day).padStart(2, '0');
    updateField('debt_date', `${year}-${month}-${day}`);
    isDatePickerOpen.value = false;
  }
}

const displayDate = computed(() => {
  const dateStr = props.formData.debt_date || new Date().toISOString().split('T')[0];
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
});
</script>

<template>
  <div class="space-y-4">
    <!-- Debt Type Tabs -->
    <div class="space-y-2">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Тип долга
      </label>
      <UTabs
        :model-value="formData.debt_type"
        :items="debtTypeTabs"
        @update:model-value="updateField('debt_type', $event as DebtDirection)"
      />
    </div>

    <!-- Person Name -->
    <UInput
      :model-value="formData.person_name"
      :label="formData.debt_type === 'given' ? 'Кому дали в долг' : 'У кого взяли в долг'"
      placeholder="Имя человека"
      @update:model-value="updateField('person_name', $event as string)"
    />

    <!-- Amount with Currency -->
    <div class="space-y-2">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Сумма
      </label>
      <div class="flex gap-2">
        <div v-if="isMultiCurrency" class="relative shrink-0">
          <select
            :value="formData.currency"
            class="appearance-none h-full bg-surface-light dark:bg-surface-dark rounded-xl px-3 pr-8 text-sm font-medium border border-border-light dark:border-border-dark focus:outline-none focus:ring-2 focus:ring-primary"
            @change="updateField('currency', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="currency in availableCurrencies" :key="currency" :value="currency">
              {{ getCurrencyByCode(currency)?.flag }} {{ currency }}
            </option>
          </select>
          <UIcon
            name="expand_more"
            size="sm"
            class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </div>
        <div class="flex-1">
          <UInput
            :model-value="String(formData.amount || '')"
            placeholder="0"
            variant="currency"
            type="number"
            :suffix="currencySymbol"
            @update:model-value="updateField('amount', Number($event) || 0)"
          />
        </div>
      </div>
    </div>

    <!-- Account Selector -->
    <AccountSelector
      :accounts="accounts"
      :selected-id="formData.account_id"
      :label="formData.debt_type === 'given' ? 'С какого счёта' : 'На какой счёт'"
      @select="handleAccountChange"
    />

    <!-- Date Input -->
    <div class="space-y-2">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Дата
      </label>
      <Popover v-model:open="isDatePickerOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            class="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-text-primary-light dark:text-text-primary-dark hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          >
            <div class="flex items-center gap-2">
              <UIcon name="calendar_month" size="sm" class="text-text-secondary-light dark:text-text-secondary-dark" />
              <span class="text-sm">{{ displayDate }}</span>
            </div>
            <UIcon
              name="expand_more"
              size="sm"
              class="text-text-secondary-light dark:text-text-secondary-dark transition-transform"
              :class="{ 'rotate-180': isDatePickerOpen }"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0" align="start">
          <Calendar
            :model-value="calendarValue"
            locale="ru-RU"
            @update:model-value="handleDateChange"
          />
        </PopoverContent>
      </Popover>
    </div>

    <!-- Description -->
    <UInput
      :model-value="formData.description"
      label="Комментарий"
      placeholder="Добавьте описание..."
      @update:model-value="updateField('description', $event as string)"
      @keydown.enter.prevent
    />

    <!-- Skip Balance Checkbox -->
    <label class="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        :checked="formData.skipTransaction"
        class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
        @change="updateField('skipTransaction', ($event.target as HTMLInputElement).checked)"
      />
      <span class="text-sm text-text-primary-light dark:text-text-primary-dark">
        {{ formData.debt_type === 'given' ? 'Не списывать с баланса' : 'Не добавлять на баланс' }}
      </span>
    </label>

    <!-- Info Box -->
    <div class="p-3 rounded-xl bg-surface-light dark:bg-surface-dark">
      <div class="flex items-start gap-2">
        <UIcon name="info" size="sm" class="text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5" />
        <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
          <template v-if="formData.skipTransaction">
            Будет создан только долг без изменения баланса счёта
          </template>
          <template v-else>
            {{ formData.debt_type === 'given'
              ? `Сумма ${formData.amount > 0 ? formData.amount + ' ' + formData.currency : ''} будет списана с выбранного счёта`
              : `Сумма ${formData.amount > 0 ? formData.amount + ' ' + formData.currency : ''} будет добавлена на выбранный счёт`
            }}
          </template>
        </p>
      </div>
    </div>
  </div>
</template>
```

**Step 2: Verify build**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/ui/DebtPanel.vue
git commit -m "feat: create DebtPanel component for 4th transaction screen"
```

---

### Task 5: Integrate DebtPanel into TransactionForm + add 'debt' type

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue`
- Modify: `frontend/src/features/add-transaction/model/useAddTransaction.ts` (add `debt` to type union)

**Step 1: Update TransactionFormData type**

In `useAddTransaction.ts`, update the `type` union to include `'debt'`:

```typescript
// Line 12: change
type: 'income' | 'expense' | 'transfer';
// to:
type: 'income' | 'expense' | 'transfer' | 'debt';
```

Also update `setType()` function (line 132):
```typescript
function setType(type: 'income' | 'expense' | 'transfer' | 'debt') {
  formData.value.type = type;
  formData.value.categoryId = type === 'transfer' ? 'transfer' : type === 'debt' ? '' : '';
  if (type !== 'transfer') {
    formData.value.toAccountId = null;
    formData.value.toAmount = null;
    formData.value.toCurrency = null;
  }
}
```

**Step 2: Update TransactionForm.vue**

Add `debt` to tabItems and typeOrder:

```typescript
const tabItems = [
  { id: 'expense', label: 'Расход' },
  { id: 'income', label: 'Доход' },
  { id: 'transfer', label: 'Перевод' },
  { id: 'debt', label: 'Долг' },
];

const typeOrder = ['expense', 'income', 'transfer', 'debt'] as const;
```

Add DebtPanel props and import:

```typescript
import DebtPanel from './DebtPanel.vue';
import type { DebtFormData } from '@/features/create-debt';
```

Add new props to TransactionForm:
```typescript
debtFormData?: DebtFormData;
```

Add new emit:
```typescript
'update:debtFormData': [value: DebtFormData];
```

Add 4th panel in template after Transfer panel's closing `</div>`:

```vue
<!-- Panel: Debt -->
<div class="min-w-full snap-start px-4">
  <DebtPanel
    v-if="debtFormData"
    :form-data="debtFormData"
    :accounts="accounts"
    @update:form-data="$emit('update:debtFormData', $event)"
  />
</div>
```

Update `applyTypeChange` to handle debt:
```typescript
function applyTypeChange(type: string) {
  emit('update:formData', {
    ...props.formData,
    type: type as 'income' | 'expense' | 'transfer' | 'debt',
    categoryId: type === 'transfer' ? 'transfer' : '',
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
  });
}
```

Update `hasSufficientFunds` to also skip for debt:
```typescript
const hasSufficientFunds = computed(() => {
  if (props.formData.type === 'income' || props.formData.type === 'debt') return true;
  return props.formData.amount <= currentBalance.value;
});
```

Update submit button text and disabled logic:
```typescript
// Disabled logic — add debt case:
:disabled="
  formData.type === 'debt'
    ? !debtFormData?.person_name?.trim() || (debtFormData?.amount ?? 0) <= 0 || !debtFormData?.account_id
    : !hasSufficientFunds ||
      (isTransfer
        ? !formData.accountId || !formData.toAccountId || formData.amount <= 0 || !formData.toAmount || formData.toAmount <= 0
        : !formData.accountId || !formData.categoryId || formData.amount <= 0)
"

// Button text:
{{
  formData.type === 'debt'
    ? 'Создать долг'
    : formData.type === 'transfer'
      ? 'Перевести'
      : formData.type === 'income'
        ? 'Добавить доход'
        : 'Добавить расход'
}}
```

Also hide the common description/date fields when type is debt (debt panel has its own):
```vue
<div v-if="formData.type !== 'debt'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
  <!-- existing description and date inputs -->
</div>
```

**Step 3: Verify build**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/features/add-transaction/ui/TransactionForm.vue frontend/src/features/add-transaction/model/useAddTransaction.ts
git commit -m "feat: integrate DebtPanel as 4th swipeable tab in TransactionForm"
```

---

### Task 6: Wire up debt creation in AddTransactionPage.vue

**Files:**
- Modify: `frontend/src/pages/transactions/new/AddTransactionPage.vue`

**Step 1: Add useCreateDebt and wire it up**

Add imports and setup:
```typescript
import { useCreateDebt } from '@/features/create-debt';

// After existing useAddTransaction() call:
const {
  formData: debtFormData,
  isSubmitting: debtIsSubmitting,
  error: debtError,
  createDebt,
  resetForm: resetDebtForm,
} = useCreateDebt();
```

Update `onMounted` to handle `?type=debt`:
```typescript
onMounted(() => {
  resetSplit();
  const typeParam = route.query.type as string;
  if (typeParam === 'income' || typeParam === 'expense' || typeParam === 'transfer' || typeParam === 'debt') {
    setType(typeParam);
  }
  // ...existing categoryId logic
});
```

Update `handleSubmit` to dispatch based on type:
```typescript
async function handleSubmit() {
  if (!userId.value) {
    error.value = 'Пользователь не авторизован';
    return;
  }

  // Debt type: use createDebt
  if (formData.value.type === 'debt') {
    const debtId = await createDebt(userId.value);
    if (debtId) {
      resetDebtForm();
      router.push({ name: 'dashboard' });
    }
    return;
  }

  // Existing transaction logic below (unchanged)
  if (splitData.value.enabled && !splitIsValid.value) {
    error.value = splitValidationError.value || 'Проверьте данные разделения расхода';
    return;
  }
  // ...rest unchanged
}
```

Auto-select account for debt form when accounts load:
```typescript
watch(
  [accounts, defaultAccountId],
  ([accs, defaultId]) => {
    // ...existing logic for transaction form

    // Also set default for debt form
    if (accs.length > 0 && !debtFormData.value.account_id) {
      const selectedId = defaultId && accs.some((a) => a.id === defaultId)
        ? defaultId
        : accs[0].id;
      const selectedAccount = accs.find((a) => a.id === selectedId);
      if (selectedAccount && selectedAccount.balances.length > 0) {
        debtFormData.value.account_id = selectedId;
        debtFormData.value.currency = selectedAccount.balances[0].currency;
      }
    }
  },
  { immediate: true },
);
```

Pass debt form data to TransactionForm:
```vue
<TransactionForm
  v-else
  v-model:form-data="formData"
  v-model:debt-form-data="debtFormData"
  :accounts="accounts"
  :expense-categories="expenseCategories"
  :income-categories="incomeCategories"
  :user-currency="userCurrency"
  :is-submitting="isSubmitting || debtIsSubmitting"
  :error="error || debtError"
  :split-data="splitData"
  :split-validation-error="splitValidationError"
  @submit="handleSubmit"
  ...existing event handlers
/>
```

**Step 2: Verify build**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 3: Commit**

```bash
git add frontend/src/pages/transactions/new/AddTransactionPage.vue
git commit -m "feat: wire up debt creation in AddTransactionPage"
```

---

### Task 7: Remove standalone debt creation page and update navigation

**Files:**
- Modify: `frontend/src/app/router/index.ts` — remove `/debts/new` route
- Modify: `frontend/src/pages/debts/list/DebtsListPage.vue` — change navigation to `new-transaction?type=debt`
- Modify: `frontend/src/pages/dashboard/DashboardPage.vue` — change navigation to `new-transaction?type=debt`
- Delete: `frontend/src/pages/debts/new/AddDebtPage.vue`

**Step 1: Update router**

Remove lines 178-183 (the `/debts/new` route block).

**Step 2: Update DebtsListPage.vue**

Change `router.push({ name: 'new-debt' })` to:
```typescript
router.push({ name: 'new-transaction', query: { type: 'debt' } });
```

**Step 3: Update DashboardPage.vue**

Change `router.push({ name: 'new-debt' })` to:
```typescript
router.push({ name: 'new-transaction', query: { type: 'debt' } });
```

**Step 4: Delete AddDebtPage.vue**

```bash
rm frontend/src/pages/debts/new/AddDebtPage.vue
```

**Step 5: Verify build**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 6: Commit**

```bash
git add -u && git add frontend/src/app/router/index.ts frontend/src/pages/debts/list/DebtsListPage.vue frontend/src/pages/dashboard/DashboardPage.vue
git commit -m "feat: remove standalone debt page, navigate to 4th transaction tab"
```

---

### Task 8: Update feature index exports

**Files:**
- Modify: `frontend/src/features/add-transaction/index.ts`

**Step 1: Export new panel components**

```typescript
export { default as TransactionForm } from './ui/TransactionForm.vue';
export { default as ExpensePanel } from './ui/ExpensePanel.vue';
export { default as IncomePanel } from './ui/IncomePanel.vue';
export { default as TransferPanel } from './ui/TransferPanel.vue';
export { default as DebtPanel } from './ui/DebtPanel.vue';
export { useAddTransaction } from './model/useAddTransaction';
export type { TransactionFormData } from './model/useAddTransaction';
```

**Step 2: Verify build**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/index.ts
git commit -m "chore: export panel components from add-transaction feature"
```

---

### Task 9: Final verification and manual test

**Step 1: Full build check**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 2: Start dev server and verify**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app && bun run dev`

Manual checks:
- Open `/transactions/new` — should show 4 tabs, swipe works across all 4
- Open `/transactions/new?type=debt` — should open directly on 4th panel
- Create a debt from 4th panel — should work and redirect to dashboard
- Navigate from debts list "+" button — should go to 4th tab
- Navigate from dashboard debt button — should go to 4th tab
- `/debts/new` should 404

**Step 3: Update changelog**

In `frontend/src/features/changelog/model/changelogData.ts`, add entry:
- Type: `improvement`
- Description: «Создание долга теперь доступно прямо из экрана новой транзакции (4-я вкладка)»
