# Custom Quick Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded quick action buttons with user-configurable expense presets (category + account).

**Architecture:** Quick actions stored in localStorage via `useLocalStorage` hook. New feature `configure-quick-action` with a modal for picking category + account. Dashboard reads from localStorage, AddTransactionPage accepts `categoryId` and `accountId` query params.

**Tech Stack:** Vue 3 (Composition API), localStorage, existing UModal, existing category/account entities.

---

### Task 1: Quick Action types and composable

**Files:**
- Create: `frontend/src/features/configure-quick-action/model/types.ts`
- Create: `frontend/src/features/configure-quick-action/model/useQuickActions.ts`

**Step 1: Create types**

Create `frontend/src/features/configure-quick-action/model/types.ts`:

```typescript
export interface QuickAction {
  id: string;
  label: string;
  categoryId: string;
  accountId: string;
}
```

**Step 2: Create composable**

Create `frontend/src/features/configure-quick-action/model/useQuickActions.ts`:

```typescript
import { computed } from 'vue';
import { useLocalStorage } from '@/shared/lib/hooks/useLocalStorage';
import { getCategoryById } from '@/entities/category';
import type { QuickAction } from './types';

const MAX_SLOTS = 4;

export function useQuickActions() {
  const actions = useLocalStorage<QuickAction[]>('quick_actions', []);

  const slots = computed(() => {
    const result: (QuickAction | null)[] = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      result.push(actions.value[i] ?? null);
    }
    return result;
  });

  function addAction(action: Omit<QuickAction, 'id'>) {
    if (actions.value.length >= MAX_SLOTS) return;
    actions.value = [
      ...actions.value,
      { ...action, id: crypto.randomUUID() },
    ];
  }

  function updateAction(id: string, updates: Partial<Omit<QuickAction, 'id'>>) {
    actions.value = actions.value.map((a) =>
      a.id === id ? { ...a, ...updates } : a,
    );
  }

  function removeAction(id: string) {
    actions.value = actions.value.filter((a) => a.id !== id);
  }

  function getCategory(categoryId: string) {
    return getCategoryById(categoryId);
  }

  return { slots, actions, addAction, updateAction, removeAction, getCategory };
}
```

**Step 3: Verify**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/features/configure-quick-action/
git commit -m "feat: add quick action types and useQuickActions composable"
```

---

### Task 2: Quick Action Configure Modal

**Files:**
- Create: `frontend/src/features/configure-quick-action/ui/QuickActionModal.vue`
- Create: `frontend/src/features/configure-quick-action/index.ts`

**Step 1: Create the modal component**

Create `frontend/src/features/configure-quick-action/ui/QuickActionModal.vue`:

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UModal, UButton, UIcon } from '@/shared/ui';
import { EXPENSE_CATEGORIES, getCategoryById } from '@/entities/category';
import type { Category } from '@/entities/category';
import type { AccountWithBalances } from '@/entities/account';
import type { QuickAction } from '../model/types';

const props = defineProps<{
  modelValue: boolean;
  accounts: AccountWithBalances[];
  editAction?: QuickAction | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [action: { label: string; categoryId: string; accountId: string }];
  delete: [];
}>();

const step = ref<'category' | 'account'>('category');
const selectedCategoryId = ref('');
const selectedAccountId = ref('');

const selectedCategory = computed(() =>
  selectedCategoryId.value ? getCategoryById(selectedCategoryId.value) : null,
);

const isEditing = computed(() => !!props.editAction);

// Reset state when modal opens
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (props.editAction) {
        selectedCategoryId.value = props.editAction.categoryId;
        selectedAccountId.value = props.editAction.accountId;
        step.value = 'category';
      } else {
        selectedCategoryId.value = '';
        selectedAccountId.value = '';
        step.value = 'category';
      }
    }
  },
);

function selectCategory(cat: Category) {
  selectedCategoryId.value = cat.id;
  step.value = 'account';
}

function selectAccount(accountId: string) {
  selectedAccountId.value = accountId;
  handleSave();
}

function handleSave() {
  if (!selectedCategoryId.value || !selectedAccountId.value) return;
  const cat = getCategoryById(selectedCategoryId.value);
  emit('save', {
    label: cat?.name || 'Расход',
    categoryId: selectedCategoryId.value,
    accountId: selectedAccountId.value,
  });
  emit('update:modelValue', false);
}

function handleDelete() {
  emit('delete');
  emit('update:modelValue', false);
}

function handleBack() {
  if (step.value === 'account') {
    step.value = 'category';
  } else {
    emit('update:modelValue', false);
  }
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    :title="step === 'category' ? 'Выберите категорию' : 'Выберите счёт'"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- Category selection -->
    <div v-if="step === 'category'" class="space-y-2">
      <button
        v-for="cat in EXPENSE_CATEGORIES"
        :key="cat.id"
        class="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-150"
        :class="[
          selectedCategoryId === cat.id
            ? 'bg-primary-light ring-1 ring-primary'
            : 'hover:bg-surface-light dark:hover:bg-surface-dark',
        ]"
        @click="selectCategory(cat)"
      >
        <div
          class="w-9 h-9 rounded-lg flex items-center justify-center"
          :style="{ backgroundColor: cat.color + '1A' }"
        >
          <UIcon :name="cat.icon" size="sm" :style="{ color: cat.color }" />
        </div>
        <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          {{ cat.name }}
        </span>
      </button>
    </div>

    <!-- Account selection -->
    <div v-else class="space-y-2">
      <!-- Back to categories -->
      <button
        class="flex items-center gap-1 text-sm text-text-secondary-light dark:text-text-secondary-dark mb-2"
        @click="handleBack"
      >
        <UIcon name="arrow_back" size="xs" />
        {{ selectedCategory?.name }}
      </button>

      <button
        v-for="account in accounts"
        :key="account.id"
        class="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-150"
        :class="[
          selectedAccountId === account.id
            ? 'bg-primary-light ring-1 ring-primary'
            : 'hover:bg-surface-light dark:hover:bg-surface-dark',
        ]"
        @click="selectAccount(account.id)"
      >
        <div
          class="w-9 h-9 rounded-lg bg-surface-light dark:bg-surface-dark flex items-center justify-center"
        >
          <UIcon name="account_balance_wallet" size="sm" class="text-text-secondary-light dark:text-text-secondary-dark" />
        </div>
        <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          {{ account.name }}
        </span>
      </button>
    </div>

    <!-- Delete action (only when editing) -->
    <template v-if="isEditing" #actions>
      <UButton
        variant="danger"
        size="sm"
        full-width
        @click="handleDelete"
      >
        Удалить
      </UButton>
    </template>
  </UModal>
</template>
```

