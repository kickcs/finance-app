# Debts Currency Filter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ad-hoc currency filter buttons on the debts active tab with a reusable `FilterChips` component and extend filtering to the closed tab.

**Architecture:** New generic `FilterChips` component in `shared/ui` using the established `useSlidingIndicator` pattern (same as `AccountSelector`). Accepts `{ id, label }[]` + `v-model: string | null`. `useDebtsPageState` gains `availableClosedCurrencies` + closed-tab filtering. `DebtsListPage` swaps the existing custom buttons for `FilterChips` and adds it to the closed tab.

**Tech Stack:** Vue 3 Composition API, `useSlidingIndicator` (`shared/lib/hooks/useSlidingIndicator.ts`), Tailwind CSS v4, TypeScript.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/shared/ui/FilterChips.vue` | Create | Generic horizontal chip row with sliding indicator |
| `frontend/src/shared/ui/index.ts` | Modify | Export `FilterChips` |
| `frontend/src/pages/debts/list/useDebtsPageState.ts` | Modify | Add `availableClosedCurrencies` + filter closed debts |
| `frontend/src/pages/debts/list/DebtsListPage.vue` | Modify | Use `FilterChips` on both tabs |

---

## Task 1: Create `FilterChips` component

**Files:**
- Create: `frontend/src/shared/ui/FilterChips.vue`

### Context

`AccountSelector.vue` (`frontend/src/entities/account/ui/AccountSelector.vue`) is the reference implementation — same `useSlidingIndicator` hook, same chip CSS classes. Read it before writing `FilterChips`.

Key detail from spec: the "all" chip uses internal sentinel id `'__all__'` so the sliding indicator can track it. The component maps `modelValue === null` → `'__all__'` internally and emits `null` when the "all" chip is clicked.

- [ ] **Step 1: Create `FilterChips.vue`**

```vue
<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue';
import { useSlidingIndicator } from '@/shared/lib/hooks/useSlidingIndicator';

const ALL_ID = '__all__';

const props = withDefaults(
  defineProps<{
    items: { id: string; label: string }[];
    modelValue: string | null;
    allLabel?: string;
  }>(),
  { allLabel: 'Все валюты' },
);

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const containerRef = ref<HTMLElement | null>(null);

// Map null → '__all__' for the indicator
const activeId = computed(() => props.modelValue ?? ALL_ID);

const { setChipRef, indicatorStyle, updateIndicator } = useSlidingIndicator(
  containerRef,
  activeId,
  (containerRect, activeRect, scrollLeft, _scrollTop) => ({
    left: `${activeRect.left - containerRect.left + scrollLeft}px`,
    top: `${activeRect.top - containerRect.top}px`,
    width: `${activeRect.width}px`,
    height: `${activeRect.height}px`,
    backgroundColor: 'var(--color-primary-light, rgb(var(--primary) / 0.1))',
    borderColor: 'rgb(var(--primary) / 0.3)',
  }),
);

watch(
  () => props.items,
  () => nextTick(updateIndicator),
  { deep: true },
);

function selectAll() {
  emit('update:modelValue', null);
}

function selectItem(id: string) {
  emit('update:modelValue', id);
}
</script>

<template>
  <div
    ref="containerRef"
    class="relative flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar"
  >
    <!-- Sliding indicator -->
    <span
      class="absolute rounded-lg pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0 border"
      :style="indicatorStyle"
    />

    <!-- All chip -->
    <button
      :ref="(el) => setChipRef(ALL_ID, el as HTMLElement)"
      type="button"
      :class="[
        'relative z-10 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors duration-300 border',
        modelValue === null
          ? 'text-primary border-transparent'
          : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark',
      ]"
      @click="selectAll"
    >
      {{ allLabel }}
    </button>

    <!-- Item chips -->
    <button
      v-for="item in items"
      :key="item.id"
      :ref="(el) => setChipRef(item.id, el as HTMLElement)"
      type="button"
      :class="[
        'relative z-10 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors duration-300 border',
        modelValue === item.id
          ? 'text-primary border-transparent'
          : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark',
      ]"
      @click="selectItem(item.id)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
