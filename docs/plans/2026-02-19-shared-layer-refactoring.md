# Shared Layer Refactoring — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract duplicated UI components, composables, and utilities from pages/features/widgets into the shared layer following FSD architecture.

**Architecture:** Incremental refactoring — first create shared abstractions, then migrate consumers. Each task is independently verifiable via `bun run build` in frontend/.

**Tech Stack:** Vue 3, TypeScript, Tailwind CSS v4, Reka UI

---

### Task 1: Create USpinner component

**Files:**
- Create: `frontend/src/shared/ui/spinner/USpinner.vue`
- Create: `frontend/src/shared/ui/spinner/index.ts`
- Modify: `frontend/src/shared/ui/index.ts`

**Step 1: Create USpinner.vue**

```vue
<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg';
  }>(),
  { size: 'md' },
);

const sizeClasses = {
  sm: 'w-5 h-5 border-[1.5px]',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-[3px]',
} as const;
</script>

<template>
  <div
    :class="[sizeClasses[size], 'border-primary border-t-transparent rounded-full animate-spin']"
    role="status"
    aria-label="Загрузка"
  />
</template>
```

**Step 2: Create barrel export**

```ts
// frontend/src/shared/ui/spinner/index.ts
export { default as USpinner } from './USpinner.vue';
```

**Step 3: Add to shared/ui/index.ts**

Add line: `export { USpinner } from './spinner';`

**Step 4: Replace inline spinners in consumers**

Replace the inline spinner div in these files with `<USpinner />` wrapped in `<div class="flex items-center justify-center py-12">`:

- `frontend/src/pages/accounts/AccountDetailPage.vue` — find `<div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />`
- `frontend/src/pages/debts/detail/DebtDetailPage.vue` — same pattern
- `frontend/src/pages/reminders/detail/ReminderDetailPage.vue` — same pattern
- `frontend/src/pages/debts/new/AddDebtPage.vue` — if it has the spinner pattern
- `frontend/src/app/App.vue` — find the spinner in the loading state

Each replacement: `import { USpinner } from '@/shared/ui';` and replace `<div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />` with `<USpinner />`.

**Step 5: Verify build**

Run: `cd frontend && bun run build`
Expected: Build succeeds with no type errors.

**Step 6: Commit**

```bash
git add frontend/src/shared/ui/spinner/ frontend/src/shared/ui/index.ts frontend/src/pages/ frontend/src/app/App.vue
git commit -m "refactor: extract USpinner component to shared/ui"
```

---

### Task 2: Create NotFoundState component

**Files:**
- Create: `frontend/src/shared/ui/not-found-state/NotFoundState.vue`
- Create: `frontend/src/shared/ui/not-found-state/index.ts`
- Modify: `frontend/src/shared/ui/index.ts`
- Modify: `frontend/src/pages/accounts/AccountDetailPage.vue`
- Modify: `frontend/src/pages/debts/detail/DebtDetailPage.vue`
- Modify: `frontend/src/pages/reminders/detail/ReminderDetailPage.vue`

**Step 1: Create NotFoundState.vue**

The inline pattern in detail pages:
```html
<div class="text-center py-12">
  <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-light dark:bg-surface-dark flex items-center justify-center">
    <UIcon name="error" size="xl" class="text-text-tertiary-light dark:text-text-tertiary-dark" />
  </div>
  <p class="text-text-secondary-light dark:text-text-secondary-dark mb-4">X не найден</p>
  <UButton variant="primary" @click="router.push({ name: 'dashboard' })">На главную</UButton>
</div>
```

Create:

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { UIcon } from '@/shared/ui/icon';
import { UButton } from '@/shared/ui/button';

withDefaults(
  defineProps<{
    message?: string;
    icon?: string;
    actionLabel?: string;
    actionRoute?: string;
  }>(),
  {
    message: 'Не найдено',
    icon: 'error',
    actionLabel: 'На главную',
    actionRoute: 'dashboard',
  },
);

const router = useRouter();
</script>

