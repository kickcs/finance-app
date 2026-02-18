# Dashboard Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add personalized greeting, quick actions grid, and recent transactions section to the dashboard.

**Architecture:** Three independent features added to `DashboardPage.vue`. Greeting modifies the header slot. Quick Actions is a new inline section (no widget needed — it's just 4 buttons). Recent Transactions is a new widget with Vue Query composable and lazy loading.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), TanStack Vue Query, Tailwind CSS v4, existing design tokens.

---

### Task 1: Personalized Greeting in Header

**Files:**
- Modify: `frontend/src/pages/dashboard/DashboardPage.vue` (lines 241–258, the `#logo` template slot)

**Step 1: Add greeting helper**

In `DashboardPage.vue` `<script setup>`, add after line 60 (after `currency` computed):

```typescript
// Time-based greeting
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 17) return 'Добрый день';
  if (hour >= 17 && hour < 23) return 'Добрый вечер';
  return 'Доброй ночи';
});

const userName = computed(() => {
  const name = profile.value?.name;
  if (!name) return '';
  // Take first name only
  return name.split(' ')[0];
});
```

**Step 2: Update the header `#logo` slot**

Replace the current `#logo` slot content (the "Ouro" branding with gradient icon) with:

```html
<template #logo>
  <div
    class="flex items-center gap-2.5 group cursor-pointer"
    @click="router.push('/profile')"
  >
    <div
      class="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-primary-hover shadow-lg shadow-primary/25 group-hover:shadow-xl group-hover:shadow-primary/30 group-hover:scale-105 transition-all duration-200"
    >
      <span class="text-white font-bold text-base">
        {{ userName ? userName[0].toUpperCase() : 'O' }}
      </span>
    </div>
    <div class="flex flex-col">
      <span
        class="text-xs text-text-secondary-light dark:text-text-secondary-dark leading-tight"
      >
        {{ greeting }}
      </span>
      <span
        class="font-bold text-base text-text-primary-light dark:text-text-primary-dark group-hover:text-primary transition-colors leading-tight"
      >
        {{ userName || 'Ouro' }}
      </span>
    </div>
  </div>
</template>
```

**Step 3: Verify**

Run: `cd frontend && bun run build`
Expected: Build passes with no type errors.

**Step 4: Commit**

```bash
git add frontend/src/pages/dashboard/DashboardPage.vue
git commit -m "feat(dashboard): add personalized time-based greeting in header"
```

---

### Task 2: Quick Actions Grid

**Files:**
- Modify: `frontend/src/pages/dashboard/DashboardPage.vue`

Note: No need for icon map additions — `swap_horiz` (`ArrowLeftRight`), `category` (`LayoutGrid`), `currency_exchange` (`ArrowLeftRight`) already exist in `iconMap.ts`. Need to add `call_split` → map to `Share2` (closest match for splitting).

**Step 1: Add `call_split` to icon map**

Modify `frontend/src/shared/ui/icon/iconMap.ts` — add after the `call_received` entry:

```typescript
call_split: Share2,
```

`Share2` is already imported in that file.

**Step 2: Add Quick Actions section to template**

In `DashboardPage.vue`, add the Quick Actions section between `SaveSpendSection` (line 296 `</section>`) and `AccountStack` (line 298 `<section>`).

```html
<!-- Quick Actions -->
<section>
  <div class="grid grid-cols-4 gap-3">
    <button
      v-for="action in quickActions"
      :key="action.label"
      class="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-surface-light dark:bg-surface-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark active:scale-95 transition-all duration-150"
      @click="router.push(action.route)"
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center"
        :class="action.bgClass"
      >
        <UIcon :name="action.icon" size="sm" :class="action.iconClass" />
      </div>
      <span class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        {{ action.label }}
      </span>
    </button>
  </div>
</section>
```

**Step 3: Add quickActions data in `<script setup>`**

Add after the `handleExpenseClick` function:

```typescript
const quickActions = [
  {
    label: 'Перевод',
    icon: 'swap_horiz',
    route: '/transactions/new?type=transfer',
    bgClass: 'bg-primary/10',
    iconClass: 'text-primary',
  },
  {
    label: 'Разделить',
    icon: 'call_split',
    route: '/transactions/new',
    bgClass: 'bg-success/10',
    iconClass: 'text-success',
  },
  {
    label: 'Курсы',
    icon: 'currency_exchange',
    route: '/settings/currency',
    bgClass: 'bg-warning/10',
    iconClass: 'text-warning',
  },
  {
    label: 'Категории',
    icon: 'category',
    route: '/settings/categories',
    bgClass: 'bg-info/10',
    iconClass: 'text-info',
  },
];
```

**Step 4: Add UIcon import if not already present**

`UIcon` is not currently imported in DashboardPage. Add to imports:

```typescript
import { UIcon } from '@/shared/ui';
```

**Step 5: Verify**

Run: `cd frontend && bun run build`
Expected: Build passes.

**Step 6: Commit**

```bash
git add frontend/src/pages/dashboard/DashboardPage.vue frontend/src/shared/ui/icon/iconMap.ts
git commit -m "feat(dashboard): add quick actions grid (transfer, split, rates, categories)"
```

---

### Task 3: Recent Transactions Widget

**Files:**
- Create: `frontend/src/widgets/recent-transactions/ui/RecentTransactions.vue`
- Create: `frontend/src/widgets/recent-transactions/ui/RecentTransactionsSkeleton.vue`
- Create: `frontend/src/widgets/recent-transactions/index.ts`
- Modify: `frontend/src/entities/transaction/api/useTransactions.ts` — add `useRecentTransactions` composable
- Modify: `frontend/src/entities/transaction/api/queryKeys.ts` — add `recent` key
- Modify: `frontend/src/entities/transaction/api/index.ts` — export new composable
- Modify: `frontend/src/entities/transaction/index.ts` — re-export
- Modify: `frontend/src/pages/dashboard/DashboardPage.vue` — integrate widget

**Step 1: Add query key for recent transactions**

In `frontend/src/entities/transaction/api/queryKeys.ts`, add inside the `transactionQueryKeys` object:

```typescript
recent: (userId: string) =>
  [...transactionQueryKeys.all, 'recent', userId] as const,
```

**Step 2: Create `useRecentTransactions` composable**

Create file `frontend/src/entities/transaction/api/useRecentTransactions.ts`:

```typescript
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { transactionQueryKeys } from './queryKeys';
import { transactionsApi } from './transactionsApi';

export function useRecentTransactions(
  userId: MaybeRefOrGetter<string | null>,
  limit: number = 5,
) {
  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? transactionQueryKeys.recent(uid) : transactionQueryKeys.all;
  });

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const uid = toValue(userId);
      if (!uid) return [];
      return transactionsApi.getAll(uid, limit);
    },
    enabled: computed(() => !!toValue(userId)),
  });

  const transactions = computed(() => data.value ?? []);

  return { transactions, isLoading };
}
```

**Step 3: Export from entity barrel files**

In `frontend/src/entities/transaction/api/index.ts`, add:

```typescript
export { useRecentTransactions } from './useRecentTransactions';
```

In `frontend/src/entities/transaction/index.ts`, add:

```typescript
export { useRecentTransactions } from './api/useRecentTransactions';
```

**Step 4: Create skeleton component**

Create `frontend/src/widgets/recent-transactions/ui/RecentTransactionsSkeleton.vue`:

```vue
<script setup lang="ts">
import { Skeleton } from '@/shared/ui';
</script>

<template>
  <div class="space-y-1">
    <!-- Header skeleton -->
    <div class="flex items-center justify-between mb-3">
      <Skeleton class="h-5 w-40" />
      <Skeleton class="h-4 w-12" />
    </div>
    <!-- Transaction rows -->
    <div
      v-for="i in 3"
      :key="i"
      class="flex items-center gap-3 p-3"
    >
      <Skeleton class="shrink-0 w-9 h-9 rounded-lg" />
      <div class="flex-1 space-y-1.5">
        <Skeleton class="h-4 w-28" />
        <Skeleton class="h-3 w-16" />
      </div>
      <Skeleton class="h-4 w-20 shrink-0" />
    </div>
  </div>
</template>
```

**Step 5: Create the RecentTransactions widget**

Create `frontend/src/widgets/recent-transactions/ui/RecentTransactions.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { TransactionItem, TransactionItemSkeleton } from '@/entities/transaction';
import type { Transaction } from '@/entities/transaction';
import { UIcon, UButton, UBadge, EmptyState } from '@/shared/ui';
import { useAccounts } from '@/entities/account';

const props = defineProps<{
  transactions: Transaction[];
  userId: string;
  loading?: boolean;
  hidden?: boolean;
}>();

defineEmits<{
  'transaction-click': [transaction: Transaction];
  'view-all': [];
  'add-click': [];
}>();

// Get accounts for displaying account names
const { accounts } = useAccounts(computed(() => props.userId));

function getAccountName(accountId: string): string {
  return accounts.value?.find((a) => a.id === accountId)?.name || '';
}

function getToAccountName(toAccountId: string | null): string {
  if (!toAccountId) return '';
  return accounts.value?.find((a) => a.id === toAccountId)?.name || '';
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <h2 class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
          Последние операции
        </h2>
        <UBadge
          v-if="transactions.length > 0 && !loading"
          variant="neutral"
          size="xs"
        >
          {{ transactions.length }}
        </UBadge>
      </div>
      <UButton
        v-if="transactions.length > 0"
        variant="ghost"
        size="xs"
        @click="$emit('view-all')"
      >
        Все
        <template #icon-right>
          <UIcon name="chevron_right" size="xs" />
        </template>
      </UButton>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
      <TransactionItemSkeleton v-for="i in 3" :key="i" />
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else-if="transactions.length === 0"
      icon="receipt_long"
      title="Нет операций"
      description="Добавьте первую транзакцию"
    >
      <UButton variant="primary" size="sm" @click="$emit('add-click')">
        Добавить
      </UButton>
    </EmptyState>

    <!-- Transaction list -->
    <div
      v-else
      class="rounded-xl border border-border-light dark:border-border-dark overflow-hidden divide-y divide-border-light dark:divide-border-dark"
    >
      <TransactionItem
        v-for="tx in transactions"
        :key="tx.id"
        :transaction="tx"
        :account-name="getAccountName(tx.account_id)"
        :to-account-name="getToAccountName(tx.to_account_id)"
        @click="$emit('transaction-click', tx)"
      />
    </div>
  </div>
</template>
```

**Step 6: Create barrel export**

Create `frontend/src/widgets/recent-transactions/index.ts`:

```typescript
export { default as RecentTransactions } from './ui/RecentTransactions.vue';
export { default as RecentTransactionsSkeleton } from './ui/RecentTransactionsSkeleton.vue';
```

**Step 7: Integrate into DashboardPage**

In `frontend/src/pages/dashboard/DashboardPage.vue`:

1. Add imports (lazy-loaded):

```typescript
// Below-fold skeleton fallbacks (add alongside existing ones)
import { RecentTransactionsSkeleton } from '@/widgets/recent-transactions';

// Below-fold widgets — lazy load (add alongside existing ones)
const RecentTransactions = defineAsyncComponent({
  loader: () => import('@/widgets/recent-transactions/ui/RecentTransactions.vue'),
  delay: 0,
});
```

2. Add the composable import and data:

```typescript
import { useRecentTransactions } from '@/entities/transaction';
```

After existing `useReminders` call:

```typescript
const { transactions: recentTransactions, isLoading: recentTxLoading } =
  useRecentTransactions(userId, 5);
```

3. Add handler:

```typescript
function handleTransactionClick(tx: Transaction) {
  router.push(`/history`);
}

function handleViewAllTransactions() {
  router.push('/history');
}
```

4. Add `Transaction` type import — already available via existing imports, add to the `type` import:

```typescript
import type { Transaction } from '@/entities/transaction';
```

5. Add template section between AccountStack and DebtsSection:

```html
<!-- Recent Transactions -->
<section>
  <Suspense>
    <RecentTransactions
      :transactions="recentTransactions"
      :user-id="userId"
      :loading="recentTxLoading"
      :hidden="isHidden"
      @transaction-click="handleTransactionClick"
      @add-click="handleAddTransaction"
      @view-all="handleViewAllTransactions"
    />
    <template #fallback>
      <RecentTransactionsSkeleton />
    </template>
  </Suspense>
</section>
```

**Step 8: Verify**

Run: `cd frontend && bun run build`
Expected: Build passes with no type errors.

**Step 9: Commit**

```bash
git add frontend/src/widgets/recent-transactions/ frontend/src/entities/transaction/ frontend/src/pages/dashboard/DashboardPage.vue
git commit -m "feat(dashboard): add recent transactions widget with lazy loading"
```

---

### Task 4: Final Verification & Changelog

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

**Step 1: Update changelog**

Add new entry at the top of `CHANGELOG_ENTRIES` array. Bump version (minor — new features):

```typescript
{
  version: '<bumped-version>',
  date: '2026-02-17',
  items: [
    { type: 'feature', description: 'Персональное приветствие на главной (доброе утро/день/вечер)' },
    { type: 'feature', description: 'Быстрые действия: перевод, разделить, курсы, категории' },
    { type: 'feature', description: 'Последние 5 операций прямо на главной странице' },
  ],
},
```

**Step 2: Final build check**

Run: `cd frontend && bun run build`
Expected: Build passes.

**Step 3: Commit**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "docs: update changelog with dashboard improvements"
```
