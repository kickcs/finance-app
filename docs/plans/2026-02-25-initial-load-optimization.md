# Initial Page Load Optimization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce the initial JS bundle (`index.js` ~156 KB gzip) by ~30-50% through targeted import path fixes and lazy-loading of rarely-shown modals.

**Architecture:** Replace barrel imports in critical-path files (`App.vue`, `useLayoutData.ts`) with direct file imports so Vite can tree-shake unused entity UI components. Wrap rarely-shown modals (`ChangelogModal`, `PremiumUpgradeModal`) with `defineAsyncComponent` + `v-if` to defer them from the initial chunk.

**Tech Stack:** Vue 3 (`defineAsyncComponent`), Vite (tree-shaking), existing codebase patterns.

---

### Task 1: Fix barrel imports in App.vue

**Files:**
- Modify: `frontend/src/app/App.vue:1-16` (script imports section)

**Step 1: Replace barrel imports with direct paths**

Change the imports at the top of `App.vue`:

```diff
-import { initializeAuth, useAuth, useProfile } from '@/shared/api';
+import { initializeAuth, useAuth } from '@/shared/api/composables/useAuth';
+import { useProfile } from '@/shared/api/composables/useProfile';
```

```diff
-import { useCategories } from '@/entities/category';
+import { useCategories } from '@/entities/category/api/useCategories';
```

```diff
-import { useSubscription } from '@/entities/subscription';
+import { useSubscription } from '@/entities/subscription/api/useSubscription';
```

These three changes prevent the barrel files from pulling in `CategoryCard`, `CategoryChips`, `TransactionItem`, `VirtualGroupedTransactionList`, `@tanstack/vue-virtual`, `AccountCard`, `DebtCard`, `GoalCard`, `ReminderCard`, and all other entity UI components into the initial chunk.

**Step 2: Verify the app compiles**

Run: `cd frontend && bun run build 2>&1 | tail -5`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add frontend/src/app/App.vue
git commit -m "perf: replace barrel imports with direct paths in App.vue"
```

---

### Task 2: Fix barrel imports in useLayoutData.ts

**Files:**
- Modify: `frontend/src/app/layouts/model/useLayoutData.ts:3`

**Step 1: Replace barrel import**

```diff
-import { useProfile, useExchangeRates } from '@/shared/api';
+import { useProfile } from '@/shared/api/composables/useProfile';
+import { useExchangeRates } from '@/shared/api/composables/useExchangeRates';
```

**Step 2: Verify build**

Run: `cd frontend && bun run build 2>&1 | tail -5`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/app/layouts/model/useLayoutData.ts
git commit -m "perf: replace barrel imports with direct paths in useLayoutData"
```

---

### Task 3: Lazy-load ChangelogModal in App.vue

**Files:**
- Modify: `frontend/src/app/App.vue`

**Step 1: Make ChangelogModal async and add v-if**

In the `<script setup>` section, change the import:

```diff
-import { useChangelog, ChangelogModal } from '@/features/changelog';
+import { useChangelog } from '@/features/changelog/model/useChangelog';
+
+const ChangelogModal = defineAsyncComponent(() =>
+  import('@/features/changelog/ui/ChangelogModal.vue')
+);
```

Add `defineAsyncComponent` to the existing import from `vue`:

```diff
-import { ref, computed, onMounted, provide } from 'vue';
+import { ref, computed, onMounted, provide, defineAsyncComponent } from 'vue';
```

In the `<template>`, add `v-if` so the component isn't created until needed:

```diff
-<ChangelogModal v-model="showChangelogModal" />
+<ChangelogModal v-if="showChangelogModal" v-model="showChangelogModal" />
```

**Step 2: Verify build**

Run: `cd frontend && bun run build 2>&1 | tail -5`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/app/App.vue
git commit -m "perf: lazy-load ChangelogModal with defineAsyncComponent"
```

---

### Task 4: Lazy-load PremiumUpgradeModal in App.vue

**Files:**
- Modify: `frontend/src/app/App.vue`

**Step 1: Make PremiumUpgradeModal async and add v-if**

Change the import:

```diff
-import { PremiumUpgradeModal } from '@/features/upgrade-to-premium';
+const PremiumUpgradeModal = defineAsyncComponent(() =>
+  import('@/features/upgrade-to-premium/ui/PremiumUpgradeModal.vue')
+);
```

In the `<template>`, add `v-if`:

```diff
-<PremiumUpgradeModal v-model="showUpgradeModal" :feature-name="upgradeFeatureName" />
+<PremiumUpgradeModal v-if="showUpgradeModal" v-model="showUpgradeModal" :feature-name="upgradeFeatureName" />
```

**Step 2: Verify build**

Run: `cd frontend && bun run build 2>&1 | tail -5`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/app/App.vue
git commit -m "perf: lazy-load PremiumUpgradeModal with defineAsyncComponent"
```

---

### Task 5: Verify bundle size reduction

**Step 1: Run full production build and compare**

Run: `cd frontend && bun run build 2>&1 | grep 'dist/index-'`

Compare the `index-*.js` size against the baseline of **156.40 KB** (44.98 KB gzip).

**Step 2: Check that lazy chunks were created**

Run: `cd frontend && bun run build 2>&1 | grep -i -E '(changelog|premium|upgrade)'`

Expected: New separate chunks for ChangelogModal and PremiumUpgradeModal should appear in the output.

**Step 3: Smoke test dev server**

Run: `cd frontend && bun run dev`

Manual checks:
- App loads and shows dashboard
- Open changelog (if unseen changes exist) — modal loads dynamically
- Theme toggle works
- Navigation between pages works

**Step 4: Commit any fixes if needed, then final commit message**

```bash
git commit --allow-empty -m "perf: verify initial bundle reduction complete"
```

---

## Notes

- The `shared/api/composables/index.ts` barrel still re-exports entity composables for backward compatibility — this is fine because other files that import from it (pages, widgets) are already lazy-loaded via route splitting
- The key insight is that only `App.vue` and `useLayoutData.ts` are on the critical path — fixing just these two files prevents the barrel chain from polluting the initial chunk
- `defineAsyncComponent` is preferred over manual dynamic imports for Vue components as it integrates with Suspense and provides loading/error states if needed later