<template>
  <div class="text-center py-12">
    <div
      class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-light dark:bg-surface-dark flex items-center justify-center"
    >
      <UIcon
        :name="icon"
        size="xl"
        class="text-text-tertiary-light dark:text-text-tertiary-dark"
      />
    </div>
    <p class="text-text-secondary-light dark:text-text-secondary-dark mb-4">
      {{ message }}
    </p>
    <UButton variant="primary" @click="router.push({ name: actionRoute })">
      {{ actionLabel }}
    </UButton>
  </div>
</template>
```

**Step 2: Create barrel + add to shared/ui/index.ts**

```ts
// frontend/src/shared/ui/not-found-state/index.ts
export { default as NotFoundState } from './NotFoundState.vue';
```

Add to `shared/ui/index.ts`: `export { NotFoundState } from './not-found-state';`

**Step 3: Replace inline not-found blocks**

In each of 3 detail pages, replace the inline "не найден" block with:
```vue
<NotFoundState message="Счёт не найден" />
```
(adjust message per page: "Счёт не найден", "Долг не найден", "Подписка не найдена")

Import `NotFoundState` from `@/shared/ui`.

**Step 4: Verify build**

Run: `cd frontend && bun run build`

**Step 5: Commit**

```bash
git add frontend/src/shared/ui/not-found-state/ frontend/src/shared/ui/index.ts frontend/src/pages/
git commit -m "refactor: extract NotFoundState component to shared/ui"
```

---

### Task 3: Remove redundant ColorPicker and IconSelector wrappers

**Files:**
- Delete: `frontend/src/features/create-account/ui/ColorPicker.vue`
- Delete: `frontend/src/features/create-account/ui/IconSelector.vue`
- Delete: `frontend/src/features/create-reminder/ui/ColorPicker.vue`
- Delete: `frontend/src/features/create-reminder/ui/IconSelector.vue`
- Modify: consumers that import these wrappers (find via grep)

**Step 1: Find all consumers of these wrappers**

Grep for imports of `ColorPicker` and `IconSelector` from `create-account` and `create-reminder` features. Likely used in form components within those same features.

**Step 2: Replace wrapper usage with direct UColorPicker/UIconSelector**

In each consumer, replace:
```vue
<ColorPicker v-model="form.color" />
```
with:
```vue
<UColorPicker v-model="form.color" :colors="ACCOUNT_COLORS" label="Цвет" />
```

And replace:
```vue
<IconSelector v-model="form.icon" :color="form.color" />
```
with:
```vue
<UIconSelector v-model="form.icon" :icons="ACCOUNT_ICONS" :color="form.color" label="Иконка" />
```

Update imports accordingly: remove wrapper imports, add `UColorPicker`/`UIconSelector` from `@/shared/ui` and constants from `@/entities/account` or `@/entities/reminder`.

**Note:** `CategoryColorPicker` and `CategoryIconPicker` in `manage-categories` use different constants (`CATEGORY_COLORS`, `CATEGORY_ICONS`) and `CategoryIconPicker` passes extra props (`max-height`, `item-size`). These should ALSO be replaced with direct usage, passing the same props.

**Step 3: Delete the wrapper files**

Delete the 4 wrapper files listed above, plus `CategoryColorPicker.vue` and `CategoryIconPicker.vue` from manage-categories.

**Step 4: Update feature barrel exports if they re-export the wrappers**

Check `features/create-account/index.ts`, `features/create-reminder/index.ts`, `features/manage-categories/index.ts` and remove any re-exports of the deleted components.

**Step 5: Verify build**

Run: `cd frontend && bun run build`

**Step 6: Commit**

```bash
git add -A frontend/src/features/
git commit -m "refactor: remove redundant ColorPicker/IconSelector wrappers, use shared UI directly"
```

---

### Task 4: Migrate detail/add pages to AppHeader

**Files:**
- Modify: `frontend/src/pages/accounts/AccountDetailPage.vue`
- Modify: `frontend/src/pages/debts/detail/DebtDetailPage.vue`
- Modify: `frontend/src/pages/reminders/detail/ReminderDetailPage.vue`
- Modify: `frontend/src/pages/debts/new/AddDebtPage.vue`
- Modify: `frontend/src/pages/reminders/new/AddReminderPage.vue`
- Modify: `frontend/src/pages/transactions/new/AddTransactionPage.vue`
- Modify: `frontend/src/pages/settings/currency/CurrencySettingsPage.vue`

**Context:** `AppHeader` already supports `title`, `showBack`, `blur` props and `@back`, `#actions` slot. The inline headers use `bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl` which maps to `blur` mode in AppHeader.

