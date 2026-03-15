# UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve feature discoverability, feedback, and mobile UX through contextual hints, discovery dots, enhanced toast with undo, expanded haptics, full-swipe actions, and smart form defaults.

**Architecture:** Six independent features layered on top of existing FSD modules. Feature Hints and Discovery Dots share localStorage state. Toast extension adds a new variant to the existing toast system. Swipe changes modify existing `useSwipe` hook. Smart Defaults reads from Vue Query cache.

**Tech Stack:** Vue 3, TypeScript, Reka UI Popover, TanStack Vue Query, VueUse `useLocalStorage`, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-15-ux-improvements-design.md`

**Note:** This project has no frontend unit tests. Verification is done via `bun run build` (type-check + production build) in `frontend/`.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `frontend/src/features/feature-hints/model/types.ts` | HintId, HintConfig, CounterKey types |
| `frontend/src/features/feature-hints/model/constants.ts` | Hint configs (trigger thresholds, texts, routes) |
| `frontend/src/features/feature-hints/model/useFeatureHints.ts` | Composable: counters, dismissed state, session flag, check/dismiss logic |
| `frontend/src/features/feature-hints/ui/FeatureHintPopover.vue` | Reka UI Popover styled as indigo tooltip-bubble |
| `frontend/src/features/feature-hints/index.ts` | Public exports |
| `frontend/src/shared/ui/discovery-dot/DiscoveryDot.vue` | Pulsing indigo dot with aria-hidden |
| `frontend/src/shared/ui/discovery-dot/index.ts` | Export |
| `frontend/src/shared/ui/primitives/toast/TransactionSuccessToast.vue` | Dark toast with animated checkmark, amount, undo button |
| `frontend/src/features/add-transaction/model/useSmartDefaults.ts` | Frequency analysis on cached transactions |

### Modified files
| File | Change |
|------|--------|
| `frontend/src/shared/ui/index.ts` | Export `DiscoveryDot` |
| `frontend/src/shared/lib/composables/useToast.ts` | Add `transaction-success` variant, `TransactionToastData` fields, update `triggerHaptics` |
| `frontend/src/shared/ui/primitives/toast/Toaster.vue` | Render `TransactionSuccessToast` as standalone block (not inside existing `<Toast>`) |
| `frontend/src/features/add-transaction/model/useSubmitTransaction.ts` | Show transaction-success toast from `onSuccess`, resolve category/account names from cache, build `onUndo` closure |
| `frontend/src/shared/lib/hooks/useSwipe.ts` | Add `fullSwipeThreshold`, `onFullSwipeLeft/Right` callbacks, change haptic `light` → `selection` |
| `frontend/src/shared/ui/swipeable/SwipeableItem.vue` | Wire full-swipe events, update default action colors |
| `frontend/src/widgets/bottom-nav/ui/BottomNav.vue` | Add `DiscoveryDot` on add button |
| `frontend/src/pages/dashboard/DashboardPage.vue` | Add `DiscoveryDot` on settings + scan buttons, increment `dashboard_visits`, show dashboard-settings + scan-receipt hints |
| `frontend/src/features/add-transaction/ui/TransactionForm.vue` | Integrate `FeatureHintPopover` for split hint, integrate smart defaults |
| `frontend/src/entities/transaction/api/useTransactions.ts` | Add `success` haptic on create, `warning` haptic on delete |

---

## Chunk 1: Feature Hints System

### Task 1: Feature Hints types + constants

**Files:**
- Create: `frontend/src/features/feature-hints/model/types.ts`
- Create: `frontend/src/features/feature-hints/model/constants.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// frontend/src/features/feature-hints/model/types.ts
export type HintId = 'split-expense' | 'scan-receipt' | 'dashboard-settings';

export type CounterKey = 'expenses_count' | 'transactions_count' | 'dashboard_visits';

export interface HintConfig {
  id: HintId;
  title: string;
  description: string;
  actionLabel: string;
  actionRoute?: string;
  triggerCounter: CounterKey;
  triggerThreshold: number;
}
```

- [ ] **Step 2: Create constants.ts**

```typescript
// frontend/src/features/feature-hints/model/constants.ts
import type { HintConfig } from './types';

export const HINT_CONFIGS: Record<string, HintConfig> = {
  'split-expense': {
    id: 'split-expense',
    title: 'Совет: Разделите расход',
    description: 'Нажмите «Разделить», чтобы поделить сумму с друзьями',
    actionLabel: 'Попробовать →',
    triggerCounter: 'expenses_count',
    triggerThreshold: 3,
  },
  'scan-receipt': {
    id: 'scan-receipt',
    title: 'Совет: Сканируйте чеки',
    description: 'Сфотографируйте чек — мы заполним транзакцию за вас',
    actionLabel: 'Попробовать →',
    actionRoute: '/scan-receipt',
    triggerCounter: 'transactions_count',
    triggerThreshold: 5,
  },
  'dashboard-settings': {
    id: 'dashboard-settings',
    title: 'Совет: Настройте дашборд',
    description: 'Вы можете менять порядок и видимость виджетов',
    actionLabel: 'Попробовать →',
    actionRoute: '/dashboard-settings',
    triggerCounter: 'dashboard_visits',
    triggerThreshold: 7,
  },
};

