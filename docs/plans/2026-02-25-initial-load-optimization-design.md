# Initial Page Load Optimization — Design

**Date**: 2026-02-25
**Goal**: Reduce initial JS bundle size by ~30-50% through targeted import fixes
**Approach**: Точечные исправления импортов (Approach A)

## Problem

Main entry bundle (`index.js`) is 156 KB gzip. Root causes:

1. **Barrel re-export in `@/shared/api`** pulls all entity modules (accounts, transactions, debts, goals, reminders) + their UI components + `@tanstack/vue-virtual` into the initial chunk — even though App.vue only needs `initializeAuth`, `useAuth`, `useProfile`
2. **`ChangelogModal`** rendered unconditionally in App.vue (371 lines of changelog data + modal components always loaded)
3. **`PremiumUpgradeModal`** rendered unconditionally in App.vue
4. **`@/entities/category`** fully loaded for global `getCategoryById` provide — drags in `CategoryCard`, `CategoryChips`
5. **`@/entities/subscription`** loaded eagerly for premium feature init

## Changes

### 1. Direct imports in App.vue (instead of barrel)

Replace:
```ts
import { initializeAuth, useAuth, useProfile } from '@/shared/api';
```
With:
```ts
import { initializeAuth, useAuth } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
```

### 2. Lazy-load ChangelogModal

Replace:
```ts
import { useChangelog, ChangelogModal } from '@/features/changelog';
```
With:
```ts
import { useChangelog } from '@/features/changelog';
const ChangelogModal = defineAsyncComponent(() =>
  import('@/features/changelog').then(m => m.ChangelogModal)
);
```
Add `v-if="showChangelogModal"` to template.

### 3. Lazy-load PremiumUpgradeModal

Replace:
```ts
import { PremiumUpgradeModal } from '@/features/upgrade-to-premium';
```
With:
```ts
const PremiumUpgradeModal = defineAsyncComponent(() =>
  import('@/features/upgrade-to-premium').then(m => m.PremiumUpgradeModal)
);
```
Add `v-if="showUpgradeModal"` to template.

### 4. Direct import for useCategories

Replace:
```ts
import { useCategories } from '@/entities/category';
```
With direct path import to avoid pulling in CategoryCard/CategoryChips:
```ts
import { useCategories } from '@/entities/category/api/useCategories';
```

### 5. Direct import for useSubscription

Replace:
```ts
import { useSubscription } from '@/entities/subscription';
```
With:
```ts
import { useSubscription } from '@/entities/subscription/api/useSubscription';
```

### 6. Direct imports in MainLayout.vue

Check and fix any barrel imports in MainLayout that pull unnecessary modules.

## Expected Impact

- Remove `@tanstack/vue-virtual` from initial bundle (~17 KB gzip)
- Remove entity UI components (AccountCard, DebtCard, GoalCard, etc.) from initial bundle
- Remove changelog data + modal from initial bundle (~5-8 KB gzip)
- Remove premium modal from initial bundle
- Estimated total reduction: ~30-50% of initial bundle size

## Non-Goals

- No SSR migration
- No full barrel refactor across the project
- No changes to route-level code splitting (already good)