**Step 1: Replace inline headers in detail pages**

In each detail page, replace the entire `<header>...</header>` block with:
```vue
<AppHeader :title="'Title'" show-back blur @back="router.back()" />
```

Import `AppHeader` from `@/widgets/header`.

For `CurrencySettingsPage` which has a right-side action button, use the `#actions` slot:
```vue
<AppHeader title="Валюта" show-back blur @back="router.back()">
  <template #actions>
    <UButton variant="ghost" size="sm" :disabled="!hasChanges" @click="save">
      Сохранить
    </UButton>
  </template>
</AppHeader>
```

**Step 2: Verify the spacing and padding are consistent**

The inline headers use `px-4 py-4` while AppHeader uses `px-5 py-3`. This is an acceptable visual change (existing AppHeader pattern should be consistent across the app). If exact pixel matching is needed, the inline variant is close enough.

**Step 3: Verify build**

Run: `cd frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/pages/ frontend/src/widgets/
git commit -m "refactor: migrate inline sticky headers to AppHeader widget"
```

---

### Task 5: Create ConfirmDeleteModal component

**Files:**
- Create: `frontend/src/shared/ui/confirm-delete-modal/ConfirmDeleteModal.vue`
- Create: `frontend/src/shared/ui/confirm-delete-modal/index.ts`
- Modify: `frontend/src/shared/ui/index.ts`
- Modify: `frontend/src/features/edit-account/ui/DeleteAccountModal.vue`
- Modify: `frontend/src/features/close-debt/ui/DeleteDebtModal.vue`
- Modify: `frontend/src/features/edit-transaction/ui/DeleteTransactionModal.vue`
- Modify: `frontend/src/features/edit-reminder/ui/DeleteReminderModal.vue`

**Step 1: Create ConfirmDeleteModal.vue**

This component extracts the common structure: modal → entity info slot → warning → actions.

```vue
<script setup lang="ts">
import { UModal } from '@/shared/ui/modal';
import { UButton } from '@/shared/ui/button';
import { UIcon } from '@/shared/ui/icon';

withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    warningText?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDeleting?: boolean;
    disabled?: boolean;
    error?: string | null;
    compact?: boolean;
  }>(),
  {
    title: 'Удалить',
    warningText: 'Это действие нельзя отменить.',
    confirmLabel: 'Удалить',
    cancelLabel: 'Отмена',
    compact: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
  cancel: [];
}>();

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    :title="title"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div :class="compact ? 'space-y-3' : 'space-y-4'">
      <!-- Entity info slot -->
      <slot />

      <!-- Error message (takes priority over warning) -->
      <div v-if="error" :class="['rounded-xl bg-warning/10', compact ? 'p-2.5' : 'p-4']">
        <div :class="['flex items-start', compact ? 'gap-2' : 'gap-3']">
          <UIcon name="info" :size="compact ? 'xs' : 'sm'" class="text-warning mt-0.5 shrink-0" />
          <p :class="[compact ? 'text-xs' : 'text-sm', 'text-warning font-medium']">
            {{ error }}
          </p>
        </div>
      </div>

      <!-- Warning message -->
      <div v-else :class="['rounded-xl bg-danger/10', compact ? 'p-2.5' : 'p-4']">
        <div :class="['flex items-start', compact ? 'gap-2' : 'gap-3']">
          <UIcon name="warning" :size="compact ? 'xs' : 'sm'" class="text-danger mt-0.5 shrink-0" />
          <p :class="[compact ? 'text-xs' : 'text-sm', 'text-danger']">
            {{ warningText }}
          </p>
        </div>
      </div>
    </div>

    <template #actions>
      <UButton
        variant="secondary"
        :size="compact ? 'sm' : undefined"
        full-width
        @click="close"
      >
        {{ cancelLabel }}
      </UButton>
      <UButton
        variant="danger"
        :size="compact ? 'sm' : undefined"
        full-width
        :loading="isDeleting"
        :disabled="disabled"
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </UButton>
    </template>
  </UModal>
</template>
```

