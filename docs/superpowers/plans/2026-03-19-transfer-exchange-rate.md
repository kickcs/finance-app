# Transfer Exchange Rate Editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visible, editable exchange rate field to the transfer tab so users can see and override the API exchange rate when transferring between different currencies.

**Architecture:** Single-file change to `TransferPanel.vue`. New local refs (`exchangeRate`, `isUserEditingRate`) manage rate state. Existing watcher replaced with explicit handler functions. New UI section mirrors commission row styling.

**Tech Stack:** Vue 3 Composition API, `useExchangeRates` composable, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-19-transfer-exchange-rate-design.md`

---

### Task 1: Add exchange rate state and API loading helper

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/TransferPanel.vue:1-37`

- [ ] **Step 1: Add new refs and destructure `rates`**

In the `<script setup>` block, change line 2 to remove `watch` and `nextTick` imports (no longer needed):
```typescript
import { computed, ref } from 'vue';
```

Change line 37 to also destructure `rates`:
```typescript
const { convertBetween, rates } = useExchangeRates(baseCurrency);
```

Add new refs and helpers after the `useExchangeRates` line:
```typescript
const exchangeRate = ref<number | null>(null);
const isUserEditingRate = ref(false);

function loadRateFromApi(fromCurrency: string, toCurrency: string): number | null {
  if (fromCurrency === toCurrency) return null;
  if (!rates.value) return null;
  return convertBetween(1, fromCurrency, toCurrency);
}

function recalcToAmount(amount: number, rate: number | null): number | null {
  if (rate === null || rate <= 0) return null;
  return Math.round(amount * rate * 100) / 100;
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd frontend && bun run build`
Expected: Build succeeds (unused refs are fine in Vue)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/ui/TransferPanel.vue
git commit -m "feat(transfer): add exchangeRate ref and API loading helper"
```

---

### Task 2: Update currency/account change handlers to use exchangeRate ref

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/TransferPanel.vue:79-210`

All 5 handlers that currently call `calculateConvertedAmount` must be updated to go through `exchangeRate` ref instead. Each also resets `isUserEditingRate = false` (API rate loaded, not user-edited).

- [ ] **Step 1: Update `handleSourceSelect`**

Find the existing `handleSourceSelect` function and replace it:
```typescript
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
      const rate = loadRateFromApi(firstCurrency, otherCurrencies[0].currency);
      exchangeRate.value = rate;
      isUserEditingRate.value = false;
      updates.toCurrency = otherCurrencies[0].currency;
      updates.toAmount = recalcToAmount(props.formData.amount, rate);
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
```

- [ ] **Step 2: Update `handleTargetSelect`**

Find the existing `handleTargetSelect` function and replace it:
```typescript
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

  const rate = loadRateFromApi(props.formData.currency, firstCurrency);
  exchangeRate.value = rate;
  isUserEditingRate.value = false;
  const toAmount = recalcToAmount(props.formData.amount, rate);

  emit('update:formData', {
    ...props.formData,
    toAccountId: accountId,
    toCurrency: firstCurrency,
    toAmount,
  });
  targetOpen.value = false;
}
```

- [ ] **Step 3: Update `handleSwap`**

Find the existing `handleSwap` function and replace it:
```typescript
function handleSwap() {
  if (!props.formData.toAccountId || !props.formData.toCurrency) return;

  const newSourceId = props.formData.toAccountId;
  const newSourceCurrency = props.formData.toCurrency;
  const newTargetId = props.formData.accountId;
  const newTargetCurrency = props.formData.currency;

  const rate = loadRateFromApi(newSourceCurrency, newTargetCurrency);
  exchangeRate.value = rate;
  isUserEditingRate.value = false;
  const newToAmount = recalcToAmount(props.formData.amount, rate);

  emit('update:formData', {
    ...props.formData,
    accountId: newSourceId,
    currency: newSourceCurrency,
    toAccountId: newTargetId,
    toCurrency: newTargetCurrency,
    toAmount: newToAmount,
  });
}
```

- [ ] **Step 4: Update `handleToCurrencyChange`**

Find the existing `handleToCurrencyChange` function and replace it:
```typescript
function handleToCurrencyChange(currency: string) {
  const rate = loadRateFromApi(props.formData.currency, currency);
  exchangeRate.value = rate;
  isUserEditingRate.value = false;
  const toAmount = recalcToAmount(props.formData.amount, rate);

  emit('update:formData', {
    ...props.formData,
    toCurrency: currency,
    toAmount,
  });
}
```

- [ ] **Step 5: Update `handleSourceCurrencyChange`**

Find the existing `handleSourceCurrencyChange` function and replace it:
```typescript
function handleSourceCurrencyChange(newCurrency: string) {
  const updates: Partial<TransactionFormData> = { currency: newCurrency };

  if (
    props.formData.toAccountId === props.formData.accountId &&
    props.formData.toCurrency === newCurrency
  ) {
    const account = props.accounts.find((a) => a.id === props.formData.accountId);
    const otherCurrency = account?.balances.find((b) => b.currency !== newCurrency)?.currency;
    if (otherCurrency) {
      const rate = loadRateFromApi(newCurrency, otherCurrency);
      exchangeRate.value = rate;
      isUserEditingRate.value = false;
      updates.toCurrency = otherCurrency;
      updates.toAmount = recalcToAmount(props.formData.amount, rate);
    }
  } else if (props.formData.toCurrency && props.formData.toCurrency !== newCurrency) {
    const rate = loadRateFromApi(newCurrency, props.formData.toCurrency);
    exchangeRate.value = rate;
    isUserEditingRate.value = false;
    updates.toAmount = recalcToAmount(props.formData.amount, rate);
  }

  emit('update:formData', { ...props.formData, ...updates });
}
```

