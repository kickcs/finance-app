# Create Debt Drawer Redesign

**Date:** 2026-03-18
**Branch:** feature/debts-pages-redesign

## Overview

Replace `DebtForm.vue` (full-page form at `/debts/new`) with `CreateDebtDrawer.vue` — a bottom-sheet drawer rendered inline on `DebtsListPage`. Adds two new fields: `is_private` toggle (backend already supports it in update path, needs wiring into create) and `due_date` (reuses `next_payment_date` column). Account selector migrates to `SelectChips` with animated sliding indicator.

## Architecture Changes

### New File
- `frontend/src/features/create-debt/ui/CreateDebtDrawer.vue` — DrawerRoot (vaul-vue) containing the full creation form

### Deleted Files
- `frontend/src/features/create-debt/ui/DebtForm.vue` — replaced by CreateDebtDrawer
- `frontend/src/pages/debts/new/AddDebtPage.spec.ts` — delete; tests covered by CreateDebtDrawer behaviour

### Modified Files

| File | Change |
|------|--------|
| `features/create-debt/model/useCreateDebt.ts` | Add `is_private: boolean` and `due_date: string \| null` to `DebtFormData`; pass both in `create()` call; fix `onSuccess` order |
| `features/create-debt/index.ts` | Export `CreateDebtDrawer` instead of `DebtForm` |
| `pages/debts/list/useDebtsPageState.ts` | Add `showCreateDrawer: ref(false)`; change `handleAddDebt` to set `showCreateDrawer = true` instead of `router.push` |
| `pages/debts/list/DebtsListPage.vue` | Add `<CreateDebtDrawer v-model:open="showCreateDrawer">` |
| `pages/debts/new/AddDebtPage.vue` | Replace with redirect to `ROUTE_NAMES.DEBTS_LIST` using `router.replace()` |
| `app/router/index.ts` | Remove `NEW_DEBT` route after updating all callers (see AddDebtPage section) |
| `pages/dashboard/model/useDashboardNavigation.ts` | Change `toNewDebt()` to navigate to `DEBTS_LIST` (second known caller of `NEW_DEBT`) |
| `entities/debt/api/debtsApi.ts` | Add `isPrivate` and `nextPaymentDate` to `create()` payload (see API section) |
| `shared/api/database.types.ts` | Confirm `is_private: boolean` in `debts.Row` (already modified on branch) |
| `backend/.../create-debt.dto.ts` | Add `@IsOptional() @IsBoolean() isPrivate?: boolean` |
| `backend/.../create-debt.command.ts` | Add `isPrivate?: boolean` as last parameter |
| `backend/.../debts.controller.ts` | Thread `dto.isPrivate` through `new CreateDebtCommand(...)` |
| `backend/.../create-debt.handler.ts` | After `Debt.create()`, call `debt.update({ isPrivate: command.isPrivate ?? false })` before save |

## Component Design: CreateDebtDrawer.vue

### Structure
```
DrawerRoot (vaul-vue, v-model:open)
  DrawerPortal
    DrawerOverlay (fixed inset-0 z-50 bg-black/40)
    DrawerContent (fixed bottom-0 left-0 right-0 z-50, max-h-[90dvh], rounded-t-2xl)
      Handle bar (flex justify-center pt-3 pb-1)
        DrawerHandle
      Header (flex items-center justify-between px-5 pb-3)
        DrawerTitle "Новый долг"
        Close button (UIcon close)
      Scroll container (flex-1 overflow-y-auto px-5 pb-5 space-y-5, data-vaul-no-drag, overscroll-contain)
        [form fields]
      Footer (px-5 border-t, safe-area padding)
        UButton submit
```

### Form Fields (in order)