**Step 2: Create barrel + add to shared/ui/index.ts**

**Step 3: Refactor DeleteAccountModal to use ConfirmDeleteModal**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { ConfirmDeleteModal } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { Account, AccountWithBalances } from '@/shared/api/database.types';

const props = defineProps<{
  modelValue: boolean;
  account: Account | AccountWithBalances | null;
  transactionsCount: number;
  isLoadingCount?: boolean;
  currency: string;
  isDeleting?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
  cancel: [];
}>();

const formattedBalances = computed(() => {
  if (!props.account) return '';
  const acc = props.account;
  if ('balances' in acc && Array.isArray(acc.balances)) {
    return (acc as AccountWithBalances).balances
      .map((b) => formatCurrency(b.balance, b.currency))
      .join(' · ');
  }
  return formatCurrency((acc as Account).balance, props.currency);
});

const warningText = computed(() => {
  const parts = ['Счёт будет полностью удалён.'];
  if (props.isLoadingCount) {
    parts.push('Подсчёт транзакций...');
  } else if (props.transactionsCount > 0) {
    const n = props.transactionsCount;
    const word = n === 1 ? 'транзакция будет удалена' : n < 5 ? 'транзакции будут удалены' : 'транзакций будут удалены';
    parts.push(`${n} ${word}.`);
  }
  parts.push('Это действие нельзя отменить.');
  return parts.join(' ');
});
</script>

<template>
  <ConfirmDeleteModal
    :model-value="modelValue"
    title="Удалить счёт"
    :warning-text="warningText"
    :is-deleting="isDeleting"
    :error="error"
    :disabled="!!error"
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <div
      v-if="account"
      class="flex items-center gap-3 p-4 rounded-xl bg-surface-light dark:bg-surface-dark"
    >
      <div
        class="w-12 h-12 rounded-xl flex items-center justify-center"
        :style="{ backgroundColor: `${account.color}20` }"
      >
        <UIcon :name="account.icon" size="md" :style="{ color: account.color }" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
          {{ account.name }}
        </p>
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          {{ formattedBalances }}
        </p>
      </div>
    </div>
  </ConfirmDeleteModal>
</template>
```

**Step 4: Similarly refactor DeleteDebtModal, DeleteTransactionModal, DeleteReminderModal**

Each keeps its entity-specific slot content and warning text but delegates structure to ConfirmDeleteModal. `DeleteTransactionModal` uses `compact` mode since it has smaller sizing (`p-3 rounded-lg`, `text-xs`).

**Step 5: Verify build**

Run: `cd frontend && bun run build`

**Step 6: Commit**

```bash
git add frontend/src/shared/ui/confirm-delete-modal/ frontend/src/shared/ui/index.ts frontend/src/features/
git commit -m "refactor: extract ConfirmDeleteModal to shared/ui"
```

---

### Task 6: Create useAsyncOperation composable

**Files:**
- Create: `frontend/src/shared/lib/hooks/useAsyncOperation.ts`

**Step 1: Create the composable**

```ts
import { ref } from 'vue';