- [ ] **Step 6: Verify build compiles**

Run: `cd frontend && bun run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/add-transaction/ui/TransferPanel.vue
git commit -m "feat(transfer): route all currency/account handlers through exchangeRate ref"
```

---

### Task 3: Add handleAmountChange, update handleTargetAmountChange, remove watcher, add initial seeding

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/TransferPanel.vue`

- [ ] **Step 1: Add `handleAmountChange` function**

Add after the `handleSourceCurrencyChange` function:
```typescript
function handleAmountChange(newAmount: number) {
  const toAmount = recalcToAmount(newAmount, exchangeRate.value);
  emit('update:formData', {
    ...props.formData,
    amount: newAmount,
    ...(toAmount !== null ? { toAmount } : {}),
  });
}
```

- [ ] **Step 2: Rewrite `handleTargetAmountChange`**

Find the existing `handleTargetAmountChange` function and replace it. **Behavioral change:** no longer back-calculates `amount`; adjusts `exchangeRate` instead:
```typescript
function handleTargetAmountChange(newToAmount: number) {
  if (!props.formData.currency || !props.formData.toCurrency) return;

  if (props.formData.amount > 0) {
    exchangeRate.value = newToAmount / props.formData.amount;
    isUserEditingRate.value = true;
  }

  emit('update:formData', {
    ...props.formData,
    toAmount: newToAmount,
  });
}
```

- [ ] **Step 3: Add `handleRateChange` function**

Add after `handleTargetAmountChange`:
```typescript
function handleRateChange(value: string) {
  const num = parseFloat(value.replace(',', '.'));
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
```

- [ ] **Step 4: Remove `skipWatcherRecalc` and the old watcher**

Find and delete `let skipWatcherRecalc = false;` (search by content, not line number).

Find and delete the entire watcher block (search for `// Auto-recalculate toAmount when amount or currencies change` comment and delete the `watch(...)` call that follows it, through its closing `);`).

- [ ] **Step 5: Add initial rate seeding watch**

The old watcher is removed, but we need to seed `exchangeRate` when the component initializes with a pre-existing currency pair (e.g. form pre-populated). Add after the helpers:

```typescript
import { watch } from 'vue';
```

Update the import line to include `watch` (keep `computed` and `ref` too):
```typescript
import { computed, ref, watch } from 'vue';
```

Add a watch that seeds the rate only when it's null and both currencies are set:
```typescript
watch(
  () => [props.formData.currency, props.formData.toCurrency] as const,
  ([fromCurrency, toCurrency]) => {
    if (fromCurrency && toCurrency && fromCurrency !== toCurrency && exchangeRate.value === null) {
      exchangeRate.value = loadRateFromApi(fromCurrency, toCurrency);
    }
  },
  { immediate: true },
);
```

This watch only fires when `exchangeRate` is `null` — once the user or a handler sets it, the watch becomes a no-op. It covers the initial load case.

- [ ] **Step 6: Verify build compiles**

Run: `cd frontend && bun run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/add-transaction/ui/TransferPanel.vue
git commit -m "feat(transfer): add handleAmountChange/handleRateChange, seed rate on init"
```

---

### Task 4: Update template — HeroAmount binding + exchange rate UI section

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/TransferPanel.vue:271-531` (template)

- [ ] **Step 1: Change source HeroAmount `@update:amount` binding**

Change line 282 from:
```html
@update:amount="updateField('amount', $event)"
```
to:
```html
@update:amount="handleAmountChange"
```

- [ ] **Step 2: Add exchange rate section in template**

Insert after the target account `</Popover>` (after line 468) and before the commission `<Transition name="fee">` (line 471):

```html
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
            <span
              class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
            >
              {{ formData.toCurrency }}
            </span>
          </div>
          <p class="mt-1 text-[11px] text-text-tertiary-light dark:text-text-tertiary-dark pl-7">
            1 {{ formData.currency }} = {{ exchangeRate ?? '—' }} {{ formData.toCurrency }}
          </p>
        </div>
      </Transition>
```

- [ ] **Step 3: Clean up unused code**

Remove `nextTick` from the Vue import (no longer used). Keep `computed`, `ref`, `watch`:
```typescript
import { computed, ref, watch } from 'vue';
```

Remove the `calculateConvertedAmount` function (search by name) — it's no longer called by any handler after Task 2 changes. `loadRateFromApi` + `recalcToAmount` replaced its role.

- [ ] **Step 4: Verify build compiles**

Run: `cd frontend && bun run build`
Expected: Build succeeds with no type errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/add-transaction/ui/TransferPanel.vue
git commit -m "feat(transfer): add exchange rate UI section and wire up template bindings"
```

---

### Task 5: Build verification and manual testing

**Files:**
- None new — verification only

- [ ] **Step 1: Run full build**

Run: `cd frontend && bun run build`
Expected: Clean build, no errors

- [ ] **Step 2: Verify no lint errors**

Run: `cd frontend && bunx vue-tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Final commit if any cleanup needed**

Only if steps 1-2 revealed issues that needed fixing.