1. **Debt type** — `UTabs` with `given`/`taken` items (existing `DEBT_DIRECTION_LABELS`)
2. **Person** — `PersonSelector` (existing component)
3. **Amount + currency** — flex row: optional `<select>` for multi-currency + `UInput variant="currency"` with suffix
4. **Account** — `SelectChips` from `shared/ui`. `items = accounts.map(a => ({ id: a.id, label: a.name }))`. `modelValue = formData.account_id`. `null` = no account selected. `all-label="Счёт не выбран"`. On change: replicate existing `handleAccountChange` logic (update `account_id` + reset `currency` to first balance).
5. **Debt date** — Popover + Calendar (existing pattern from current DebtForm)
6. **Due date** — label "Срок возврата". Two states:
   - `due_date === null`: button showing "Без срока" (muted style) with `calendar_today` icon — clicking opens calendar
   - `due_date !== null`: button showing formatted date + small `×` clear button that sets `due_date = null`
   - Default: `null`
7. **Description** — `UInput` label="Комментарий (необязательно)"
8. **Is private** — row: left side has label "Скрыть сумму" + subtitle "Сумма не будет видна в общем списке", right side has `UToggle v-model="formData.is_private"`
9. **Skip transaction** — existing checkbox row (label text changes by debt type)
10. **Info box** — existing info box (hidden when `skipTransaction = true`)

### Validation (unchanged)
`isValid` requires: `person_name.trim().length > 0 && amount > 0 && account_id !== null && currency !== ''`. The `due_date` and `is_private` fields are always optional.

## iOS / Keyboard Fixes (all from SplitExpenseDrawer)

1. **Virtual keyboard via `window.visualViewport`** — direct DOM manipulation (NOT reactive) to avoid re-renders that kill input focus:
   - `drawerEl.style.bottom` = keyboard offset in px
   - `drawerEl.style.top` = `env(safe-area-inset-top, 0px)` when keyboard visible
   - `drawerEl.style.maxHeight` = `${window.innerHeight - offset}px`
   - `footerEl.style.paddingBottom` = `'0.75rem'` when keyboard visible (override safe-area)
   - `scrollEl.style.paddingBottom` = `'1rem'` when keyboard visible
   - `document.documentElement.scrollTop = 0` + `document.body.scrollTop = 0` to prevent iOS scroll jump

2. **Race condition guard** — in `watch(open)`:
   ```js
   await nextTick();
   if (!props.open) return;
   setupKeyboardListener();
   ```

3. **Cleanup in two places** — `watch(open, isOpen => { if (!isOpen) cleanup() })` + `onBeforeUnmount(cleanup)`

4. **`data-vaul-no-drag`** on scroll container

5. **`overscroll-contain`** on scroll container

6. **`max-h-[90dvh]`** on DrawerContent

7. **Footer safe area** — `padding-bottom: calc(env(safe-area-inset-bottom, 16px) + 0.75rem)`

8. **`DrawerPortal`** — outside DOM tree

9. **`DrawerHandle`** — visual drag handle

## Data Flow

```
DebtFormData (useCreateDebt.ts)
  debt_type, person_name, amount, currency,
  account_id, debt_date, description,
  skipTransaction,
  is_private: boolean    // NEW, default: false
  due_date: string|null  // NEW, default: null

createDebt(userId):
  1. if !skipTransaction → transactionsApi.create(...)
  2. debtsApi.create({
       ...,
       is_private: formData.is_private,        // new field
       next_payment_date: formData.due_date,   // reuses column
     })
  3. link transaction back to debt (unchanged)
```

## API Layer Changes

### `debtsApi.create()` — add to POST body:
```typescript
isPrivate: debt.is_private ?? false,
nextPaymentDate: debt.next_payment_date ?? undefined,
```

### `database.types.ts` — debts types status:
- `debts.Row.is_private: boolean` — already present on this branch ✓
- `debts.Insert.is_private?: boolean` — already present on this branch ✓ (so `DebtInsert` accepts it in `debtsApi.create()`)
No changes needed.

## Backend Change: Full 4-file Chain for `isPrivate` in Create