export function useAsyncOperation<TArgs extends unknown[], TResult = boolean>(
  fn: (...args: TArgs) => Promise<TResult>,
  options?: { errorMessage?: string },
) {
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function execute(...args: TArgs): Promise<TResult | false> {
    isLoading.value = true;
    error.value = null;
    try {
      const result = await fn(...args);
      return result;
    } catch (e) {
      error.value = options?.errorMessage ?? 'Произошла ошибка';
      console.error(e);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  return { isLoading, error, execute };
}
```

**Step 2: Refactor useEditReminder to use useAsyncOperation**

This is the simplest consumer. Refactor first to validate the approach:

```ts
import { useAsyncOperation } from '@/shared/lib/hooks/useAsyncOperation';
import { useReminders } from '@/entities/reminder';
import type { Reminder } from '@/shared/api/database.types';

export function useEditReminder(userId: string) {
  const { updateReminder, deleteReminder } = useReminders(userId);

  const {
    isLoading: isUpdating,
    error: updateError,
    execute: update,
  } = useAsyncOperation(
    async (reminderId: string, updates: Partial<Reminder>) => {
      await updateReminder(reminderId, updates);
      return true;
    },
    { errorMessage: 'Не удалось обновить подписку' },
  );

  const {
    isLoading: isDeleting,
    error: deleteError,
    execute: remove,
  } = useAsyncOperation(
    async (reminderId: string) => {
      await deleteReminder(reminderId);
      return true;
    },
    { errorMessage: 'Не удалось удалить подписку' },
  );

  const error = computed(() => updateError.value || deleteError.value);

  return { isUpdating, isDeleting, error, update, remove };
}
```

**Note:** `useEditAccount` and `useEditTransaction` have extra domain logic (default account check, debt-related check) beyond the async pattern. For these, `useAsyncOperation` can wrap individual operations but the composable structure stays. Evaluate whether the abstraction saves enough code to justify the indirection. If not, only apply to `useEditReminder` and skip the others.

**Step 3: Verify build**

Run: `cd frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/shared/lib/hooks/useAsyncOperation.ts frontend/src/features/edit-reminder/
git commit -m "refactor: extract useAsyncOperation composable to shared/lib"
```

---

### Task 7: Upgrade useUserCurrency to use profile

**Files:**
- Modify: `frontend/src/shared/lib/hooks/useUserCurrency.ts`
- Modify: ~10 consumer files that inline currency resolution

**Step 1: Upgrade useUserCurrency**

Current implementation only reads localStorage. Upgrade to use profile as primary source:

```ts
import { computed } from 'vue';
import { useCurrentUser } from './useCurrentUser';
import { useProfile } from '@/shared/api';

export function useUserCurrency() {
  const { userId } = useCurrentUser();
  const { profile } = useProfile(userId.value);

  const currency = computed(
    () =>
      profile.value?.currency ||
      localStorage.getItem('selectedCurrency') ||
      'UZS',
  );

  return { currency };
}
```

**Step 2: Replace inline currency resolution in consumers**

Find all files with `profile.value?.currency || localStorage.getItem('selectedCurrency') || 'UZS'` or `localStorage.getItem('selectedCurrency') || 'UZS'` patterns.

Replace with:
```ts
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
const { currency } = useUserCurrency();
```

Files to check:
- `frontend/src/pages/dashboard/DashboardPage.vue`
- `frontend/src/pages/accounts/AccountDetailPage.vue`
- `frontend/src/pages/accounts/AccountsPage.vue`
- `frontend/src/pages/reminders/new/AddReminderPage.vue`
- `frontend/src/pages/analytics/AnalyticsPage.vue`
- `frontend/src/pages/profile/ProfilePage.vue`
- `frontend/src/pages/settings/currency/CurrencySettingsPage.vue`
- `frontend/src/app/router/prefetch/dashboardPrefetch.ts`

**Important:** `CurrencySettingsPage` and `dashboardPrefetch` may have special needs — verify each consumer before blindly replacing.

**Step 3: Verify build**

Run: `cd frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/shared/lib/hooks/useUserCurrency.ts frontend/src/pages/ frontend/src/app/
git commit -m "refactor: upgrade useUserCurrency to use profile as primary source"
```

---

### Task 8: Extract useGroupedTransactions composable

**Files:**
- Create: `frontend/src/entities/transaction/model/useGroupedTransactions.ts`
- Modify: `frontend/src/entities/transaction/index.ts`
- Modify: `frontend/src/pages/history/HistoryPage.vue`
- Modify: `frontend/src/pages/accounts/AccountDetailPage.vue`

**Step 1: Read both pages to extract the exact grouping logic**

Read `HistoryPage.vue` lines 101-174 and `AccountDetailPage.vue` lines 75-110 to understand both variants. The simpler AccountDetailPage version should be the base; HistoryPage adds currency conversion.

**Step 2: Create the composable**

Extract the common grouping logic. Accept `transactions` ref and return `computed<TransactionGroup[]>`. The composable groups by `formatDateGroup(tx.date)`, calculates per-group income/expense totals.

**Step 3: Migrate both pages to use it**

Replace inline computed with the composable call.

**Step 4: Verify build**

Run: `cd frontend && bun run build`

**Step 5: Commit**

```bash
git add frontend/src/entities/transaction/ frontend/src/pages/
git commit -m "refactor: extract useGroupedTransactions composable to entities/transaction"
```

---

### Task 9: Extract useTransactionSelection composable

**Files:**
- Create: `frontend/src/features/edit-transaction/model/useTransactionSelection.ts`
- Modify: `frontend/src/features/edit-transaction/index.ts`
- Modify: `frontend/src/pages/history/HistoryPage.vue`
- Modify: `frontend/src/pages/accounts/AccountDetailPage.vue`

**Step 1: Read both pages to extract the exact handleTransactionClick logic**

The identical pattern (lines ~241-258 in HistoryPage, ~177-194 in AccountDetailPage):
```ts
const selectedTransaction = ref<Transaction | null>(null);
const selectedTransactionHasSplitDebts = ref(false);
const showEditModal = ref(false);

async function handleTransactionClick(transaction: Transaction) {
  selectedTransaction.value = transaction;
  selectedTransactionHasSplitDebts.value = false;
  if (!transaction.is_debt_related && userId.value) {
    try {
      const allDebts = await debtsApi.getAll(userId.value);
      const linkedDebts = allDebts.filter(
        (d) => d.source_transaction_id === transaction.id && !d.is_closed,
      );
      selectedTransactionHasSplitDebts.value = linkedDebts.length > 0;
    } catch {
      selectedTransactionHasSplitDebts.value = false;
    }
  }
  showEditModal.value = true;
}
```

**Step 2: Create the composable**

```ts
import { ref } from 'vue';
import { debtsApi } from '@/entities/debt';
import type { Transaction } from '@/shared/api/database.types';

export function useTransactionSelection(userId: () => string) {
  const selectedTransaction = ref<Transaction | null>(null);
  const hasSplitDebts = ref(false);
  const showEditModal = ref(false);

  async function select(transaction: Transaction) {
    selectedTransaction.value = transaction;
    hasSplitDebts.value = false;

    if (!transaction.is_debt_related && userId()) {
      try {
        const allDebts = await debtsApi.getAll(userId());
        const linked = allDebts.filter(
          (d) => d.source_transaction_id === transaction.id && !d.is_closed,
        );
        hasSplitDebts.value = linked.length > 0;
      } catch {
        hasSplitDebts.value = false;
      }
    }

    showEditModal.value = true;
  }

  function close() {
    showEditModal.value = false;
    selectedTransaction.value = null;
  }

  return { selectedTransaction, hasSplitDebts, showEditModal, select, close };
}
```

**Step 3: Migrate both pages**

**Step 4: Verify build**

Run: `cd frontend && bun run build`

**Step 5: Commit**

```bash
git add frontend/src/features/edit-transaction/ frontend/src/pages/
git commit -m "refactor: extract useTransactionSelection composable"
```

---

### Task 10: Add formatLocalDate utility and remove local duplication

**Files:**
- Modify: `frontend/src/shared/lib/format/date.ts`
- Modify: `frontend/src/features/changelog/ui/ChangelogModal.vue`
- Modify: `frontend/src/pages/changelog/ChangelogPage.vue`

**Step 1: Add formatLocalDate to shared/lib/format/date.ts**

```ts
/**
 * Format date for display in locale format (e.g. "19 февраля 2026")
 */
export function formatLocalDate(dateStr: string, locale = 'ru-RU'): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
```

**Step 2: Replace local formatDate in both changelog files**

In both `ChangelogModal.vue` and `ChangelogPage.vue`, remove the local `formatDate` function and import from shared:

```ts
import { formatLocalDate } from '@/shared/lib/format/date';
```

Replace `formatDate(entry.date)` with `formatLocalDate(entry.date)`.

**Step 3: Verify build**

Run: `cd frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/shared/lib/format/date.ts frontend/src/features/changelog/ frontend/src/pages/changelog/
git commit -m "refactor: extract formatLocalDate to shared/lib/format"
```

---

### Task 11: Move ENTITY_COLORS to shared/config

**Files:**
- Create: `frontend/src/shared/config/colors.ts`
- Modify: `frontend/src/entities/account/model/types.ts`
- Modify: `frontend/src/features/create-reminder/model/useCreateReminder.ts`

**Step 1: Create shared/config/colors.ts**

```ts
/**
 * Shared color palette for entities (accounts, reminders, etc.)
 */
export const ENTITY_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#f59e0b', // Amber
  '#1f2937', // Dark
] as const;
```

**Step 2: Update entities/account/model/types.ts**

Replace the `ACCOUNT_COLORS` definition with a re-export:

```ts
import { ENTITY_COLORS } from '@/shared/config/colors';

/** @deprecated Use ENTITY_COLORS from @/shared/config/colors */
export const ACCOUNT_COLORS = ENTITY_COLORS;
```

This preserves backward compatibility — existing imports of `ACCOUNT_COLORS` from `@/entities/account` still work.

**Step 3: Update useCreateReminder.ts**

Replace `import { ACCOUNT_COLORS } from '@/entities/account'` with `import { ENTITY_COLORS } from '@/shared/config/colors'` and use `ENTITY_COLORS[0]` instead of `ACCOUNT_COLORS[0]`.

**Step 4: Verify build**

Run: `cd frontend && bun run build`

**Step 5: Commit**

```bash
git add frontend/src/shared/config/ frontend/src/entities/account/ frontend/src/features/create-reminder/
git commit -m "refactor: move ENTITY_COLORS to shared/config, fix cross-entity dependency"
```

---

### Task 12: Fix raw design token in RemindersListPage

**Files:**
- Modify: `frontend/src/pages/reminders/list/RemindersListPage.vue`

**Step 1: Replace `text-blue-500` with semantic token**

Find `text-blue-500` and replace with `text-primary` (or appropriate semantic token from the design system).

**Step 2: Verify build**

Run: `cd frontend && bun run build`

**Step 3: Commit**

```bash
git add frontend/src/pages/reminders/
git commit -m "fix: replace raw text-blue-500 with semantic design token"
```

---

### Task 13: Migrate inline empty states to EmptyState component

**Files:**
- Modify: `frontend/src/pages/accounts/AccountsPage.vue`
- Modify: `frontend/src/pages/debts/list/DebtsListPage.vue`
- Modify: `frontend/src/pages/reminders/list/RemindersListPage.vue`

**Step 1: Read each page to understand the inline empty state**

Each has a custom empty state with different icons, text, and actions. Map each to `EmptyState` props.

**Step 2: Replace inline empty states**

Example for AccountsPage:
```vue
<EmptyState
  icon="account_balance_wallet"
  title="Нет счетов"
  description="Добавьте свой первый счёт"
  :action="{ label: 'Добавить счёт', onClick: () => router.push({ name: 'create-account' }) }"
/>
```

Adapt icon, title, description, and action for each page. The `EmptyState` component supports `variant="inline"` for card-style empty states.

**Step 3: Verify build**

Run: `cd frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/pages/
git commit -m "refactor: migrate inline empty states to EmptyState component"
```

---

### Task 14: Extract shared changelog components

**Files:**
- Create: `frontend/src/features/changelog/ui/VersionBadge.vue`
- Create: `frontend/src/features/changelog/ui/ChangelogEntryItem.vue`
- Modify: `frontend/src/features/changelog/ui/ChangelogModal.vue`
- Modify: `frontend/src/pages/changelog/ChangelogPage.vue`

**Step 1: Extract VersionBadge**

```vue
<script setup lang="ts">
defineProps<{ version: string }>();
</script>

<template>
  <span
    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-primary to-primary/80 text-white"
  >
    v{{ version }}
  </span>
</template>
```

**Step 2: Extract ChangelogEntryItem**

Extract the repeated changelog entry rendering (type icon badge + title + items list) into a shared component used by both the modal and the page.

**Step 3: Migrate both consumers**

**Step 4: Verify build**

Run: `cd frontend && bun run build`

**Step 5: Commit**

```bash
git add frontend/src/features/changelog/ frontend/src/pages/changelog/
git commit -m "refactor: extract VersionBadge and ChangelogEntryItem components"
```

---

## Execution Order

Tasks 1-5 (UI components) → Tasks 6-9 (composables) → Tasks 10-14 (utilities & cleanup)

Each task is independently buildable and committable. No task depends on another except that tasks within the same file should be done in order.

## Verification

After all tasks: run `cd frontend && bun run build` to verify no regressions. Optionally run the dev server (`bun run dev`) and manually test detail pages, delete flows, and transaction history.