**Step 2: Create barrel export**

Create `frontend/src/features/configure-quick-action/index.ts`:

```typescript
export { default as QuickActionModal } from './ui/QuickActionModal.vue';
export { useQuickActions } from './model/useQuickActions';
export type { QuickAction } from './model/types';
```

**Step 3: Verify**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/features/configure-quick-action/
git commit -m "feat: add QuickActionModal for configuring expense presets"
```

---

### Task 3: Replace hardcoded quick actions on Dashboard

**Files:**
- Modify: `frontend/src/pages/dashboard/DashboardPage.vue`

**Step 1: Replace the hardcoded quickActions with the composable**

In `DashboardPage.vue` `<script setup>`:

1. Remove the static `quickActions` array (lines 218-247).

2. Add imports:

```typescript
import {
  QuickActionModal,
  useQuickActions,
  type QuickAction,
} from '@/features/configure-quick-action';
```

3. Add composable usage (after existing composable calls):

```typescript
const { slots: quickActionSlots, addAction, updateAction, removeAction, getCategory } =
  useQuickActions();

// Quick action modal state
const showQuickActionModal = ref(false);
const editingAction = ref<QuickAction | null>(null);
const editingSlotIndex = ref<number | null>(null);

function handleQuickActionClick(action: QuickAction | null, index: number) {
  if (!action) {
    // Empty slot — open modal to create
    editingAction.value = null;
    editingSlotIndex.value = index;
    showQuickActionModal.value = true;
    return;
  }
  // Filled slot — navigate to add transaction with presets
  router.push(
    `/transactions/new?type=expense&categoryId=${action.categoryId}&accountId=${action.accountId}`,
  );
}

function handleQuickActionLongPress(action: QuickAction | null, index: number) {
  if (!action) return;
  editingAction.value = action;
  editingSlotIndex.value = index;
  showQuickActionModal.value = true;
}

function handleQuickActionSave(data: { label: string; categoryId: string; accountId: string }) {
  if (editingAction.value) {
    updateAction(editingAction.value.id, data);
  } else {
    addAction(data);
  }
  editingAction.value = null;
}

