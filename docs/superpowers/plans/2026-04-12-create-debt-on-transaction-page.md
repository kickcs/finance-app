# Create Debt on Transaction Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести создание долга из отдельного drawer в страницу «Новая транзакция» как 4-й таб, заменить обычный amount input на `HeroAmount` с разделителем разрядов и компактным pill-селектором направления.

**Architecture:** `DebtPanel` — self-contained панель с собственным `useDebtForm`, встраивается в существующий циклический свайпер `TransactionForm` как 4-й режим. Форма долга изолирована от `TransactionFormData` (их поля не пересекаются). `TransactionForm` условно скрывает свою bottom-секцию при `type === 'debt'`, а `DebtPanel` рендерит собственный submit. Drawer удаляется, кнопка «Создать долг» на `DebtsListPage` ведёт на `/transactions/new?type=debt`.

**Tech Stack:** Vue 3 Composition API + `<script setup>`, TanStack Vue Query (для rollback-логики), FSD, Tailwind CSS v4, semantic tokens (`bg-card-light dark:bg-card-dark`), `formatNumberWithSpaces` через `HeroAmount`.

---

## File Structure

**Moved (rename):**
- `frontend/src/features/create-debt/model/useCreateDebt.ts` → `frontend/src/features/add-transaction/model/useDebtForm.ts` (переименование функции)
- `frontend/src/features/create-debt/model/useCreateDebt.spec.ts` → `frontend/src/features/add-transaction/model/useDebtForm.spec.ts`
- `frontend/src/features/create-debt/ui/DatePickerField.vue` → `frontend/src/features/add-transaction/ui/DatePickerField.vue`
- `frontend/src/features/create-debt/ui/ToggleRow.vue` → `frontend/src/features/add-transaction/ui/ToggleRow.vue`

**Created:**
- `frontend/src/features/add-transaction/ui/DebtDirectionPill.vue` — компактный pill-сегмент направления (↑ Дал / ↓ Взял)
- `frontend/src/features/add-transaction/ui/DebtPanel.vue` — self-contained панель долга

**Modified:**
- `frontend/src/features/add-transaction/model/useScrollableTabs.ts` — расширение `TRANSACTION_TYPE_ORDER` до 4 элементов
- `frontend/src/features/add-transaction/model/useTransactionForm.ts` — расширение type-union до `'debt'`
- `frontend/src/features/add-transaction/ui/TransactionForm.vue` — 4-й таб, `DebtPanel` в swiper, условное скрытие bottom-секции, проброс `@debt-submitted`
- `frontend/src/features/add-transaction/index.ts` — экспорт `useDebtForm` + типа
- `frontend/src/pages/transactions/new/AddTransactionPage.vue` — обработка `?type=debt`, ранний выход в `handleSubmit`, listener `@debt-submitted`
- `frontend/src/pages/debts/list/useDebtsPageState.ts` — `handleAddDebt` → `router.push`
- `frontend/src/pages/debts/list/DebtsListPage.vue` — удаление `CreateDebtDrawer`
- `frontend/src/features/changelog/model/changelogData.ts` — bump до `1.0.45` + entries

**Deleted:**
- Вся директория `frontend/src/features/create-debt/`

---

## Task 1: Move `useCreateDebt` → `useDebtForm`

Rename function and move file into `features/add-transaction`. External contract identical — only import path + function name change.

**Files:**
- Create: `frontend/src/features/add-transaction/model/useDebtForm.ts`
- Create: `frontend/src/features/add-transaction/model/useDebtForm.spec.ts`
- Modify: `frontend/src/features/create-debt/ui/CreateDebtDrawer.vue` (temporary, line 19)

- [ ] **Step 1: Copy `useCreateDebt.ts` content into new `useDebtForm.ts`**

Create file `frontend/src/features/add-transaction/model/useDebtForm.ts` with identical content EXCEPT rename the exported function from `useCreateDebt` → `useDebtForm`:

```typescript
import { ref, computed } from 'vue';
import { useMutation } from '@tanstack/vue-query';
import { transactionsApi } from '@/entities/transaction';
import { debtsApi } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import { getTodayISO } from '@/shared/lib/date';
import { CATEGORY_IDS } from '@/entities/category';
import { DEFAULT_CURRENCY } from '@/entities/currency';
import { buildDebtName, type DebtDirection } from '@/entities/debt';

export interface DebtFormData {
  debt_type: DebtDirection;
  person_name: string;
  amount: number;
  currency: string;
  account_id: string | null;
  debt_date: string | null;
  description: string;
  skip_transaction: boolean;
  is_private: boolean;
  due_date: string | null;
}

function makeInitialFormData(): DebtFormData {
  return {
    debt_type: 'taken',
    person_name: '',
    amount: 0,
    currency: DEFAULT_CURRENCY,
    account_id: null,
    debt_date: getTodayISO(),
    description: '',
    skip_transaction: false,
    is_private: false,
    due_date: null,
  };
}

export function useDebtForm() {
  const { toast } = useToast();
  const formData = ref<DebtFormData>(makeInitialFormData());
  const error = ref<string | null>(null);

  const isValid = computed(() => {
    return (
      formData.value.person_name.trim().length > 0 &&
      formData.value.amount > 0 &&
      formData.value.account_id !== null &&
      formData.value.currency !== ''
    );
  });

  const mutation = useMutation({
    mutationFn: async (userId: string): Promise<string> => {
      const isGiven = formData.value.debt_type === 'given';
      const accountId = formData.value.account_id!;
      const currency = formData.value.currency;
      const categoryId = isGiven ? CATEGORY_IDS.DEBT_GIVEN : CATEGORY_IDS.DEBT_TAKEN;

      let transactionId: string | null = null;

      try {
        if (!formData.value.skip_transaction) {
          const transaction = await transactionsApi.create({
            user_id: userId,
            account_id: accountId,
            category_id: categoryId,
            amount: formData.value.amount,
            currency,
            type: isGiven ? 'expense' : 'income',
            description:
              formData.value.description ||
              `${isGiven ? 'Дал в долг' : 'Взял в долг'}: ${formData.value.person_name}`,
            date: formData.value.debt_date
              ? `${formData.value.debt_date}T12:00:00.000Z`
              : new Date().toISOString(),
            is_debt_related: true,
          });
          transactionId = transaction.id;
        }

        const debtName = buildDebtName(formData.value.debt_type, formData.value.person_name);
        const debt = await debtsApi.create({
          user_id: userId,
          name: debtName,
          total_amount: formData.value.amount,
          remaining_amount: formData.value.amount,
          debt_type: formData.value.debt_type,
          person_name: formData.value.person_name,
          account_id: accountId,
          transaction_id: transactionId,
          is_closed: false,
          currency,
          description: formData.value.description || null,
          is_private: formData.value.is_private,
          next_payment_date: formData.value.due_date,
        });

        if (transactionId) {
          await transactionsApi.update(transactionId, { debt_id: debt.id });
        }

        return debt.id;
      } catch (e) {
        if (transactionId) {
          try {
            await transactionsApi.delete(transactionId);
          } catch (rollbackError) {
            console.error('Failed to rollback debt creation:', rollbackError);
          }
        }
        throw e;
      }
    },

    onSuccess: (_, userId) => {
      invalidateDebtRelated(queryClient, userId).catch(console.error);
      const isGiven = formData.value.debt_type === 'given';
      toast({
        title: 'Долг создан',
        description: isGiven
          ? `Вы дали в долг ${formData.value.person_name}`
          : `Вы взяли в долг у ${formData.value.person_name}`,
        variant: 'success',
        duration: 2500,
      });
      resetForm();
    },

    onError: () => {
      error.value = 'Не удалось создать долг';
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать долг',
        variant: 'error',
        duration: 4000,
      });
    },
  });

  const isSubmitting = computed(() => mutation.isPending.value);

  async function createDebt(userId: string): Promise<string | null> {
    if (!isValid.value) {
      error.value = 'Заполните все обязательные поля';
      return null;
    }
    error.value = null;
    try {
      return await mutation.mutateAsync(userId);
    } catch {
      return null;
    }
  }

  function updateField<K extends keyof DebtFormData>(field: K, value: DebtFormData[K]) {
    formData.value[field] = value;
  }

  function resetForm() {
    formData.value = makeInitialFormData();
    error.value = null;
    mutation.reset();
  }

  return {
    formData,
    isValid,
    isSubmitting,
    error,
    createDebt,
    updateField,
    resetForm,
  };
}
```

- [ ] **Step 2: Copy `useCreateDebt.spec.ts` to new location, update imports**