export const STORAGE_KEYS = {
  HINTS_DISMISSED: 'finance_app_hints_dismissed',
  HINTS_COUNTERS: 'finance_app_hints_counters',
  DISCOVERY_DOTS: 'finance_app_discovery_dots',
} as const;
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/feature-hints/model/types.ts frontend/src/features/feature-hints/model/constants.ts
git commit -m "feat(feature-hints): add types and constants"
```

---

### Task 2: useFeatureHints composable

**Files:**
- Create: `frontend/src/features/feature-hints/model/useFeatureHints.ts`

- [ ] **Step 1: Create useFeatureHints.ts**

```typescript
// frontend/src/features/feature-hints/model/useFeatureHints.ts
import { ref, computed } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { HINT_CONFIGS, STORAGE_KEYS } from './constants';
import type { HintId, CounterKey } from './types';

// Module-level state — resets on page reload automatically
const hintShownThisSession = ref(false);

export function useFeatureHints() {
  const dismissed = useLocalStorage<Record<string, boolean>>(
    STORAGE_KEYS.HINTS_DISMISSED,
    {},
  );
  const counters = useLocalStorage<Record<string, number>>(
    STORAGE_KEYS.HINTS_COUNTERS,
    {},
  );
  const dotsDismissed = useLocalStorage<Record<string, boolean>>(
    STORAGE_KEYS.DISCOVERY_DOTS,
    {},
  );

  function incrementCounter(key: CounterKey) {
    counters.value = {
      ...counters.value,
      [key]: (counters.value[key] ?? 0) + 1,
    };
  }

  function shouldShowHint(hintId: HintId): boolean {
    if (hintShownThisSession.value) return false;
    if (dismissed.value[hintId]) return false;

    const config = HINT_CONFIGS[hintId];
    if (!config) return false;

    const count = counters.value[config.triggerCounter] ?? 0;
    return count >= config.triggerThreshold;
  }

  function dismissHint(hintId: HintId) {
    dismissed.value = { ...dismissed.value, [hintId]: true };
    hintShownThisSession.value = true;
  }

  function markHintShown() {
    hintShownThisSession.value = true;
  }

  function isDotDismissed(dotId: string): boolean {
    return !!dotsDismissed.value[dotId];
  }

  function dismissDot(dotId: string) {
    dotsDismissed.value = { ...dotsDismissed.value, [dotId]: true };
  }

  return {
    incrementCounter,
    shouldShowHint,
    dismissHint,
    markHintShown,
    isDotDismissed,
    dismissDot,
    // Expose for FeatureHintPopover to read config
    getHintConfig: (id: HintId) => HINT_CONFIGS[id] ?? null,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/feature-hints/model/useFeatureHints.ts
git commit -m "feat(feature-hints): add useFeatureHints composable"
```

---

### Task 3: FeatureHintPopover component

**Files:**
- Create: `frontend/src/features/feature-hints/ui/FeatureHintPopover.vue`
- Create: `frontend/src/features/feature-hints/index.ts`

Use `@frontend-design` skill for component styling.

- [ ] **Step 1: Create FeatureHintPopover.vue**

Uses Reka UI `Popover` with indigo tooltip-bubble styling. The `open` state is controlled externally.

```vue
<!-- frontend/src/features/feature-hints/ui/FeatureHintPopover.vue -->
<script setup lang="ts">
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { useHaptics } from '@/shared/lib/haptics';
import type { HintConfig } from '../model/types';

const props = defineProps<{
  config: HintConfig;
  open: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
}>();

const emit = defineEmits<{
  dismiss: [];
  action: [];
}>();

const { trigger } = useHaptics();

function handleDismiss() {
  trigger('light');
  emit('dismiss');
}

function handleAction() {
  trigger('light');
  emit('action');
}
</script>

<template>
  <Popover :open="open">
    <PopoverTrigger as-child>
      <slot />
    </PopoverTrigger>
    <PopoverContent
      :side="side ?? 'bottom'"
      :side-offset="8"
      :collision-padding="16"
      class="w-72 rounded-xl border-0 bg-primary p-3 text-white shadow-lg"
      @pointer-down-outside="handleDismiss"
      @escape-key-down="handleDismiss"
    >
      <!-- Arrow -->
      <div
        class="absolute -top-1.5 left-6 h-3 w-3 rotate-45 bg-primary"
        :class="{ 'top-auto -bottom-1.5': side === 'top' }"
      />

      <div class="relative">
        <p class="text-sm font-semibold">{{ config.title }}</p>
        <p class="mt-1 text-xs opacity-90">{{ config.description }}</p>

        <div class="mt-2.5 flex items-center justify-end gap-3">
          <button
            class="text-xs opacity-70 hover:opacity-100 transition-opacity"
            @click="handleDismiss"
          >
            Не показывать
          </button>
          <button
            class="text-xs font-semibold hover:opacity-90 transition-opacity"
            @click="handleAction"
          >
            {{ config.actionLabel }}
          </button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
```

- [ ] **Step 2: Create index.ts**

```typescript
// frontend/src/features/feature-hints/index.ts
export { useFeatureHints } from './model/useFeatureHints';
export { default as FeatureHintPopover } from './ui/FeatureHintPopover.vue';
export type { HintId, CounterKey, HintConfig } from './model/types';
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/feature-hints/
git commit -m "feat(feature-hints): add FeatureHintPopover component and public exports"
```

---

### Task 4: Integrate hint counters and show all three hints

**Files:**
- Modify: `frontend/src/features/add-transaction/model/useSubmitTransaction.ts` — increment counters on create
- Modify: `frontend/src/pages/dashboard/DashboardPage.vue` — increment dashboard_visits, show dashboard-settings + scan-receipt hints
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue` — show split-expense hint

- [ ] **Step 1: Add counter increment in useSubmitTransaction.ts**

In `useSubmitTransaction()`, after the existing `onSuccess` callback, add counter increments:

```typescript
// In the import section, add:
import { useFeatureHints } from '@/features/feature-hints';

// Inside useSubmitTransaction(), before the mutation:
const { incrementCounter } = useFeatureHints();

// Modify the existing onSuccess to also increment counters:
onSuccess: (_data, { formData }) => {
  toast({
    title: `${TRANSACTION_TYPE_LABELS[formData.type]} добавлен`,
    variant: 'success',
    duration: 2500,
  });

  // Increment hint counters
  incrementCounter('transactions_count');
  if (formData.type === 'expense') {
    incrementCounter('expenses_count');
  }
},
```

- [ ] **Step 2: Add dashboard_visits counter + dashboard-settings and scan-receipt hints in DashboardPage.vue**

In `DashboardPage.vue`, add on mount:

```typescript
import { FeatureHintPopover, useFeatureHints } from '@/features/feature-hints';
import { useRouter } from 'vue-router';

// Inside setup:
const router = useRouter();
const { incrementCounter, shouldShowHint, dismissHint, markHintShown, getHintConfig, isDotDismissed, dismissDot } = useFeatureHints();

// Hint state for dashboard-settings
const showSettingsHint = ref(false);
const settingsHintConfig = getHintConfig('dashboard-settings');

// Hint state for scan-receipt
const showScanHint = ref(false);
const scanHintConfig = getHintConfig('scan-receipt');

onMounted(() => {
  incrementCounter('dashboard_visits');

  // Check hints with priority: only one per session
  if (shouldShowHint('dashboard-settings')) {
    setTimeout(() => {
      showSettingsHint.value = true;
      markHintShown();
    }, 1000);
  } else if (shouldShowHint('scan-receipt')) {
    setTimeout(() => {
      showScanHint.value = true;
      markHintShown();
    }, 1000);
  }
});

function handleSettingsHintDismiss() {
  showSettingsHint.value = false;
  dismissHint('dashboard-settings');
}
function handleSettingsHintAction() {
  showSettingsHint.value = false;
  dismissHint('dashboard-settings');
  router.push('/dashboard-settings');
}

function handleScanHintDismiss() {
  showScanHint.value = false;
  dismissHint('scan-receipt');
}
function handleScanHintAction() {
  showScanHint.value = false;
  dismissHint('scan-receipt');
  router.push('/scan-receipt');
}
```

In template, wrap settings button and scan button with `FeatureHintPopover`:

```vue
<!-- Settings button -->
<FeatureHintPopover
  v-if="settingsHintConfig"
  :config="settingsHintConfig"
  :open="showSettingsHint"
  side="bottom"
  @dismiss="handleSettingsHintDismiss"
  @action="handleSettingsHintAction"
>
  <!-- existing settings button -->
</FeatureHintPopover>

<!-- Scan receipt button -->
<FeatureHintPopover
  v-if="scanHintConfig"
  :config="scanHintConfig"
  :open="showScanHint"
  side="bottom"
  @dismiss="handleScanHintDismiss"
  @action="handleScanHintAction"
>
  <!-- existing scan button -->
</FeatureHintPopover>
```

- [ ] **Step 3: Add split-expense hint in TransactionForm.vue**

Find the split expense section/button in `TransactionForm.vue`. Wrap it with `FeatureHintPopover`:

```typescript
import { FeatureHintPopover, useFeatureHints } from '@/features/feature-hints';

// Inside setup:
const { shouldShowHint, dismissHint, markHintShown, getHintConfig } = useFeatureHints();
const showSplitHint = ref(false);
const splitHintConfig = getHintConfig('split-expense');

onMounted(() => {
  if (shouldShowHint('split-expense')) {
    // Delay to let the form render first
    setTimeout(() => {
      showSplitHint.value = true;
      markHintShown();
    }, 500);
  }
});

function handleSplitHintDismiss() {
  showSplitHint.value = false;
  dismissHint('split-expense');
}

function handleSplitHintAction() {
  showSplitHint.value = false;
  dismissHint('split-expense');
  // Enable split mode
  emit('setSplitEnabled', true);
}
```

In template, wrap the split button/area:

```vue
<FeatureHintPopover
  v-if="splitHintConfig"
  :config="splitHintConfig"
  :open="showSplitHint"
  side="top"
  @dismiss="handleSplitHintDismiss"
  @action="handleSplitHintAction"
>
  <!-- existing split button/toggle -->
</FeatureHintPopover>
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/add-transaction/model/useSubmitTransaction.ts \
  frontend/src/pages/dashboard/DashboardPage.vue \
  frontend/src/features/add-transaction/ui/TransactionForm.vue
git commit -m "feat(feature-hints): integrate counters and split-expense hint"
```

---

## Chunk 2: Discovery Dots + Enhanced Toast

### Task 5: DiscoveryDot component

**Files:**
- Create: `frontend/src/shared/ui/discovery-dot/DiscoveryDot.vue`
- Create: `frontend/src/shared/ui/discovery-dot/index.ts`
- Modify: `frontend/src/shared/ui/index.ts`

- [ ] **Step 1: Create DiscoveryDot.vue**

**FSD note:** `shared/ui` must not import from `features/`. Instead, `DiscoveryDot` receives visibility state as a prop. The parent (in `widgets/` or `pages/`) passes `v-if` or `:show` based on `useFeatureHints().isDotDismissed()`.

```vue
<!-- frontend/src/shared/ui/discovery-dot/DiscoveryDot.vue -->
<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    show?: boolean;
    size?: 'sm' | 'md';
  }>(),
  { show: true, size: 'sm' },
);

const dotSize = computed(() => (props.size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2'));
</script>

<template>
  <span
    v-if="props.show"
    aria-hidden="true"
    class="absolute -top-0.5 -right-0.5 pointer-events-none"
  >
    <span
      :class="[dotSize, 'block rounded-full bg-primary']"
    />
    <span
      :class="[dotSize, 'absolute inset-0 rounded-full bg-primary animate-ping']"
      style="animation-duration: 2s;"
    />
  </span>
</template>
```

- [ ] **Step 2: Create index.ts**

```typescript
// frontend/src/shared/ui/discovery-dot/index.ts
export { default as DiscoveryDot } from './DiscoveryDot.vue';
```

- [ ] **Step 3: Add export to shared/ui/index.ts**

Add to `frontend/src/shared/ui/index.ts`:

```typescript
export { DiscoveryDot } from './discovery-dot';
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/ui/discovery-dot/ frontend/src/shared/ui/index.ts
git commit -m "feat(ui): add DiscoveryDot component"
```

---

### Task 6: Integrate Discovery Dots in BottomNav + Dashboard

**Files:**
- Modify: `frontend/src/widgets/bottom-nav/ui/BottomNav.vue`
- Modify: `frontend/src/pages/dashboard/DashboardPage.vue`

- [ ] **Step 1: Add DiscoveryDot to BottomNav add button**

In `BottomNav.vue`, find the add button and wrap it in a `relative` container with a `DiscoveryDot`:

```typescript
import { DiscoveryDot } from '@/shared/ui';
import { useFeatureHints } from '@/features/feature-hints';

// In setup:
const { dismissDot, isDotDismissed } = useFeatureHints();
const showAddDot = computed(() => !isDotDismissed('add-button'));

// Modify the EXISTING handleAddClick (don't rename the emit):
function handleAddClick() {
  dismissDot('add-button');
  trigger('selection');
  emit('add-click');  // Keep existing kebab-case emit name
}
```

In the template, add to the add button's container:

```vue
<div class="relative">
  <button
    class="w-10 h-10 rounded-lg bg-primary ..."
    @click="handleAddClick"
  >
    <UIcon name="add" ... />
  </button>
  <DiscoveryDot :show="showAddDot" size="md" />
</div>
```

- [ ] **Step 2: Add DiscoveryDot to dashboard settings + scan buttons**

In `DashboardPage.vue`, find the settings/gear button and scan button. Add dots to both:

```typescript
import { DiscoveryDot } from '@/shared/ui';

// dismissDot and isDotDismissed already imported in Task 4
const showSettingsDot = computed(() => !isDotDismissed('dashboard-settings'));
const showScanDot = computed(() => !isDotDismissed('scan-receipt'));

// In the settings button click handler:
function handleSettingsClick() {
  dismissDot('dashboard-settings');
  // existing navigation logic
}

// In the scan receipt click handler:
function handleScanClick() {
  dismissDot('scan-receipt');
  // existing scan navigation logic
}
```

In template:

```vue
<!-- Settings button -->
<div class="relative">
  <!-- existing settings button with @click="handleSettingsClick" -->
  <DiscoveryDot :show="showSettingsDot" />
</div>

<!-- Scan receipt button (if visible) -->
<div class="relative">
  <!-- existing scan button with @click="handleScanClick" -->
  <DiscoveryDot :show="showScanDot" />
</div>
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/widgets/bottom-nav/ui/BottomNav.vue \
  frontend/src/pages/dashboard/DashboardPage.vue
git commit -m "feat(discovery-dots): integrate in BottomNav and Dashboard"
```

---

### Task 7: Extended toast system with transaction-success variant

**Files:**
- Modify: `frontend/src/shared/lib/composables/useToast.ts`
- Create: `frontend/src/shared/ui/primitives/toast/TransactionSuccessToast.vue`
- Modify: `frontend/src/shared/ui/primitives/toast/Toaster.vue`

- [ ] **Step 1: Extend useToast.ts with new variant and fields**

Add `transaction-success` variant and `TransactionToastData`:

```typescript
// Add to ToastVariant union:
export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'transaction-success';

// Add new interface:
export interface TransactionToastData {
  amount: string;
  categoryName: string;
  accountName: string;
  onUndo: () => Promise<void>;
}

// Extend Toast interface:
export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  duration?: number;
  transactionData?: TransactionToastData;
}

// Update triggerHaptics to handle transaction-success as success:
function triggerHaptics(variant?: ToastVariant) {
  if (variant === 'success' || variant === 'transaction-success') {
    trigger('success');
  } else if (variant === 'error') {
    trigger('error');
  } else if (variant === 'warning') {
    trigger('warning');
  } else {
    trigger('selection');
  }
}
```

- [ ] **Step 2: Create TransactionSuccessToast.vue**

```vue
<!-- frontend/src/shared/ui/primitives/toast/TransactionSuccessToast.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useHaptics } from '@/shared/lib/haptics';
import type { TransactionToastData } from '@/shared/lib/composables/useToast';

const props = defineProps<{
  data: TransactionToastData;
}>();

const emit = defineEmits<{
  undo: [];
  dismiss: [];
}>();

const { trigger } = useHaptics();
const isUndoing = ref(false);

async function handleUndo() {
  if (isUndoing.value) return;
  isUndoing.value = true;
  trigger('light');

  try {
    await props.data.onUndo();
    emit('undo');
  } catch {
    isUndoing.value = false;
  }
}
</script>

<template>
  <div class="flex items-center gap-3">
    <!-- Animated checkmark -->
    <div class="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="checkmark-icon">
        <path
          d="M4 8.5L7 11.5L12 5"
          stroke="white"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>

    <!-- Amount + category -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-semibold text-white truncate">
        {{ data.amount }}
      </p>
      <p class="text-xs text-slate-400 truncate">
        {{ data.categoryName }} · {{ data.accountName }}
      </p>
    </div>

    <!-- Undo button -->
    <button
      class="text-xs font-semibold text-indigo-400 px-2.5 py-1.5 rounded-lg bg-indigo-400/10 hover:bg-indigo-400/20 transition-colors whitespace-nowrap disabled:opacity-50"
      :disabled="isUndoing"
      @click="handleUndo"
    >
      {{ isUndoing ? '...' : 'Отменить' }}
    </button>
  </div>
</template>

<style scoped>
.checkmark-icon path {
  stroke-dasharray: 24;
  stroke-dashoffset: 24;
  animation: draw-check 0.4s ease-out 0.2s forwards;
}

@keyframes draw-check {
  to {
    stroke-dashoffset: 0;
  }
}
</style>
```

- [ ] **Step 3: Modify Toaster.vue to render TransactionSuccessToast**

In `Toaster.vue`, import and conditionally render.

**Important:** `transaction-success` toasts must NOT be rendered inside the existing `<Toast>` Reka UI component (which has its own icon, title, progress bar). Instead, render them as a standalone styled block **outside** the existing `<Toast>`, using a separate `v-if` branch in the `v-for` loop.

```typescript
import TransactionSuccessToast from './TransactionSuccessToast.vue';

// In setup, also get dismiss and toast:
const { toasts, dismiss, toast: showToast } = useToast();

function handleUndo(toastId: string, onUndo: () => Promise<void>) {
  dismiss(toastId);
  onUndo();
  showToast({ title: 'Отменено', variant: 'default', duration: 1500 });
}
```

In the template `v-for` loop, add a conditional branch BEFORE the existing `<Toast>`:

```vue
<template v-for="t in toasts" :key="t.id">
  <!-- Transaction-success: standalone dark toast (NOT inside <Toast>) -->
  <div
    v-if="t.variant === 'transaction-success' && t.transactionData"
    v-show="t.open"
    class="rounded-[14px] bg-slate-800 p-3.5 shadow-lg animate-in slide-in-from-bottom-full"
  >
    <TransactionSuccessToast
      :data="t.transactionData"
      @undo="handleUndo(t.id, t.transactionData!.onUndo)"
      @dismiss="dismiss(t.id)"
    />
    <!-- Auto-dismiss timer -->
    <div
      v-if="t.duration"
      class="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-600 origin-left"
      :style="{ animation: `shrink ${t.duration}ms linear forwards` }"
      @animationend="dismiss(t.id)"
    />
  </div>

  <!-- Existing toast for all other variants -->
  <Toast v-else ...>
    <!-- existing toast content unchanged -->
  </Toast>
</template>
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/lib/composables/useToast.ts \
  frontend/src/shared/ui/primitives/toast/TransactionSuccessToast.vue \
  frontend/src/shared/ui/primitives/toast/Toaster.vue
git commit -m "feat(toast): add transaction-success variant with undo"
```

---

### Task 8: Integrate transaction-success toast in useSubmitTransaction

**Files:**
- Modify: `frontend/src/features/add-transaction/model/useSubmitTransaction.ts`

- [ ] **Step 1: Replace success toast with transaction-success toast**

The `onUndo` callback must be a pre-bound closure assembled here, where `queryClient` and `rollbackTransaction` are in scope. The toast is shown from `onSuccess` so we have the real server ID.

**Important:** `TransactionFormData` has NO `categoryName` or `accountName` fields — only IDs. Resolve display names from the Vue Query cache (accounts and categories are already cached).

```typescript
// Add imports:
import { accountQueryKeys } from '@/entities/account';
import type { AccountWithBalances } from '@/shared/api/database.types';
// Category names: use the EXPENSE_CATEGORIES/INCOME_CATEGORIES constants or query cache

// Helper to resolve display names from cache:
function resolveDisplayNames(formData: TransactionFormData, userId: string) {
  // Resolve account name from cache
  const accounts = queryClient.getQueryData<AccountWithBalances[]>(
    accountQueryKeys.list(userId),
  );
  const account = accounts?.find(a => a.id === formData.accountId);
  const accountName = account?.name ?? '';

  // Category name: the form already has category data available via the categories
  // passed down. Since we're inside the mutation composable, resolve from type label.
  const categoryName = TRANSACTION_TYPE_LABELS[formData.type];

  return { accountName, categoryName };
}

// Modify the onSuccess callback:
onSuccess: (data, { userId, formData }) => {
  // Increment hint counters
  incrementCounter('transactions_count');
  if (formData.type === 'expense') {
    incrementCounter('expenses_count');
  }

  // Build pre-bound undo closure with real server ID
  const transactionId = data.id;
  const onUndo = async () => {
    await rollbackTransaction(transactionId, userId);
  };

  // Resolve display names from cache
  const { accountName, categoryName } = resolveDisplayNames(formData, userId);

  // Determine display amount
  const amount = formData.type === 'income'
    ? `+${formData.amount.toLocaleString('ru-RU')}`
    : `-${formData.amount.toLocaleString('ru-RU')}`;

  toast({
    variant: 'transaction-success',
    duration: 5000,
    transactionData: {
      amount,
      categoryName,
      accountName,
      onUndo,
    },
  });
},
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/model/useSubmitTransaction.ts
git commit -m "feat(toast): integrate transaction-success toast with undo in submit flow"
```

---

## Chunk 3: Haptics + Swipe + Smart Defaults

### Task 9: Expand haptic feedback patterns

**Files:**
- Modify: `frontend/src/shared/lib/hooks/useSwipe.ts` — change `light` → `selection` at threshold
- Modify: `frontend/src/entities/transaction/api/useTransactions.ts` — add `success` on create, `warning` on delete
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue` — add `error` on validation

**Note:** PullToRefresh already has `trigger('success')` in `usePullToRefresh.ts:109` — skip.

- [ ] **Step 1: Change swipe threshold haptic from `light` to `selection`**

In `frontend/src/shared/lib/hooks/useSwipe.ts`, line 90:

```typescript
// Change from:
trigger('light');
// To:
trigger('selection');
```

- [ ] **Step 2: Add haptics on transaction create and delete in useTransactions.ts**

In `frontend/src/entities/transaction/api/useTransactions.ts`:

```typescript
import { trigger } from '@/shared/lib/haptics';

// In createTransaction mutation onSuccess:
trigger('success');

// In deleteTransaction mutation onSuccess:
trigger('warning');
```

- [ ] **Step 3: Add haptic on form validation error**

In `TransactionForm.vue`, find the validation error handling and add:

```typescript
// When validation fails (e.g., amount is 0, no account selected):
trigger('error');
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/lib/hooks/useSwipe.ts \
  frontend/src/entities/transaction/api/useTransactions.ts \
  frontend/src/features/add-transaction/ui/TransactionForm.vue
git commit -m "feat(haptics): expand feedback patterns — swipe, create, delete, validation"
```

---

### Task 10: Full-swipe auto-fire in useSwipe + asymmetric swipe colors

**Files:**
- Modify: `frontend/src/shared/lib/hooks/useSwipe.ts`
- Modify: `frontend/src/shared/ui/swipeable/SwipeableItem.vue`

- [ ] **Step 1: Add full-swipe support to useSwipe.ts**

Extend `SwipeConfig`:

```typescript
export interface SwipeConfig {
  threshold?: number;
  maxSwipe?: number;
  leftEnabled?: boolean;
  rightEnabled?: boolean;
  /** Full-swipe threshold for auto-fire (default: disabled, set to e.g. 200) */
  fullSwipeThreshold?: number;
  onFullSwipeLeft?: () => void;
  onFullSwipeRight?: () => void;
}
```

In `useSwipe()`, destructure new config:

```typescript
const {
  threshold = 80,
  maxSwipe = 100,
  leftEnabled = true,
  rightEnabled = true,
  fullSwipeThreshold,
  onFullSwipeLeft,
  onFullSwipeRight,
} = config || {};
```

In `onTouchMove`, when `fullSwipeThreshold` is set, increase `maxSwipe` to allow longer swipe:

```typescript
const effectiveMaxSwipe = fullSwipeThreshold ? Math.max(maxSwipe, fullSwipeThreshold + 20) : maxSwipe;
// Use effectiveMaxSwipe instead of maxSwipe in the clamp logic
```

In `onTouchEnd`, add full-swipe detection before the existing threshold check:

```typescript
// Full-swipe auto-fire
if (fullSwipeThreshold && absTranslate >= fullSwipeThreshold) {
  if (translateX.value < 0 && leftEnabled && onFullSwipeLeft) {
    onFullSwipeLeft();
    animateToZero();
    return;
  }
  if (translateX.value > 0 && rightEnabled && onFullSwipeRight) {
    onFullSwipeRight();
    animateToZero();
    return;
  }
}
```

- [ ] **Step 2: Update SwipeableItem.vue default colors and wire full-swipe**

Update default left/right action colors:

```typescript
// Left action default: red for delete
leftAction: { icon: 'delete', color: '#ef4444', label: 'Удалить' }
// Right action default: indigo for edit
rightAction: { icon: 'edit', color: '#4F46E5', label: 'Изменить' }
```

Add `fullSwipe` prop and emit events:

```typescript
const props = withDefaults(defineProps<{
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  disabled?: boolean;
  fullSwipe?: boolean; // Enable full-swipe auto-fire
}>(), { fullSwipe: false });

const emit = defineEmits<{
  'action-left': [];
  'action-right': [];
}>();

// Pass full-swipe config to useSwipe:
const { translateX, isDragging, swipeState, resetSwipe, handlers } = useSwipe({
  leftEnabled: !!props.leftAction,
  rightEnabled: !!props.rightAction,
  fullSwipeThreshold: props.fullSwipe ? 200 : undefined,
  onFullSwipeLeft: () => emit('action-left'),
  onFullSwipeRight: () => emit('action-right'),
});
```

- [ ] **Step 3: Enable full-swipe in VirtualGroupedTransactionList.vue**

Add `full-swipe` prop to `SwipeableItem` in the transaction list:

```vue
<SwipeableItem
  ...
  full-swipe
>
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/lib/hooks/useSwipe.ts \
  frontend/src/shared/ui/swipeable/SwipeableItem.vue \
  frontend/src/entities/transaction/ui/VirtualGroupedTransactionList.vue
git commit -m "feat(swipe): add full-swipe auto-fire and update action colors"
```

---

### Task 11: Smart Defaults composable + integration

**Files:**
- Create: `frontend/src/features/add-transaction/model/useSmartDefaults.ts`
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue`

- [ ] **Step 1: Create useSmartDefaults.ts**

```typescript
// frontend/src/features/add-transaction/model/useSmartDefaults.ts
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { transactionQueryKeys } from '@/entities/transaction';
import type { Transaction } from '@/shared/api/database.types';

interface SmartDefaults {
  defaultCategoryId: string | null;
  defaultAccountId: string | null;
}

export function useSmartDefaults(
  userId: MaybeRefOrGetter<string | null>,
  type: MaybeRefOrGetter<'expense' | 'income' | 'transfer'>,
): { defaults: ReturnType<typeof computed<SmartDefaults>> } {
  const queryClient = useQueryClient();

  const defaults = computed<SmartDefaults>(() => {
    const uid = toValue(userId);
    const txType = toValue(type);

    if (!uid) return { defaultCategoryId: null, defaultAccountId: null };

    // Read from Vue Query cache — no API call
    const cached = queryClient.getQueryData<Transaction[]>(
      transactionQueryKeys.list(uid),
    );

    if (!cached || cached.length < 5) {
      return { defaultCategoryId: null, defaultAccountId: null };
    }

    // Take last 20 transactions of matching type
    const relevant = cached
      .filter((tx) => tx.type === txType)
      .slice(0, 20);

    if (relevant.length === 0) {
      return { defaultCategoryId: null, defaultAccountId: null };
    }

    // For transfers, only suggest account (no category)
    if (txType === 'transfer') {
      const accountFreq = new Map<string, number>();
      for (const tx of relevant) {
        const id = tx.account_id;
        accountFreq.set(id, (accountFreq.get(id) ?? 0) + 1);
      }
      const topAccount = [...accountFreq.entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return { defaultCategoryId: null, defaultAccountId: topAccount };
    }

    // Count (category, account) pairs
    const pairFreq = new Map<string, { categoryId: string; accountId: string; count: number }>();
    for (const tx of relevant) {
      const key = `${tx.category_id}:${tx.account_id}`;
      const existing = pairFreq.get(key);
      if (existing) {
        existing.count++;
      } else {
        pairFreq.set(key, {
          categoryId: tx.category_id,
          accountId: tx.account_id,
          count: 1,
        });
      }
    }

    // Find most frequent pair
    const topPair = [...pairFreq.values()]
      .sort((a, b) => b.count - a.count)[0];

    return {
      defaultCategoryId: topPair?.categoryId ?? null,
      defaultAccountId: topPair?.accountId ?? null,
    };
  });

  return { defaults };
}
```

- [ ] **Step 2: Integrate in TransactionForm.vue**

In `TransactionForm.vue` setup:

```typescript
import { useSmartDefaults } from '../model/useSmartDefaults';

// Get smart defaults (only when not pre-filled by quick action)
const { defaults } = useSmartDefaults(userId, () => props.formData.type);

// Apply defaults when form opens and no quick action pre-fill
onMounted(() => {
  if (props.formData.categoryId || props.formData.accountId) return; // Quick action has priority

  const { defaultCategoryId, defaultAccountId } = defaults.value;
  if (defaultCategoryId || defaultAccountId) {
    emit('update:formData', {
      ...props.formData,
      ...(defaultCategoryId && { categoryId: defaultCategoryId }),
      ...(defaultAccountId && { accountId: defaultAccountId }),
    });
  }
});

// Re-apply when type changes (expense ↔ income)
watch(() => props.formData.type, () => {
  if (props.formData.categoryId) return; // User already chose
  const { defaultCategoryId } = defaults.value;
  if (defaultCategoryId) {
    emit('update:formData', {
      ...props.formData,
      categoryId: defaultCategoryId,
    });
  }
});
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/add-transaction/model/useSmartDefaults.ts \
  frontend/src/features/add-transaction/ui/TransactionForm.vue
git commit -m "feat(smart-defaults): auto-fill category and account from history"
```

---

## Final Verification

### Task 12: Full build verification + final commit

- [ ] **Step 1: Run full build**

```bash
cd frontend && bun run build
```

Expected: Clean build, no type errors, no warnings.

- [ ] **Step 2: Manual smoke test checklist**

Run: `cd frontend && bun run dev`

1. Create 3+ expense transactions → split-expense hint appears on 4th
2. Visit dashboard 7+ times → dashboard-settings hint appears
3. Check pulsing dots on BottomNav add button and dashboard settings
4. Create a transaction → dark toast with checkmark and undo button
5. Click "Отменить" on toast → transaction deleted, "Отменено" shown
6. Swipe left on transaction → red "Удалить" zone
7. Swipe right on transaction → indigo "Изменить" zone
8. Full-swipe left → auto-deletes
9. Open add-transaction after 5+ transactions → category/account pre-filled
10. Haptic feedback on: create, delete, undo, validation error, pull-to-refresh, swipe threshold
