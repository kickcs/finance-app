# AddTransactionPage Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Add Transaction page with hero-style amount input, chip-based category selection (2-row horizontal scroll), and fixed single-screen layout.

**Architecture:** Replace `AmountInput.vue` with new `HeroAmount.vue` (large centered amount, tap-to-focus hidden input). Replace `CategoryCard` grid in `ExpensePanel`/`IncomePanel` with new `CategoryChips.vue` (2-row horizontal scroll chips with icon + full name). Wrap everything in `h-dvh flex flex-col` layout. Keep all business logic, swipe tabs, split expense, and transfer panel unchanged.

**Tech Stack:** Vue 3 Composition API, Tailwind CSS v4, existing design tokens, existing shared UI components.

---

### Task 1: Create HeroAmount.vue component

**Files:**
- Create: `frontend/src/features/add-transaction/ui/HeroAmount.vue`

**Step 1: Create HeroAmount component**

```vue
<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { UIcon } from '@/shared/ui';
import { getCurrencyByCode } from '@/entities/currency';
import { formatNumberWithSpaces } from '@/shared/lib/format/currency';
import { formatCurrency } from '@/shared/lib/format/currency';

const props = defineProps<{
  amount: number;
  currency: string;
  currencySymbol: string;
  availableCurrencies: string[];
  isMultiCurrency: boolean;
  label?: string;
  showInsufficientFunds?: boolean;
  currentBalance?: number;
  autofocus?: boolean;
}>();

const emit = defineEmits<{
  'update:amount': [value: number];
  'update:currency': [value: string];
}>();

const hiddenInputRef = ref<HTMLInputElement | null>(null);

const displayAmount = computed(() => {
  if (props.amount === 0) return '0';
  return formatNumberWithSpaces(props.amount);
});

function focusInput() {
  hiddenInputRef.value?.focus();
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = Number(target.value) || 0;
  emit('update:amount', value);
}

onMounted(() => {
  if (props.autofocus) {
    nextTick(() => focusInput());
  }
});
</script>

<template>
  <div class="flex flex-col items-center gap-1 py-2" @click="focusInput">
    <!-- Hidden input for system keyboard -->
    <input
      ref="hiddenInputRef"
      type="number"
      inputmode="numeric"
      :value="amount || ''"
      class="sr-only"
      @input="handleInput"
      @keydown.enter.prevent
    />

    <!-- Amount display -->
    <div class="flex items-baseline gap-1.5 cursor-text">
      <span
        class="text-4xl font-semibold text-text-primary-light dark:text-text-primary-dark tabular-nums transition-all duration-150"
      >
        {{ displayAmount }}
      </span>
      <!-- Currency badge / selector -->
      <div v-if="isMultiCurrency" class="relative">
        <select
          :value="currency"
          class="appearance-none bg-surface-light dark:bg-surface-dark rounded-md px-1.5 py-0.5 text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark focus:outline-none focus:ring-1 focus:ring-primary pr-5"
          @change="emit('update:currency', ($event.target as HTMLSelectElement).value)"
          @click.stop
        >
          <option v-for="cur in availableCurrencies" :key="cur" :value="cur">
            {{ cur }}
          </option>
        </select>
        <UIcon
          name="expand_more"
          size="xs"
          class="absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary-light dark:text-text-tertiary-dark"
        />
      </div>
      <span
        v-else
        class="text-lg text-text-tertiary-light dark:text-text-tertiary-dark font-medium"
      >
        {{ currencySymbol }}
      </span>
    </div>

    <!-- Balance info -->
    <p
      v-if="currentBalance !== undefined"
      :class="[
        'text-xs transition-colors',
        showInsufficientFunds && amount > 0
          ? 'text-warning'
          : 'text-text-tertiary-light dark:text-text-tertiary-dark',
      ]"
    >
      <template v-if="showInsufficientFunds && amount > 0">
        Недостаточно средств.
      </template>
      Баланс: {{ formatCurrency(currentBalance, currency) }}
    </p>
  </div>
</template>
```

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/ui/HeroAmount.vue
git commit -m "feat: add HeroAmount component for redesigned transaction page"
```

---

### Task 2: Create CategoryChips.vue component

**Files:**
- Create: `frontend/src/features/add-transaction/ui/CategoryChips.vue`

**Step 1: Create CategoryChips component**

```vue
<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import type { Category } from '@/entities/category';

defineProps<{
  categories: Category[];
  selectedId: string;
  label?: string;
}>();

const emit = defineEmits<{
  select: [categoryId: string];
}>();
</script>