Read `frontend/src/features/create-debt/model/useCreateDebt.spec.ts` fully (it's ~14KB), copy its contents into `frontend/src/features/add-transaction/model/useDebtForm.spec.ts`, then change ONLY these two things:

1. Line 7: `import { useCreateDebt } from './useCreateDebt';` → `import { useDebtForm } from './useDebtForm';`
2. All call sites: `useCreateDebt()` → `useDebtForm()` (use find-and-replace across the copied file)

No other changes. The tests themselves (mocks, assertions, flow) remain identical.

- [ ] **Step 3: Update CreateDebtDrawer import (temporary, until Task 9)**

The old drawer still needs to build while we move files. Update `frontend/src/features/create-debt/ui/CreateDebtDrawer.vue` line 19:

```typescript
// Before:
import { useCreateDebt } from '../model/useCreateDebt';

// After:
import { useDebtForm as useCreateDebt } from '@/features/add-transaction/model/useDebtForm';
```

Keep the local alias `useCreateDebt` so nothing else in the file needs to change. The drawer file will be deleted in Task 9, so this is throwaway.

- [ ] **Step 4: Delete the old `useCreateDebt.ts` and `useCreateDebt.spec.ts`**

```bash
rm frontend/src/features/create-debt/model/useCreateDebt.ts
rm frontend/src/features/create-debt/model/useCreateDebt.spec.ts
```

- [ ] **Step 5: Run type-check + tests**

```bash
cd frontend && bun run build
```

Expected: build passes. Then:

```bash
cd frontend && bunx vitest run src/features/add-transaction/model/useDebtForm.spec.ts
```

Expected: all existing tests pass under the new name.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/add-transaction/model/useDebtForm.ts \
        frontend/src/features/add-transaction/model/useDebtForm.spec.ts \
        frontend/src/features/create-debt/ui/CreateDebtDrawer.vue \
        frontend/src/features/create-debt/model/useCreateDebt.ts \
        frontend/src/features/create-debt/model/useCreateDebt.spec.ts
git commit -m "refactor(add-transaction): move useCreateDebt to useDebtForm"
```

---

## Task 2: Move `DatePickerField.vue` and `ToggleRow.vue`

Move two leaf UI components used by the debt form.

**Files:**
- Create: `frontend/src/features/add-transaction/ui/DatePickerField.vue`
- Create: `frontend/src/features/add-transaction/ui/ToggleRow.vue`
- Delete: `frontend/src/features/create-debt/ui/DatePickerField.vue`
- Delete: `frontend/src/features/create-debt/ui/ToggleRow.vue`
- Modify: `frontend/src/features/create-debt/ui/CreateDebtDrawer.vue` (temporary import paths)

- [ ] **Step 1: Create `DatePickerField.vue` at new location**

Copy the exact content of `frontend/src/features/create-debt/ui/DatePickerField.vue` into `frontend/src/features/add-transaction/ui/DatePickerField.vue`. No code changes — imports in the file are all absolute paths (`@/shared/...`) so they work from any location.

- [ ] **Step 2: Create `ToggleRow.vue` at new location**

Copy the exact content of `frontend/src/features/create-debt/ui/ToggleRow.vue` into `frontend/src/features/add-transaction/ui/ToggleRow.vue`. No code changes.

- [ ] **Step 3: Update `CreateDebtDrawer.vue` imports (temporary)**

Modify `frontend/src/features/create-debt/ui/CreateDebtDrawer.vue` lines 22-23:

```typescript
// Before:
import DatePickerField from './DatePickerField.vue';
import ToggleRow from './ToggleRow.vue';

// After:
import DatePickerField from '@/features/add-transaction/ui/DatePickerField.vue';
import ToggleRow from '@/features/add-transaction/ui/ToggleRow.vue';
```

- [ ] **Step 4: Delete old files**

```bash
rm frontend/src/features/create-debt/ui/DatePickerField.vue
rm frontend/src/features/create-debt/ui/ToggleRow.vue
```

- [ ] **Step 5: Run type-check**

```bash
cd frontend && bun run build
```

Expected: build passes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/add-transaction/ui/DatePickerField.vue \
        frontend/src/features/add-transaction/ui/ToggleRow.vue \
        frontend/src/features/create-debt/ui/CreateDebtDrawer.vue \
        frontend/src/features/create-debt/ui/DatePickerField.vue \
        frontend/src/features/create-debt/ui/ToggleRow.vue
git commit -m "refactor(add-transaction): move DatePickerField and ToggleRow"
```

---

## Task 3: Create `DebtDirectionPill.vue`

Compact pill-сегмент для направления долга — заменяет полноразмерные `UTabs`. Центрирован под `HeroAmount`, 2 кнопки со стрелками.

**Files:**
- Create: `frontend/src/features/add-transaction/ui/DebtDirectionPill.vue`

- [ ] **Step 1: Create the component**

Create `frontend/src/features/add-transaction/ui/DebtDirectionPill.vue`:

```vue
<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import type { DebtDirection } from '@/entities/debt';

defineProps<{
  modelValue: DebtDirection;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: DebtDirection];
}>();

const { trigger } = useHaptics();

function select(value: DebtDirection) {
  trigger('selection');
  emit('update:modelValue', value);
}
</script>

<template>
  <div class="flex justify-center">
    <div
      class="inline-flex items-center gap-0 p-1 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark"
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        :aria-selected="modelValue === 'given'"
        class="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
        :class="
          modelValue === 'given'
            ? 'bg-card-light dark:bg-card-dark text-text-primary-light dark:text-text-primary-dark shadow-sm'
            : 'text-text-secondary-light dark:text-text-secondary-dark'
        "
        @click="select('given')"
      >
        <UIcon name="arrow_upward" size="xs" />
        <span>Дал</span>
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="modelValue === 'taken'"
        class="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
        :class="
          modelValue === 'taken'
            ? 'bg-card-light dark:bg-card-dark text-text-primary-light dark:text-text-primary-dark shadow-sm'
            : 'text-text-secondary-light dark:text-text-secondary-dark'
        "
        @click="select('taken')"
      >
        <UIcon name="arrow_downward" size="xs" />
        <span>Взял</span>
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && bun run build
```

Expected: build passes (unused component is fine for now).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/ui/DebtDirectionPill.vue
git commit -m "feat(add-transaction): add compact DebtDirectionPill component"
```

---

## Task 4: Create `DebtPanel.vue`

Self-contained панель с собственным `useDebtForm`, своим submit, рендерит `HeroAmount` + `DebtDirectionPill` + `PersonSelector` + `AccountSelector` + 2 даты + `UInput` + 2 `ToggleRow` + info-box + submit button.

**Files:**
- Create: `frontend/src/features/add-transaction/ui/DebtPanel.vue`

- [ ] **Step 1: Create the component**

Create `frontend/src/features/add-transaction/ui/DebtPanel.vue`:

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UInput, UButton, UIcon } from '@/shared/ui';
import { getCurrencyByCode, DEFAULT_CURRENCY } from '@/entities/currency';
import { getCurrencySymbol } from '@/shared/lib/format/currency';
import { PersonSelector, usePeople } from '@/entities/person';
import { AccountSelector } from '@/entities/account';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';
import type { AccountWithBalances } from '@/entities/account';
import { useDebtForm } from '../model/useDebtForm';
import HeroAmount from './HeroAmount.vue';
import DebtDirectionPill from './DebtDirectionPill.vue';
import DatePickerField from './DatePickerField.vue';
import ToggleRow from './ToggleRow.vue';

const props = defineProps<{
  accounts: AccountWithBalances[];
  autofocusAmount?: boolean;
}>();

const emit = defineEmits<{
  submitted: [];
}>();

const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);
const { trigger } = useHaptics();
const { formData, isValid, isSubmitting, error, createDebt, updateField } = useDebtForm();

const selectedAccount = computed(() =>
  props.accounts.find((a) => a.id === formData.value.account_id),
);
const availableCurrencies = computed(() =>
  selectedAccount.value ? selectedAccount.value.balances.map((b) => b.currency) : [],
);
const isMultiCurrency = computed(() => availableCurrencies.value.length > 1);
const currencySymbol = computed(() => getCurrencySymbol(formData.value.currency));

// Auto-select first account when accounts load
watch(
  () => props.accounts,
  (accs) => {
    if (accs.length > 0 && !formData.value.account_id) {
      const first = accs[0];
      updateField('account_id', first.id);
      updateField('currency', first.balances[0]?.currency || DEFAULT_CURRENCY);
    }
  },
  { immediate: true },
);

function handleAccountChange(accountId: string) {
  trigger('selection');
  const account = props.accounts.find((a) => a.id === accountId);
  const currencies = account?.balances.map((b) => b.currency) || [];
  const currentCurrency = formData.value.currency;
  const newCurrency = currencies.includes(currentCurrency)
    ? currentCurrency
    : currencies[0] || DEFAULT_CURRENCY;
  updateField('account_id', accountId);
  updateField('currency', newCurrency);
}

const isDebtDateOpen = ref(false);
const isDueDateOpen = ref(false);

async function handleSubmit() {
  if (!userId.value) return;
  const debtId = await createDebt(userId.value);
  if (debtId) {
    trigger('success');
    emit('submitted');
  }
}

const accountLabel = computed(() =>
  formData.value.debt_type === 'given' ? 'С какого счёта' : 'На какой счёт',
);
const personLabel = computed(() =>
  formData.value.debt_type === 'given' ? 'Кому дали в долг' : 'У кого взяли в долг',
);
const skipToggleTitle = computed(() =>
  formData.value.debt_type === 'given' ? 'Не списывать с баланса' : 'Не добавлять на баланс',
);
const infoText = computed(() => {
  const sum = formData.value.amount > 0 ? `${formData.value.amount} ${formData.value.currency}` : '';
  return formData.value.debt_type === 'given'
    ? `Сумма ${sum} будет списана с выбранного счёта`
    : `Сумма ${sum} будет добавлена на выбранный счёт`;
});
</script>

<template>
  <div class="space-y-3">
    <HeroAmount
      :amount="formData.amount"
      :currency="formData.currency"
      :currency-symbol="currencySymbol"
      :available-currencies="availableCurrencies"
      :is-multi-currency="isMultiCurrency"
      :autofocus="autofocusAmount"
      @update:amount="updateField('amount', $event)"
      @update:currency="updateField('currency', $event)"
    />

    <DebtDirectionPill
      :model-value="formData.debt_type"
      @update:model-value="updateField('debt_type', $event)"
    />

    <div class="space-y-1.5">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        {{ personLabel }}
      </label>
      <PersonSelector
        :model-value="formData.person_name"
        :people="people"
        placeholder="Имя человека"
        @update:model-value="updateField('person_name', $event)"
        @select="updateField('person_name', $event)"
        @save-person="(name) => createPerson({ name })"
      />
    </div>

    <AccountSelector
      :accounts="accounts"
      :selected-id="formData.account_id"
      :label="accountLabel"
      @select="handleAccountChange"
    />

    <div class="grid grid-cols-2 gap-2">
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Дата долга
        </label>
        <DatePickerField
          v-model:open="isDebtDateOpen"
          :model-value="formData.debt_date"
          @update:model-value="updateField('debt_date', $event)"
        />
      </div>
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Срок возврата
        </label>
        <DatePickerField
          v-model:open="isDueDateOpen"
          :model-value="formData.due_date"
          placeholder="Без срока"
          clearable
          @update:model-value="updateField('due_date', $event)"
        />
      </div>
    </div>

    <UInput
      :model-value="formData.description"
      label="Комментарий (необязательно)"
      placeholder="Добавьте описание..."
      @update:model-value="updateField('description', $event as string)"
    />

    <ToggleRow
      v-model="formData.is_private"
      title="Скрыть сумму"
      description="Сумма не будет видна в общем списке"
    />

    <ToggleRow
      v-model="formData.skip_transaction"
      :title="skipToggleTitle"
      description="Транзакция не будет создана"
    />

    <div
      v-if="!formData.skip_transaction && formData.account_id"
      class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark"
    >
      <div class="flex items-start gap-3">
        <UIcon
          name="info"
          size="sm"
          class="text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5"
        />
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          {{ infoText }}
        </p>
      </div>
    </div>

    <p v-if="error" class="text-xs text-danger">{{ error }}</p>

    <div class="pt-2">
      <UButton
        type="button"
        variant="primary"
        size="lg"
        full-width
        :loading="isSubmitting"
        :disabled="!isValid"
        @click="handleSubmit"
      >
        Создать долг
      </UButton>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && bun run build
```

Expected: build passes. If `getCurrencyByCode` is flagged as unused, remove its import (the check is cosmetic — keep the import only if actually used).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/ui/DebtPanel.vue
git commit -m "feat(add-transaction): add self-contained DebtPanel"
```

---

## Task 5: Extend `useScrollableTabs` and `useTransactionForm`

Add `'debt'` to `TRANSACTION_TYPE_ORDER` and to `TransactionFormData.type` union.

**Files:**
- Modify: `frontend/src/features/add-transaction/model/useScrollableTabs.ts:5`
- Modify: `frontend/src/features/add-transaction/model/useTransactionForm.ts`

- [ ] **Step 1: Extend `TRANSACTION_TYPE_ORDER`**

In `frontend/src/features/add-transaction/model/useScrollableTabs.ts`, line 5:

```typescript
// Before:
export const TRANSACTION_TYPE_ORDER = ['expense', 'income', 'transfer'] as const;

// After:
export const TRANSACTION_TYPE_ORDER = ['expense', 'income', 'transfer', 'debt'] as const;
```

`CYCLIC_PANEL_ORDER` (line 9) auto-regenerates from `TRANSACTION_TYPE_ORDER.length` — no other change in this file.

- [ ] **Step 2: Extend `TransactionFormData` type union**

In `frontend/src/features/add-transaction/model/useTransactionForm.ts`:

Line 10: update the `type` field signature:

```typescript
// Before:
type: 'income' | 'expense' | 'transfer';

// After:
type: 'income' | 'expense' | 'transfer' | 'debt';
```

Line 68: update `setType` parameter type:

```typescript
// Before:
function setType(type: 'income' | 'expense' | 'transfer') {

// After:
function setType(type: 'income' | 'expense' | 'transfer' | 'debt') {
```

Line 70: the existing ternary `type === 'transfer' ? CATEGORY_IDS.TRANSFER : ''` stays as-is — for `'debt'` it correctly assigns empty string.

Line 71: condition `if (type !== 'transfer')` already clears transfer fields for `'debt'` — no change needed.

- [ ] **Step 3: Run type-check**

```bash
cd frontend && bun run build
```

Expected: build may fail at `applyTypeChange` in `TransactionForm.vue:67-68` which casts to the narrower union. That's fine — Task 6 fixes it. If the error is elsewhere, investigate before proceeding.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/add-transaction/model/useScrollableTabs.ts \
        frontend/src/features/add-transaction/model/useTransactionForm.ts
git commit -m "feat(add-transaction): add debt to transaction type union"
```

---

## Task 6: Integrate `DebtPanel` into `TransactionForm.vue`

Add 4th tab, render `DebtPanel` in swiper, conditionally hide bottom-section when `type === 'debt'`, forward `submitted` event.

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue`

- [ ] **Step 1: Import `DebtPanel`**

In `frontend/src/features/add-transaction/ui/TransactionForm.vue`, add import after line 29 (`import TransferPanel from './TransferPanel.vue';`):

```typescript
import DebtPanel from './DebtPanel.vue';
```

- [ ] **Step 2: Add `'debt'` to `tabItems`**

Replace the `tabItems` array at lines 57-61:

```typescript
const tabItems = [
  { id: 'expense', label: 'Расход' },
  { id: 'income', label: 'Доход' },
  { id: 'transfer', label: 'Перевод' },
  { id: 'debt', label: 'Долг' },
];
```

- [ ] **Step 3: Widen the `applyTypeChange` cast**

Replace lines 65-74:

```typescript
function applyTypeChange(newType: string) {
  emit('update:formData', {
    ...props.formData,
    type: newType as 'income' | 'expense' | 'transfer' | 'debt',
    categoryId: newType === 'transfer' ? CATEGORY_IDS.TRANSFER : '',
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
  });
}
```

- [ ] **Step 4: Add `'debt-submitted'` emit declaration**

Extend the `defineEmits` block (lines 45-55) by adding the new event:

```typescript
const emit = defineEmits<{
  'update:formData': [value: TransactionFormData];
  submit: [];
  'debt-submitted': [];
  addParticipant: [name: string, fromContacts: boolean, personColor?: string];
  removeParticipant: [id: string];
  updateParticipantAmount: [id: string, amount: number];
  setSplitMethod: [method: SplitMethod];
  setMyShare: [amount: number];
  setIsIncluded: [included: boolean];
  setSplitEnabled: [enabled: boolean];
}>();
```

- [ ] **Step 5: Render `DebtPanel` in the swiper**

In the `v-for` swiper loop (around lines 308-379), add a new `v-else-if` branch for the debt panel after the `TransferPanel` (before the closing `</div>` of the panel wrapper). Insert this right after line 378 (`<TransferPanel ... />`):

```vue
<DebtPanel
  v-else-if="panelType === 'debt'"
  :accounts="accounts"
  :autofocus-amount="autofocusAmount && realPanelIndices.has(idx)"
  @submitted="$emit('debt-submitted')"
/>
```

- [ ] **Step 6: Conditionally hide bottom section when `type === 'debt'`**

Wrap the entire bottom section `<div class="space-y-3 stagger-3 ...">` (starting at line 384) with `v-if="formData.type !== 'debt'"`.

Change line 384:

```vue
<!-- Before: -->
<div
  class="space-y-3 stagger-3 transform transition-all duration-500 ease-out delay-150"
  :class="isMounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
>

<!-- After: -->
<div
  v-if="formData.type !== 'debt'"
  class="space-y-3 stagger-3 transform transition-all duration-500 ease-out delay-150"
  :class="isMounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
>
```

- [ ] **Step 7: Run type-check**

```bash
cd frontend && bun run build
```

Expected: build passes.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/add-transaction/ui/TransactionForm.vue
git commit -m "feat(add-transaction): render DebtPanel as 4th tab in TransactionForm"
```

---

## Task 7: Update `AddTransactionPage.vue`

Handle `?type=debt` query param, early exit in `handleSubmit`, listen for `@debt-submitted` → `navigateBack()`.

**Files:**
- Modify: `frontend/src/pages/transactions/new/AddTransactionPage.vue`

- [ ] **Step 1: Handle `?type=debt` in `onMounted`**

Update the `onMounted` block (lines 55-69). Replace the type-param check:

```typescript
// Before:
const typeParam = route.query.type as string;
if (typeParam === 'income' || typeParam === 'expense' || typeParam === 'transfer') {
  setType(typeParam);
}

// After:
const typeParam = route.query.type as string;
if (
  typeParam === 'income' ||
  typeParam === 'expense' ||
  typeParam === 'transfer' ||
  typeParam === 'debt'
) {
  setType(typeParam);
}
```

- [ ] **Step 2: Early exit in `handleSubmit` for debt**

Add at the start of `handleSubmit` (line 123) after `validationError.value = null;`:

```typescript
async function handleSubmit() {
  validationError.value = null;

  if (formData.value.type === 'debt') {
    // DebtPanel owns its own submit flow and emits `debt-submitted`.
    return;
  }

  if (!userId.value) {
    validationError.value = 'Пользователь не авторизован';
    return;
  }
  // ... rest unchanged
}
```

- [ ] **Step 3: Add `@debt-submitted` listener on `<TransactionForm>`**

In the template (around lines 198-220), add the listener to the `<TransactionForm>` element. Add one line after `@submit="handleSubmit"` (line 212):

```vue
<TransactionForm
  v-else
  v-model:form-data="formData"
  data-testid="transaction-form"
  :accounts="accounts"
  :expense-categories="expenseCategories"
  :income-categories="incomeCategories"
  :user-currency="userCurrency"
  :is-submitting="isSubmitting"
  :is-valid="isValid"
  :error="validationError"
  :split-data="splitData"
  :split-validation-error="splitValidationError"
  :autofocus-amount="isQuickAction"
  @submit="handleSubmit"
  @debt-submitted="navigateBack"
  @add-participant="addParticipant"
  ...
```

- [ ] **Step 4: Run type-check**

```bash
cd frontend && bun run build
```

Expected: build passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/transactions/new/AddTransactionPage.vue
git commit -m "feat(add-transaction): handle debt type on AddTransactionPage"
```

---

## Task 8: Update `DebtsListPage.vue` + `useDebtsPageState.ts`

Remove drawer usage, change `handleAddDebt` to `router.push`.

**Files:**
- Modify: `frontend/src/pages/debts/list/useDebtsPageState.ts:150-154`
- Modify: `frontend/src/pages/debts/list/DebtsListPage.vue`

- [ ] **Step 1: Replace `handleAddDebt` body in `useDebtsPageState.ts`**

Open `frontend/src/pages/debts/list/useDebtsPageState.ts`. Verify `router` and `ROUTE_NAMES` are already imported at the top (they are — the file already uses them for `handleDebtClick`).

Replace lines 150-154:

```typescript
// Before:
const showCreateDrawer = ref(false);

function handleAddDebt() {
  showCreateDrawer.value = true;
}

// After:
function handleAddDebt() {
  router.push({ name: ROUTE_NAMES.NEW_TRANSACTION, query: { type: 'debt' } });
}
```

Also remove `showCreateDrawer` from the return object at the bottom of the file (search for `showCreateDrawer,` inside the `return { ... }` and delete that line).

- [ ] **Step 2: Remove `CreateDebtDrawer` from `DebtsListPage.vue`**

In `frontend/src/pages/debts/list/DebtsListPage.vue`:

1. Delete the import line (around line 8):
   ```typescript
   import { CreateDebtDrawer } from '@/features/create-debt';
   ```

2. Delete `showCreateDrawer` from the destructured object of `useDebtsPageState()` (around line 87). Find the destructure block and remove the `showCreateDrawer,` identifier.

3. Delete the `<CreateDebtDrawer v-model:open="showCreateDrawer" :accounts="accounts" />` element (around line 482).

Use Grep to locate exact line numbers:

```bash
grep -n "CreateDebtDrawer\|showCreateDrawer" frontend/src/pages/debts/list/DebtsListPage.vue
```

- [ ] **Step 3: Run type-check**

```bash
cd frontend && bun run build
```

Expected: build passes. If there are lingering usages of `showCreateDrawer`, grep for them and remove.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/debts/list/useDebtsPageState.ts \
        frontend/src/pages/debts/list/DebtsListPage.vue
git commit -m "feat(debts): route 'Create debt' button to new transaction page"
```

---

## Task 9: Delete `features/create-debt/` directory

With nothing else importing from `create-debt`, delete it entirely.

**Files:**
- Delete: `frontend/src/features/create-debt/` (entire directory)

- [ ] **Step 1: Verify no remaining imports from `@/features/create-debt`**

```bash
cd frontend && grep -r "features/create-debt" src/ --include="*.ts" --include="*.vue"
```

Expected: no matches. If any match, fix the import first (point it at `@/features/add-transaction` for the moved pieces) and re-run.

- [ ] **Step 2: Delete the directory**

```bash
rm -rf frontend/src/features/create-debt
```

- [ ] **Step 3: Run type-check**

```bash
cd frontend && bun run build
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src/features/create-debt
git commit -m "chore(create-debt): remove feature directory after migration"
```

---

## Task 10: Update `features/add-transaction/index.ts` exports

Public API of the feature: expose `useDebtForm` and `DebtFormData`. `DebtPanel` and `DebtDirectionPill` remain internal.

**Files:**
- Modify: `frontend/src/features/add-transaction/index.ts`

- [ ] **Step 1: Add exports**

Replace the contents of `frontend/src/features/add-transaction/index.ts`:

```typescript
export { default as TransactionForm } from './ui/TransactionForm.vue';
export { useTransactionForm } from './model/useTransactionForm';
export { useSubmitTransaction } from './model/useSubmitTransaction';
export { useDebtForm } from './model/useDebtForm';
export type { TransactionFormData } from './model/useTransactionForm';
export type { DebtFormData } from './model/useDebtForm';
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && bun run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/index.ts
git commit -m "chore(add-transaction): export useDebtForm from feature index"
```

---

## Task 11: Bump changelog to 1.0.45

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

- [ ] **Step 1: Bump `CURRENT_VERSION`**

In `frontend/src/features/changelog/model/changelogData.ts`, line 1:

```typescript
// Before:
export const CURRENT_VERSION = '1.0.44';

// After:
export const CURRENT_VERSION = '1.0.45';
```

- [ ] **Step 2: Add new entry at top of `CHANGELOG_ENTRIES`**

Insert this object as the first element of `CHANGELOG_ENTRIES` (before the `'1.0.44'` entry):

```typescript
{
  version: '1.0.45',
  date: '2026-04-12',
  title: 'Долги на странице новой транзакции',
  items: [
    {
      type: 'feature',
      text: 'Долг теперь можно создавать со страницы «Новая транзакция» — новый таб «Долг» рядом с Расход / Доход / Перевод',
    },
    {
      type: 'improvement',
      text: 'Поле суммы в долгах теперь разделяет цифры по разрядам — как и в остальных транзакциях',
    },
    {
      type: 'improvement',
      text: 'Компактный переключатель направления долга (Дал / Взял) вместо крупных табов',
    },
  ],
},
```

- [ ] **Step 3: Run type-check**

```bash
cd frontend && bun run build
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "chore(changelog): bump to 1.0.45 — debt creation on transaction page"
```

---

## Task 12: Manual browser verification

Automated coverage of the composable remains via `useDebtForm.spec.ts`. The panel itself is a composition of already-tested pieces, so the final verification is a manual smoke test in the dev server.

**No files changed** — observation only.

- [ ] **Step 1: Start the dev server**

```bash
cd frontend && bun run dev
```

- [ ] **Step 2: Golden path — create debt from `?type=debt` URL**

1. Navigate to `http://localhost:5173/transactions/new?type=debt`.
2. Expected: 4-й таб «Долг» активен, `HeroAmount` сфокусирован (цифры с разделителями разрядов при вводе, например `1 500`).
3. Expected: pill-сегмент «↑ Дал / ↓ Взял» виден под суммой, активна кнопка `Взял` (default `debt_type = 'taken'`).
4. Ввести сумму `1500`, выбрать человека в `PersonSelector`, убедиться что счёт предзаполнен первым из списка.
5. Нажать «Создать долг» → ожидается тост «Долг создан», навигация назад.
6. Проверить в `/debts` — долг появился.

- [ ] **Step 3: Direction switching**

1. На той же странице переключить pill на `Дал`.
2. Expected: лейбл PersonSelector меняется на «Кому дали в долг», AccountSelector — на «С какого счёта».
3. Expected: haptic-селекшн триггерится при тапе.

- [ ] **Step 4: Multi-currency account**

1. Выбрать счёт с несколькими валютами.
2. Expected: `HeroAmount` показывает chevron для смены валюты, переключение валюты работает.
3. Переключиться на счёт с одной валютой → currency синхронизируется автоматически.

- [ ] **Step 5: Rollback path**

1. Открыть DevTools → Network → включить offline.
2. Попытаться создать долг.
3. Expected: тост ошибки, форма остаётся заполненной, баланс счёта не изменился.

- [ ] **Step 6: Navigation from `DebtsListPage`**

1. Перейти на `/debts`.
2. Нажать кнопку создания долга (FAB или header-кнопку).
3. Expected: открывается `/transactions/new?type=debt` с активным табом «Долг».

- [ ] **Step 7: Tab swiping**

1. На `/transactions/new` свайпать табы влево/вправо.
2. Expected: циклическое переключение Расход → Доход → Перевод → Долг → Расход (и обратно).
3. Bottom-секция «Комментарий / Дата / Submit» исчезает на табе «Долг», внутри панели появляется собственная кнопка «Создать долг».
4. На остальных табах bottom-секция возвращается.

- [ ] **Step 8: Final build check**

```bash
cd frontend && bun run build
```

Expected: build passes, no type errors, no unused imports.

- [ ] **Step 9: Run full test suite**

```bash
cd frontend && bunx vitest run
```

Expected: all tests pass (in particular `useDebtForm.spec.ts`).

- [ ] **Step 10: No new commits needed**

If manual test revealed bugs, fix them in place and commit with `fix:` prefix. Otherwise, the feature is complete at Task 11's commit.

---

## Post-Implementation Tasks (user-requested)

After all 12 tasks are green, the user has requested:

1. **`/simplify` × 2** — run the simplification skill twice over recent changes.
2. **`/crq` × 2** — run the code-review skill twice.

These are separate skills invoked via the `Skill` tool. Do NOT commit auto-generated review comments; apply meaningful simplifications as follow-up commits only if the simplification is clear and non-destructive.
