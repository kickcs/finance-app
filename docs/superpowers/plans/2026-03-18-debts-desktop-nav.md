# Debts Desktop Navigation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Долги" (Debts) as a standalone item in the desktop sidebar navigation without changing the mobile BottomNav.

**Architecture:** Introduce a separate `DESKTOP_NAV_ITEMS` array in the navigation config used only by `SidebarNav`. The existing `MAIN_NAV_ITEMS` stays untouched for `BottomNav`. The `handshake` icon is added to `iconMap.ts` as it was missing (causing `?` fallback).

**Tech Stack:** Vue 3, TypeScript, Vitest, Lucide Vue Next, Tailwind CSS v4

---

## Files

| Action | File | What changes |
|--------|------|--------------|
| Modify | `frontend/src/shared/ui/icon/iconMap.ts` | Add `Handshake` import + `handshake` mapping |
| Modify | `frontend/src/shared/config/navigation.ts` | Add `DESKTOP_NAV_ITEMS` export |
| Modify | `frontend/src/widgets/sidebar-nav/ui/SidebarNav.vue` | Replace all 4 `MAIN_NAV_ITEMS` refs with `DESKTOP_NAV_ITEMS` |

---

## Task 1: Add `handshake` icon to iconMap

**Files:**
- Modify: `frontend/src/shared/ui/icon/iconMap.ts`

- [ ] **Step 1: Add `Handshake` to the lucide import block**

In `frontend/src/shared/ui/icon/iconMap.ts`, add `Handshake` to the existing lucide import (alphabetically between `GripVertical` and `HandHeart`):

```ts
import {
  // ... existing imports ...
  GripVertical,
  Handshake,      // ← add here
  HandHeart,
  // ...
} from 'lucide-vue-next';
```

- [ ] **Step 2: Add the mapping entry**

In the `iconMap` object, add the entry alphabetically near other `h` entries (before `history`, since `han` < `his`):

```ts
export const iconMap: Record<string, Component> = {
  // ...
  handshake: Handshake,   // ← add here
  history: History,
  home: Home,
  // ...
};
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && bun run build
```

Expected: builds without errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/ui/icon/iconMap.ts
git commit -m "fix(ui): add handshake icon to iconMap"
```

---

## Task 2: Add `DESKTOP_NAV_ITEMS` to navigation config

**Files:**
- Modify: `frontend/src/shared/config/navigation.ts`

- [ ] **Step 1: Write a failing test**

Create `frontend/src/shared/config/navigation.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MAIN_NAV_ITEMS, DESKTOP_NAV_ITEMS } from './navigation';

describe('DESKTOP_NAV_ITEMS', () => {
  it('includes debts item with correct path', () => {
    const debts = DESKTOP_NAV_ITEMS.find((item) => item.id === 'debts');
    expect(debts).toBeDefined();
    expect(debts?.path).toBe('/debts');
    expect(debts?.icon).toBe('handshake');
  });

  it('has more items than MAIN_NAV_ITEMS', () => {
    expect(DESKTOP_NAV_ITEMS.length).toBeGreaterThan(MAIN_NAV_ITEMS.length);
  });
});

describe('MAIN_NAV_ITEMS', () => {
  it('does not include debts (mobile nav unchanged)', () => {
    const debts = MAIN_NAV_ITEMS.find((item) => item.id === 'debts');
    expect(debts).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && bun run test navigation.spec
```

Expected: FAIL — `DESKTOP_NAV_ITEMS` is not exported.

- [ ] **Step 3: Add `DESKTOP_NAV_ITEMS` to navigation.ts**

In `frontend/src/shared/config/navigation.ts`, append after `MAIN_NAV_ITEMS`:

```ts
export const DESKTOP_NAV_ITEMS: NavItem[] = [
  { id: 'home',      icon: 'home',      path: '/',          label: 'Главная' },
  { id: 'analytics', icon: 'pie_chart', path: '/analytics', label: 'Аналитика' },
  { id: 'history',   icon: 'history',   path: '/history',   label: 'История' },
  { id: 'debts',     icon: 'handshake', path: '/debts',     label: 'Долги' },
  { id: 'profile',   icon: 'person',    path: '/profile',   label: 'Профиль' },
];
```

Do NOT change `MAIN_NAV_ITEMS` or `CHILD_ROUTE_MAP`. The `/debts: 'home'` entry in `CHILD_ROUTE_MAP` must stay — `BottomNav` needs it to highlight "Главная" on mobile when navigating to `/debts`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && bun run test navigation.spec
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/config/navigation.ts frontend/src/shared/config/navigation.spec.ts
git commit -m "feat(nav): add DESKTOP_NAV_ITEMS with debts entry"
```

---

## Task 3: Update SidebarNav to use `DESKTOP_NAV_ITEMS`

**Files:**
- Modify: `frontend/src/widgets/sidebar-nav/ui/SidebarNav.vue`

There are exactly 4 occurrences of `MAIN_NAV_ITEMS` in this file (lines 8, 30, 37, 116).

- [ ] **Step 1: Update the import (line 8)**

```ts
// Before
import { MAIN_NAV_ITEMS } from '@/shared/config/navigation';

// After
import { DESKTOP_NAV_ITEMS } from '@/shared/config/navigation';
```

- [ ] **Step 2: Update the `activeItem` computed (line 30)**

```ts
// Before
MAIN_NAV_ITEMS.find((item) => {

// After
DESKTOP_NAV_ITEMS.find((item) => {
```

- [ ] **Step 3: Update `handleNavClick` type annotation (line 37)**

```ts
// Before
function handleNavClick(item: (typeof MAIN_NAV_ITEMS)[number]) {

// After
function handleNavClick(item: (typeof DESKTOP_NAV_ITEMS)[number]) {
```

- [ ] **Step 4: Update the `v-for` in the template (line 116)**

```html
<!-- Before -->
v-for="item in MAIN_NAV_ITEMS"

<!-- After -->
v-for="item in DESKTOP_NAV_ITEMS"
```

- [ ] **Step 5: Type-check build**

```bash
cd frontend && bun run build
```

Expected: builds without TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/widgets/sidebar-nav/ui/SidebarNav.vue
git commit -m "feat(nav): use DESKTOP_NAV_ITEMS in SidebarNav — adds Debts to desktop sidebar"
```

---

## Task 4: Manual verification

- [ ] **Step 1: Start dev server**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app && bun run dev
```

- [ ] **Step 2: Verify desktop sidebar** (viewport ≥ 768px)

- "Долги" appears in sidebar between "История" and "Профиль"
- Navigating to `/debts` highlights "Долги" in sidebar
- Navigating to `/debts/:id` (any debt detail) still highlights "Долги"
- The handshake icon renders correctly (not `?`)

- [ ] **Step 3: Verify mobile BottomNav** (viewport < 768px)

- BottomNav still shows: Главная, Аналитика, История, + (add), Профиль
- Navigating to `/debts` highlights "Главная" in BottomNav

- [ ] **Step 4: Run all frontend tests**

```bash
cd frontend && bun run test
```

Expected: all tests pass.