### 1. `create-debt.dto.ts`
```typescript
@IsOptional()
@IsBoolean()
isPrivate?: boolean;
```

### 2. `create-debt.command.ts`
Add `isPrivate?: boolean` as the last constructor parameter. Keep all existing params unchanged.

### 3. `debts.controller.ts`
Thread `createDebtDto.isPrivate` as the new last arg in `new CreateDebtCommand(...)`.

### 4. `create-debt.handler.ts`
After `Debt.create()` and before saving:
```typescript
if (command.isPrivate) {
  debt.update({ isPrivate: true });
}
```
Note: `command.isPrivate = false` and `command.isPrivate = undefined` are both handled identically — the guard only fires for `true`. This is intentional since `Debt.create()` already defaults `isPrivate: false`.

## `useCreateDebt.ts` — Form Reset

`resetForm()` is currently only called explicitly. It must be called in two places:

1. **On drawer close (any reason)** — inside `CreateDebtDrawer.vue`'s `watch(open)`:
   ```typescript
   watch(() => props.open, (isOpen) => {
     if (!isOpen) {
       nextTick(resetForm); // clear stale values when drawer closes
     }
   });
   ```
   This prevents stale values when the drawer is reopened after a cancelled or failed submission.

2. **On success** — expose `resetForm` from `useCreateDebt` and call it from the drawer after close, OR add it to `onSuccess` after the toast (note: current `onSuccess` does NOT call `resetForm`, so this must be added explicitly). Current code is correct in that `toast()` reads `formData.value` before any reset — just ensure `resetForm()` is added after the toast call in `onSuccess` so the query cache gets the right values.

## Drawer Close on Success

Inside `CreateDebtDrawer.vue`, after successful submit, emit `update:open = false`. Pattern:
- `useCreateDebt` exposes `isSubmitting` and `error`
- Watch for `isSubmitting` transitioning `true → false` with `error === null` → close drawer
- OR: `createDebt()` returns `debtId | null` — if non-null, emit close

Preferred: `createDebt()` returns id → in drawer `handleSubmit`: `if (await createDebt(userId)) emit('update:open', false)`.

## AddDebtPage Migration

Replace `AddDebtPage.vue` content with a redirect:
```vue
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
useRouter().replace({ name: ROUTE_NAMES.DEBTS_LIST });
</script>
<template><div /></template>
```

Two known callers of `ROUTE_NAMES.NEW_DEBT`:
1. `useDebtsPageState.ts` → `handleAddDebt()` — changed to open drawer (covered above)
2. `pages/dashboard/model/useDashboardNavigation.ts` → `toNewDebt()` — change to `router.push({ name: ROUTE_NAMES.DEBTS_LIST })`

After both are updated, remove the `NEW_DEBT` route from `app/router/index.ts` and the `NEW_DEBT` constant from `routeNames.ts`.

## `due_date: null` → API

`formData.due_date = null` must be sent as `nextPaymentDate: undefined` (not `null`) to the backend.

**Why:** `create-debt.dto.ts` has `@IsOptional() @IsDateString() nextPaymentDate?: string`. Sending `null` for an `@IsDateString()` field causes a class-validator 400 error. Use:
```typescript
nextPaymentDate: debt.next_payment_date ?? undefined,
```
This is already reflected in the API layer changes above.

## Files Summary

**Create:** `CreateDebtDrawer.vue`
**Delete:** `DebtForm.vue`, `AddDebtPage.spec.ts`
**Modify (frontend):** `useCreateDebt.ts`, `index.ts`, `useDebtsPageState.ts`, `DebtsListPage.vue`, `AddDebtPage.vue`, `debtsApi.ts`, `useDashboardNavigation.ts`, `router/index.ts`, `routeNames.ts`
**Modify (backend):** `create-debt.dto.ts`, `create-debt.command.ts`, `debts.controller.ts`, `create-debt.handler.ts`