function handleQuickActionDelete() {
  if (editingAction.value) {
    removeAction(editingAction.value.id);
  }
  editingAction.value = null;
}
```

**Step 2: Replace the template Quick Actions section**

Replace the current Quick Actions template section with:

```html
<!-- Quick Actions -->
<section>
  <div class="grid grid-cols-4 gap-3">
    <button
      v-for="(action, index) in quickActionSlots"
      :key="action?.id ?? `empty-${index}`"
      class="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-surface-light dark:bg-surface-dark hover:opacity-80 active:scale-95 transition-all duration-150"
      @click="handleQuickActionClick(action, index)"
      @contextmenu.prevent="handleQuickActionLongPress(action, index)"
      @touchstart.passive="(() => {
        let timer: ReturnType<typeof setTimeout>;
        const el = $event.currentTarget as HTMLElement;
        const onEnd = () => { clearTimeout(timer); el.removeEventListener('touchend', onEnd); el.removeEventListener('touchmove', onEnd); };
        timer = setTimeout(() => { handleQuickActionLongPress(action, index); onEnd(); }, 500);
        el.addEventListener('touchend', onEnd, { once: true });
        el.addEventListener('touchmove', onEnd, { once: true });
      })()"
    >
      <template v-if="action">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center"
          :style="{ backgroundColor: (getCategory(action.categoryId)?.color ?? '#64748b') + '1A' }"
        >
          <UIcon
            :name="getCategory(action.categoryId)?.icon ?? 'receipt_long'"
            size="sm"
            :style="{ color: getCategory(action.categoryId)?.color ?? '#64748b' }"
          />
        </div>
        <span class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark truncate w-full text-center px-1">
          {{ action.label }}
        </span>
      </template>
      <template v-else>
        <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-border-light dark:bg-border-dark">
          <UIcon name="add" size="sm" class="text-text-tertiary-light dark:text-text-tertiary-dark" />
        </div>
        <span class="text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark">
          Добавить
        </span>
      </template>
    </button>
  </div>
</section>
```

**Step 3: Add the modal to the template**

At the bottom of the template, before `</div>` (the root closing tag), add:

```html
<!-- Quick Action Configure Modal -->
<QuickActionModal
  v-model="showQuickActionModal"
  :accounts="accounts"
  :edit-action="editingAction"
  @save="handleQuickActionSave"
  @delete="handleQuickActionDelete"
/>
```

**Step 4: Verify**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 5: Commit**

```bash
git add frontend/src/pages/dashboard/DashboardPage.vue
git commit -m "feat(dashboard): replace hardcoded quick actions with configurable presets"
```

---

### Task 4: AddTransactionPage — accept categoryId and accountId query params

**Files:**
- Modify: `frontend/src/pages/transactions/new/AddTransactionPage.vue`

**Step 1: Extend onMounted to read categoryId and accountId**

In `AddTransactionPage.vue`, modify the `onMounted` block (lines 55-63). Replace:

```typescript
onMounted(() => {
  resetSplit();

  const typeParam = route.query.type as string;
  if (typeParam === 'income' || typeParam === 'expense') {
    setType(typeParam);
  }
});
```

With:

```typescript
onMounted(() => {
  resetSplit();

  const typeParam = route.query.type as string;
  if (typeParam === 'income' || typeParam === 'expense' || typeParam === 'transfer') {
    setType(typeParam);
  }

  // Pre-fill from quick action preset
  const categoryId = route.query.categoryId as string;
  if (categoryId) {
    updateField('categoryId', categoryId);
  }
});
```

**Step 2: Override default account with query param**

Modify the watch on `[accounts, defaultAccountId]` (lines 66-84). Replace the body with:

```typescript
watch(
  [accounts, defaultAccountId],
  ([accs, defaultId]) => {
    if (accs.length > 0 && !formData.value.accountId) {
      // Check for query param override first
      const queryAccountId = route.query.accountId as string;
      const queryAccount = queryAccountId
        ? accs.find((a) => a.id === queryAccountId)
        : null;

      // Use query param > default account > first account
      const selectedId = queryAccount
        ? queryAccountId
        : defaultId && accs.some((a) => a.id === defaultId)
          ? defaultId
          : accs[0].id;

      const selectedAccount = accs.find((a) => a.id === selectedId);
      if (selectedAccount && selectedAccount.balances.length > 0) {
        updateField('accountId', selectedId);
        updateField('currency', selectedAccount.balances[0].currency);
      }
    }
  },
  { immediate: true },
);
```

**Step 3: Verify**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/pages/transactions/new/AddTransactionPage.vue
git commit -m "feat: accept categoryId and accountId query params in AddTransactionPage"
```

---

### Task 5: Add Quick Actions settings to Profile page

**Files:**
- Modify: `frontend/src/pages/profile/ProfilePage.vue`

**Step 1: Add menu item**

In `ProfilePage.vue`, add a new menu item after `categories` in the menu items array:

```typescript
{ id: 'quick-actions', icon: 'bolt', label: 'Быстрые действия' },
```

**Step 2: Add case to handleMenuClick**

Add to the switch statement:

```typescript
case 'quick-actions':
  router.push('/settings/quick-actions');
  break;
```