<template>
  <div class="space-y-2">
    <label
      v-if="label"
      class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
    >
      {{ label }}
    </label>
    <div class="overflow-x-auto no-scrollbar -mx-4 px-4">
      <div class="flex flex-col gap-1.5 w-max">
        <!-- Row 1: first half -->
        <div class="flex gap-1.5">
          <button
            v-for="category in categories.slice(0, Math.ceil(categories.length / 2))"
            :key="category.id"
            type="button"
            :class="[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all text-sm border',
              'active:scale-95',
              selectedId === category.id
                ? 'shadow-sm'
                : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark',
            ]"
            :style="
              selectedId === category.id
                ? {
                    borderColor: category.color,
                    backgroundColor: `${category.color}15`,
                    color: category.color,
                  }
                : {}
            "
            @click="emit('select', category.id)"
          >
            <UIcon :name="category.icon" size="xs" :style="{ color: category.color }" />
            <span class="font-medium">{{ category.name }}</span>
          </button>
        </div>
        <!-- Row 2: second half -->
        <div class="flex gap-1.5">
          <button
            v-for="category in categories.slice(Math.ceil(categories.length / 2))"
            :key="category.id"
            type="button"
            :class="[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all text-sm border',
              'active:scale-95',
              selectedId === category.id
                ? 'shadow-sm'
                : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark',
            ]"
            :style="
              selectedId === category.id
                ? {
                    borderColor: category.color,
                    backgroundColor: `${category.color}15`,
                    color: category.color,
                  }
                : {}
            "
            @click="emit('select', category.id)"
          >
            <UIcon :name="category.icon" size="xs" :style="{ color: category.color }" />
            <span class="font-medium">{{ category.name }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
```

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/ui/CategoryChips.vue
git commit -m "feat: add CategoryChips component with 2-row horizontal scroll"
```

---

### Task 3: Update ExpensePanel to use new components

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/ExpensePanel.vue`

**Step 1: Replace AmountInput with HeroAmount and CategoryCard grid with CategoryChips**

Replace imports:
- Remove: `import AmountInput from './AmountInput.vue';`
- Remove: `import { CategoryCard } from '@/entities/category';`
- Add: `import HeroAmount from './HeroAmount.vue';`
- Add: `import CategoryChips from './CategoryChips.vue';`

Replace template `<AmountInput ... />` block with:
```vue
<HeroAmount
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
```

Replace the category `<div class="space-y-2">` block with:
```vue
<CategoryChips
  :categories="categories"
  :selected-id="formData.categoryId"
  label="Категория"
  @select="updateField('categoryId', $event)"
/>
```

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/ui/ExpensePanel.vue
git commit -m "refactor: update ExpensePanel to use HeroAmount and CategoryChips"
```

---

### Task 4: Update IncomePanel to use new components

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/IncomePanel.vue`

**Step 1: Same pattern as ExpensePanel**

Replace imports:
- Remove: `import AmountInput from './AmountInput.vue';`
- Remove: `import { CategoryCard } from '@/entities/category';`
- Add: `import HeroAmount from './HeroAmount.vue';`
- Add: `import CategoryChips from './CategoryChips.vue';`

Replace template `<AmountInput ... />` with:
```vue
<HeroAmount
  :amount="formData.amount"
  :currency="formData.currency"
  :currency-symbol="currencySymbol"
  :available-currencies="availableCurrencies"
  :is-multi-currency="isMultiCurrency"
  @update:amount="updateField('amount', $event)"
  @update:currency="updateField('currency', $event)"
/>
```

Replace the category `<div class="space-y-2">` block with:
```vue
<CategoryChips
  :categories="categories"
  :selected-id="formData.categoryId"
  label="Категория"
  @select="updateField('categoryId', $event)"
/>
```

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/ui/IncomePanel.vue
git commit -m "refactor: update IncomePanel to use HeroAmount and CategoryChips"
```

---

### Task 5: Update TransferPanel to use HeroAmount

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/TransferPanel.vue`

**Step 1: Replace AmountInput with HeroAmount**

Replace import:
- Remove: `import AmountInput from './AmountInput.vue';`
- Add: `import HeroAmount from './HeroAmount.vue';`

Replace template `<AmountInput ... />` with:
```vue
<HeroAmount
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
```

Note: `label` prop is needed here because TransferPanel shows "Сумма списания".

**Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/ui/TransferPanel.vue
git commit -m "refactor: update TransferPanel to use HeroAmount"
```

---

### Task 6: Update AddTransactionPage layout to h-dvh fixed layout

**Files:**
- Modify: `frontend/src/pages/transactions/new/AddTransactionPage.vue`

**Step 1: Change page container layout**

Replace outer div class:
```
Old: class="min-h-screen bg-background-light dark:bg-background-dark pb-24"
New: class="h-dvh flex flex-col bg-background-light dark:bg-background-dark overflow-hidden"
```

Replace `<main>` wrapper:
```
Old: <main class="px-4 pt-4 pb-4">
New: <main class="flex-1 flex flex-col overflow-hidden px-4 pt-2">
```

The loading/empty states stay the same. For the `<TransactionForm>` add `class="flex-1 flex flex-col overflow-hidden"`.

**Step 2: Update TransactionForm.vue layout**

In `TransactionForm.vue`, change the `<form>` classes:

```
Old: class="space-y-4 transition-opacity duration-200"
New: class="flex-1 flex flex-col gap-3 transition-opacity duration-200"
```

Make the swipeable panels section take remaining space: wrap the category/form content area. The submit button section should be at the bottom:

Add `mt-auto` to the bottom section (description + date + submit button area).

**Step 3: Verify build**

Run: `cd frontend && bun run build`
Expected: No TypeScript errors

**Step 4: Visual check**

Run: `cd frontend && bun run dev`
Open browser, navigate to Add Transaction page, verify:
- Page fills viewport without scroll
- Amount is centered and large
- Categories show as 2-row horizontal scroll chips
- Submit button is at bottom
- Tabs + swipe still work

**Step 5: Commit**

```bash
git add frontend/src/pages/transactions/new/AddTransactionPage.vue frontend/src/features/add-transaction/ui/TransactionForm.vue
git commit -m "refactor: update AddTransactionPage to h-dvh fixed layout"
```

---

### Task 7: Polish and cleanup

**Files:**
- Modify: Various files as needed

**Step 1: Final visual adjustments**

- Test dark mode
- Test with different account configurations (single currency, multi-currency)
- Test all three tabs (expense, income, transfer)
- Test split expense still works on expense tab
- Test hashtag suggestions still appear
- Verify `no-scrollbar` class hides scrollbar on category chips

**Step 2: Run full build**

Run: `cd frontend && bun run build`
Expected: Clean build, no errors

**Step 3: Final commit**

```bash
git add -A
git commit -m "style: polish AddTransactionPage redesign"
```
