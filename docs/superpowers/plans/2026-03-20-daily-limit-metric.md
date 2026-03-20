# Daily Spending Limit in BalanceCard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a daily spending limit (budget.remaining / daysRemaining) inside the BalanceCard on the dashboard, so users instantly see how much they can spend per day.

**Architecture:** Frontend-only change. `useDashboardData` computes the daily limit from existing `useBudget` data and passes it as props to a redesigned `BalanceCard`. No backend changes.

**Tech Stack:** Vue 3, TypeScript, Tailwind CSS v4, VueUse (`useTimestamp`), TanStack Vue Query

**Spec:** `docs/superpowers/specs/2026-03-20-daily-limit-metric-design.md`

---

### Task 1: Add dailyLimit computation to useDashboardData

**Files:**
- Modify: `frontend/src/pages/dashboard/model/useDashboardData.ts`

- [ ] **Step 1: Add reactive daysRemaining and dailyLimit computeds**

Add imports and computed properties after the `totalBalance` computed (line 85):

```typescript
import { useTimestamp } from '@vueuse/core';

// Inside useDashboardData(), after totalBalance computed:

// Reactive timestamp that updates every minute — keeps daysRemaining fresh across midnight
const timestamp = useTimestamp({ interval: 60_000 });

const daysRemainingInMonth = computed(() => {
  const now = new Date(timestamp.value);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(1, lastDay - now.getDate() + 1);
});

const dailyLimit = computed(() => {
  if (!budget.value) return null;
  return budget.value.remaining / daysRemainingInMonth.value;
});

const dailyLimitCurrency = computed(() => {
  if (!budget.value) return null;
  return budget.value.budget.currency;
});
```

Note: `budget` is already available from `useBudget(userId)` at line 24-31. `useTimestamp` is from `@vueuse/core` (already a project dependency).

- [ ] **Step 2: Expose new values in return object**

Add to the return statement (after line 108 `budgetLoading,`):

```typescript
dailyLimit,
dailyLimitCurrency,
daysRemainingInMonth,
```

- [ ] **Step 3: Verify no type errors**

Run: `cd frontend && npx vue-tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `useDashboardData`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/dashboard/model/useDashboardData.ts
git commit -m "feat(dashboard): add dailyLimit computation to useDashboardData"
```

---

### Task 2: Redesign BalanceCard component

**Files:**
- Modify: `frontend/src/widgets/balance-card/ui/BalanceCard.vue`

- [ ] **Step 1: Update props interface**

Replace the existing `defineProps` block (lines 5-10) with:

```typescript
defineProps<{
  totalBalance: number;
  currency: string;
  dailyLimit?: number | null;
  dailyLimitCurrency?: string | null;
  daysRemaining?: number;
  loading?: boolean;
  hidden?: boolean;
}>();
```

- [ ] **Step 2: Replace template with new two-column layout**

Replace the entire `<template>` content (lines 18-88) with:

```vue
<template>
  <div
    class="balance-card relative overflow-hidden rounded-[2rem] bg-card-light dark:bg-card-dark p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300 md:hover:-translate-y-1"
  >
    <div class="relative z-10 flex items-center justify-between gap-4">
      <!-- Left Side: Balance -->
      <div class="flex flex-col min-w-0">
        <!-- Balance Label + Eye Toggle -->
        <div class="flex items-center gap-2 mb-1.5">
          <div
            class="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary"
          >
            <UIcon name="account_balance_wallet" size="xs" />
          </div>
          <p
            class="text-xs font-semibold tracking-wide text-text-secondary-light dark:text-text-secondary-dark uppercase"
          >
            Баланс
          </p>
          <button
            :aria-label="hidden ? 'Показать баланс' : 'Скрыть баланс'"
            class="p-1 rounded-lg text-text-tertiary-light dark:text-text-tertiary-dark hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary-light dark:hover:text-text-primary-dark transition-all duration-200"
            @click.stop="$emit('toggle-hidden')"
          >
            <UIcon :name="hidden ? 'visibility_off' : 'visibility'" size="xs" />
          </button>
        </div>

        <!-- Balance Amount -->
        <Skeleton v-if="loading" class="h-9 w-[180px] rounded-xl" />
        <button
          v-else
          type="button"
          aria-label="Перейти к счетам"
          class="group/btn flex items-center outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-primary"
          @click="$emit('balance-click')"
        >
          <span
            class="text-xl sm:text-2xl font-extrabold tracking-tight text-text-primary-light dark:text-text-primary-dark group-hover/btn:text-primary transition-colors duration-300 truncate leading-tight"
          >
            {{ formatMasked(totalBalance, currency, hidden ?? false) }}
          </span>
        </button>
      </div>

      <!-- Divider (only with budget) -->
      <div
        v-if="dailyLimit != null"
        class="w-px self-stretch my-1 bg-border-light dark:bg-border-dark"
      />

      <!-- Right Side: Daily Limit (only with budget) -->
      <div v-if="dailyLimit != null" class="flex flex-col items-end shrink-0">
        <Skeleton v-if="loading" class="h-4 w-16 rounded mb-1.5" />
        <template v-else>
          <p
            class="text-xs font-semibold tracking-wide uppercase mb-1"
            :class="dailyLimit >= 0 ? 'text-success/60' : 'text-danger/60'"
          >
            В день
          </p>
          <span
            class="text-lg sm:text-xl font-bold leading-tight"
            :class="dailyLimit >= 0 ? 'text-success' : 'text-danger'"
          >
            {{ formatMasked(Math.abs(dailyLimit), dailyLimitCurrency ?? currency, hidden ?? false) }}
          </span>
          <span
            class="text-[0.65rem] font-medium text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5"
          >
            осталось {{ daysRemaining }} дн
          </span>
        </template>
      </div>

      <!-- Desktop: 'К счетам' Button -->
      <div class="hidden md:flex shrink-0">
        <button
          type="button"
          aria-label="Перейти ко всем счетам"
          class="group/nav flex items-center gap-2 h-9 text-sm font-semibold text-primary hover:text-primary-hover transition-colors px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20"
          @click="$emit('balance-click')"
        >
          К счетам
          <UIcon
            name="arrow_forward"
            size="sm"
            class="transition-transform group-hover/nav:translate-x-1"
          />
        </button>
      </div>
    </div>
  </div>
</template>
```

Key changes:
- Removed "Общий баланс", replaced with "Баланс"
- Left-aligned balance
- Added conditional divider + right side (daily limit) when `dailyLimit != null`
- Compact padding (`p-5` instead of `p-6`)
- Smaller text sizes for tighter layout
- Color: `text-success` when positive, `text-danger` when overspent
- `formatMasked` used on daily limit with `dailyLimitCurrency`

- [ ] **Step 3: Keep existing `<style scoped>` block unchanged**

The blob animation and rotating border CSS stays as-is (lines 91-189). No changes needed.

- [ ] **Step 4: Verify no type errors**

Run: `cd frontend && npx vue-tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in BalanceCard.vue

- [ ] **Step 5: Commit**

```bash
git add frontend/src/widgets/balance-card/ui/BalanceCard.vue
git commit -m "feat(balance-card): redesign with daily spending limit"
```

---

### Task 3: Update BalanceCardSkeleton

**Files:**
- Modify: `frontend/src/widgets/balance-card/ui/BalanceCardSkeleton.vue`

- [ ] **Step 1: Replace skeleton layout to match new two-column design**

Replace the entire file content with:

```vue
<script setup lang="ts">
import { UCard, Skeleton } from '@/shared/ui';
</script>