**Step 3: Verify**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/pages/profile/ProfilePage.vue
git commit -m "feat: add quick actions link to profile settings menu"
```

---

### Task 6: Quick Actions Settings Page + Route

**Files:**
- Create: `frontend/src/pages/settings/quick-actions/QuickActionsSettingsPage.vue`
- Modify: `frontend/src/app/router/index.ts`

**Step 1: Create settings page**

Create `frontend/src/pages/settings/quick-actions/QuickActionsSettingsPage.vue`:

```vue
<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import type { Ref } from 'vue';
import type { User } from '@/shared/api/composables/useAuth';
import { AppHeader } from '@/widgets/header';
import { UButton, UIcon } from '@/shared/ui';
import {
  QuickActionModal,
  useQuickActions,
  type QuickAction,
} from '@/features/configure-quick-action';
import { useAccounts } from '@/entities/account';
import { navigateBack } from '@/app/router';

const user = inject<Ref<User | null>>('user');
const userId = computed(() => user?.value?.id ?? '');
const { accounts } = useAccounts(userId);
const { slots, addAction, updateAction, removeAction, getCategory } = useQuickActions();

const showModal = ref(false);
const editingAction = ref<QuickAction | null>(null);

function handleSlotClick(action: QuickAction | null) {
  editingAction.value = action;
  showModal.value = true;
}

function handleSave(data: { label: string; categoryId: string; accountId: string }) {
  if (editingAction.value) {
    updateAction(editingAction.value.id, data);
  } else {
    addAction(data);
  }
  editingAction.value = null;
}

function handleDelete() {
  if (editingAction.value) {
    removeAction(editingAction.value.id);
  }
  editingAction.value = null;
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark">
    <AppHeader title="Быстрые действия" show-back @back="navigateBack" />

    <main class="px-5 pt-6 pb-28 space-y-4">
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        Настройте до 4 быстрых кнопок на главном экране. Каждая кнопка открывает добавление расхода с выбранной категорией и счётом.
      </p>

      <div class="space-y-3">
        <button
          v-for="(action, index) in slots"
          :key="action?.id ?? `empty-${index}`"
          class="w-full flex items-center gap-3 p-4 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark hover:opacity-80 active:scale-[0.98] transition-all duration-150"
          @click="handleSlotClick(action)"
        >
          <template v-if="action">
            <div
              class="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center"
              :style="{ backgroundColor: (getCategory(action.categoryId)?.color ?? '#64748b') + '1A' }"
            >
              <UIcon
                :name="getCategory(action.categoryId)?.icon ?? 'receipt_long'"
                size="sm"
                :style="{ color: getCategory(action.categoryId)?.color ?? '#64748b' }"
              />
            </div>
            <div class="flex-1 text-left">
              <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                {{ action.label }}
              </p>
              <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                {{ accounts?.find((a) => a.id === action.accountId)?.name || 'Счёт не найден' }}
              </p>
            </div>
            <UIcon name="chevron_right" size="sm" class="text-text-tertiary-light dark:text-text-tertiary-dark" />
          </template>
          <template v-else>
            <div class="w-10 h-10 shrink-0 rounded-lg bg-border-light dark:bg-border-dark flex items-center justify-center">
              <UIcon name="add" size="sm" class="text-text-tertiary-light dark:text-text-tertiary-dark" />
            </div>
            <span class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark">
              Слот {{ index + 1 }} — нажмите чтобы настроить
            </span>
          </template>
        </button>
      </div>
    </main>

    <QuickActionModal
      v-model="showModal"
      :accounts="accounts"
      :edit-action="editingAction"
      @save="handleSave"
      @delete="handleDelete"
    />
  </div>
</template>
```

**Step 2: Add route**

In `frontend/src/app/router/index.ts`, add after the `settings-categories` route (line 222):

```typescript
{
  path: '/settings/quick-actions',
  name: 'settings-quick-actions',
  component: () => import('@/pages/settings/quick-actions/QuickActionsSettingsPage.vue'),
  meta: { requiresAuth: true, requiresOnboarding: true },
},
```

**Step 3: Verify**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 4: Commit**

```bash
git add frontend/src/pages/settings/quick-actions/ frontend/src/app/router/index.ts
git commit -m "feat: add Quick Actions settings page with route"
```

---

### Task 7: Changelog + final verification

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

**Step 1: Add changelog entry**

Add to the `1.3.0` entry's items array:

```typescript
{
  type: 'feature',
  text: 'Быстрые действия теперь настраиваются — выберите категорию и счёт для каждой кнопки',
},
```

**Step 2: Final build**

Run: `cd /Users/hamkorlab/WebstormProjects/finance-app/frontend && bun run build`

**Step 3: Commit**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "docs: add custom quick actions to changelog"
```