```

- [ ] **Step 2: Export from `shared/ui/index.ts`**

Add at the end of `frontend/src/shared/ui/index.ts`:

```ts
export { default as FilterChips } from './FilterChips.vue';
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/ui/FilterChips.vue frontend/src/shared/ui/index.ts
git commit -m "feat(ui): add FilterChips component with sliding indicator"
```

---

## Task 2: Add closed-tab currency filtering to `useDebtsPageState`

**Files:**
- Modify: `frontend/src/pages/debts/list/useDebtsPageState.ts`

### Context

Current `closedDebts` (line 73):
```ts
const closedDebts = computed(() => debts.value.filter((d) => d.is_closed));
```

Both tabs share `currencyFilter` ref. When tab switches, `watch(statusFilter, ...)` resets it to `null`.

- [ ] **Step 1: Split `closedDebts` into base + filtered, add `availableClosedCurrencies`**

Replace the current `closedDebts` computed at line 73 with:

```ts
const baseClosedDebts = computed(() => debts.value.filter((d) => d.is_closed));

const availableClosedCurrencies = computed(() =>
  Array.from(new Set(baseClosedDebts.value.map((d) => d.currency))).sort(),
);

const closedDebts = computed(() => {
  if (!currencyFilter.value) return baseClosedDebts.value;
  return baseClosedDebts.value.filter((d) => d.currency === currencyFilter.value);
});
```

- [ ] **Step 2: Add `availableClosedCurrencies` to the return object**

In the `return { ... }` block (around line 253), add `availableClosedCurrencies` next to `availableCurrencies`:

```ts
availableCurrencies,
availableClosedCurrencies,
```

- [ ] **Step 3: Destructure `availableClosedCurrencies` in `DebtsListPage.vue`**

In the `useDebtsPageState()` destructure at the top of `DebtsListPage.vue` (line 22–65), add:

```ts
availableClosedCurrencies,
```

next to `availableCurrencies`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/debts/list/useDebtsPageState.ts frontend/src/pages/debts/list/DebtsListPage.vue
git commit -m "feat(debts): add currency filter support for closed debts"
```

---

## Task 3: Wire `FilterChips` into `DebtsListPage`

**Files:**
- Modify: `frontend/src/pages/debts/list/DebtsListPage.vue`

### Context

**Active tab — current code to replace** (lines 137–156):
```html
<!-- Currency Filter Chips -->
<div v-if="availableCurrencies.length > 1" class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
  <button
    type="button"
    class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border"
    :class="!currencyFilter ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border-border-light dark:border-border-dark'"
    @click="currencyFilter = null"
  >
    Все валюты
  </button>
  <button
    v-for="cur in availableCurrencies"
    :key="cur"
    type="button"
    class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border"
    :class="currencyFilter === cur ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border-border-light dark:border-border-dark'"
    @click="currencyFilter = cur"
  >
    {{ cur }}
  </button>
</div>
```

**Closed tab — current code** (lines 257–278): no filter chips exist yet. Add them right after the `<template v-else-if="statusFilter === 'closed'">` opening, before `<div v-if="closedDebts.length > 0"`.

- [ ] **Step 1: Add `FilterChips` to the import list**

In the imports at the top of `DebtsListPage.vue`, add `FilterChips` to the `@/shared/ui` import:

```ts
import {
  UButton,
  UIcon,
  UCard,
  Skeleton,
  EmptyState,
  SectionHeader,
  UTabs,
  MasterDetailLayout,
  FilterChips,
} from '@/shared/ui';
```

- [ ] **Step 2: Replace the active-tab currency filter block**

Replace the entire `<!-- Currency Filter Chips -->` div (lines 137–156) with:

```html
<!-- Currency Filter Chips -->
<FilterChips
  v-if="availableCurrencies.length > 1"
  :items="availableCurrencies.map((c) => ({ id: c, label: c }))"
  v-model="currencyFilter"
/>
```

- [ ] **Step 3: Add currency filter chips to the closed tab**

In the `<!-- Closed Debts Tab -->` section (after `<template v-else-if="statusFilter === 'closed'">`), add before `<div v-if="closedDebts.length > 0"`:

```html
<!-- Currency Filter Chips -->
<FilterChips
  v-if="availableClosedCurrencies.length > 1"
  :items="availableClosedCurrencies.map((c) => ({ id: c, label: c }))"
  v-model="currencyFilter"
/>
```

- [ ] **Step 4: Build to verify no TypeScript errors**

```bash
cd frontend && bun run build
```

Expected: build completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/debts/list/DebtsListPage.vue
git commit -m "feat(debts): replace currency filter buttons with FilterChips"
```