<template>
  <UCard class="relative overflow-hidden">
    <!-- Decorative gradient blob (static) -->
    <div
      class="absolute -top-20 -right-16 w-48 h-48 rounded-full blur-3xl opacity-40"
      style="
        background: radial-gradient(
          circle,
          color-mix(in srgb, var(--color-primary) 40%, transparent) 0%,
          transparent 70%
        );
      "
    />

    <div class="relative z-10 p-5">
      <div class="flex items-center justify-between gap-4">
        <!-- Left: Balance skeleton -->
        <div class="flex flex-col gap-1.5">
          <Skeleton class="h-3.5 w-20 rounded" />
          <Skeleton class="h-9 w-44 rounded-xl" />
        </div>

        <!-- Right: Daily limit skeleton -->
        <div class="flex flex-col items-end gap-1.5">
          <Skeleton class="h-3 w-12 rounded" />
          <Skeleton class="h-7 w-32 rounded-xl" />
          <Skeleton class="h-2.5 w-20 rounded" />
        </div>
      </div>
    </div>
  </UCard>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/widgets/balance-card/ui/BalanceCardSkeleton.vue
git commit -m "feat(balance-card): update skeleton for two-column layout"
```

---

### Task 4: Pass new props in DashboardPage

**Files:**
- Modify: `frontend/src/pages/dashboard/DashboardPage.vue`

- [ ] **Step 1: Add new values to useDashboardData destructure**

Find the `useDashboardData()` destructure (near top of `<script setup>`) and add:

```typescript
dailyLimit,
dailyLimitCurrency,
daysRemainingInMonth,
```

- [ ] **Step 2: Update mobile BalanceCard usage (around line 254)**

Replace:

```vue
<BalanceCard
  :total-balance="totalBalance"
  :currency="currency"
  :loading="accountsLoading || ratesLoading"
  :hidden="isHidden"
  @toggle-hidden="isHidden = !isHidden"
  @balance-click="nav.toAccounts"
/>
```

With:

```vue
<BalanceCard
  :total-balance="totalBalance"
  :currency="currency"
  :daily-limit="dailyLimit"
  :daily-limit-currency="dailyLimitCurrency"
  :days-remaining="daysRemainingInMonth"
  :loading="accountsLoading || ratesLoading || budgetLoading"
  :hidden="isHidden"
  @toggle-hidden="isHidden = !isHidden"
  @balance-click="nav.toAccounts"
/>
```

Note: added `budgetLoading` to loading condition so skeleton covers budget data fetch.

- [ ] **Step 3: Update desktop BalanceCard usage (around line 400)**

Apply the same prop changes as step 2 to the desktop BalanceCard instance.

- [ ] **Step 4: Verify full type-check passes**

Run: `cd frontend && npx vue-tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/dashboard/DashboardPage.vue
git commit -m "feat(dashboard): wire daily limit props to BalanceCard"
```

---

### Task 5: Visual verification and final commit

- [ ] **Step 1: Start dev server and verify**

Run: `cd frontend && bun run dev`

Manual checks:
1. Dashboard loads — BalanceCard shows balance on left
2. If budget is set: daily limit shows on right with green text, "осталось N дн" sub-text
3. If no budget: card shows only balance, no divider, no right side
4. Eye toggle masks both balance and daily limit amounts
5. "осталось N дн" stays visible when hidden
6. Overspent budget shows red daily limit
7. Desktop: "К счетам" button on far right

- [ ] **Step 2: Update changelog**

Add entry at top of `frontend/src/features/changelog/model/changelogData.ts`:

Update `CURRENT_VERSION` to `'1.0.38'`, then add at top of `CHANGELOG_ENTRIES`:

```typescript
{
  version: '1.0.38',
  date: '2026-03-20',
  title: 'Дневной лимит расходов',
  items: [
    {
      type: 'feature',
      text: 'Дневной лимит расходов теперь отображается на главном экране',
    },
  ],
},
```

- [ ] **Step 3: Commit changelog**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "docs: add daily limit feature to changelog v1.0.38"
```
