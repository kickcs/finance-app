# Quick Actions Enhancement: Amount, Custom Names, Compact Size

**Date**: 2026-03-20
**Status**: Approved

## Overview

Enhance Quick Actions with three capabilities:
1. Optional amount field — enables one-tap transaction creation
2. Custom names — user-defined labels instead of category names
3. Compact sizing — fit 6 quick action slots (+ Scan Receipt = 7 total)

## Current State

- Max 4 quick action slots per user
- Fields: `id`, `userId`, `categoryId`, `accountId`, `label`, `position`, `createdAt`, `updatedAt`
- Button size: 76px (mobile) / 88px (desktop), icon 40/48px
- Click navigates to `/transactions/new` with pre-filled category and account
- Scan Receipt button occupies first position (premium)

## Design

### 1. Backend: Model & API

**Migration**: Add `amount DECIMAL(12,2) NULL` column to `quick_actions` table.

**Domain aggregate** (`quick-action.aggregate.ts`): Add `amount?: number` property and `setAmount(amount: number | null)` method.

**ORM entity** (`quick-action.orm-entity.ts`): Add `amount: string | null` (TypeORM stores decimal as string).

**Mapper**: Convert `string | null` ↔ `number | null` in both directions.

**DTOs**:
- `CreateQuickActionDto`: Add `amount?: number` (optional, `@IsNumber()`, `@IsPositive()`)
- `UpdateQuickActionDto`: Add `amount?: number | null` (nullable to allow clearing)

**MAX_QUICK_ACTIONS**: Change from 4 to 6 in `CreateQuickActionHandler`. Update error message string from "4" to "6".

**Command classes**:
- `CreateQuickActionCommand`: Add `amount?: number` constructor parameter
- `UpdateQuickActionCommand`: Add `amount?: number | null` to data type

**Response serializer** (`quick-action-response.ts`): Add `amount: a.amount ?? null` to `toQuickActionResponse()`.

**Controller** (`quick-actions.controller.ts`): Pass `dto.amount` to `CreateQuickActionCommand`.

**API endpoints unchanged** — same routes, new optional field in request/response.

### 2. Frontend: One-tap Transaction Creation

**Click behavior branching** (in `useDashboardQuickActions`):
- If quick action has `amount` → call `POST /api/transactions` directly with `{ type: 'expense', categoryId, accountId, amount, currency }` (currency resolved from account via `useAccounts`), show success toast with haptic feedback
- If quick action has no `amount` → current behavior (navigate to `/transactions/new?type=expense&categoryId=X&accountId=Y`)

**Implementation**: Use `createTransaction` mutation from `useTransactions` composable. Pass `updateBalance` callback (from `useAccounts` or `useAccountBalances`) as required second argument. After successful creation, invalidate transaction-related queries via `invalidateTransactionRelated`.

### 3. Frontend: Modal Enhancements

**New fields in `QuickActionModal.vue`**:
- **Name input** (`UInput`): Placed at top of modal. Placeholder = selected category name. If left empty, category name is used as fallback label.
- **Amount input** (`UInput` variant="currency"): With currency symbol of selected account. Optional. Helper text: "Для мгновенного создания" (For instant creation).

**Field order**: Name → Category → Account → Amount

### 4. Frontend: Compact Button Sizing

**Layout changes in `DashboardQuickActions.vue`**:

| Property | Current (mobile/desktop) | New (mobile/desktop) |
|---|---|---|
| Button height | 76px / 88px | 60px / 72px |
| Icon size | 40px / 48px | 32px / 36px |
| Gap | 12px / 16px | 8px / 8px |
| Label size | text-xs / text-sm | text-[10px] / text-xs |
| Button width formula | `calc((100%-36px)/4)` | `calc((100%-40px)/6)` |

- Labels: single line, truncated with ellipsis
- If amount is set: show formatted amount as secondary text below label (smaller, muted color)
- Scan Receipt button remains as 7th element (scroll to reveal if needed)

**MAX_SLOTS**: Update from 4 to 6 in:
- `useQuickActions.ts` (entity composable)
- `QuickActionsSettingsPage.vue` (settings page, show 6 slots)

### 5. Settings Page Updates

- Display 6 slots instead of 4
- Show amount (if set) as secondary text in slot item
- Empty slots labeled "Настроить слот N" for N = 1..6

## Files to Modify

**Backend**:
- `backend/src/modules/accounting/domain/aggregates/quick-action/quick-action.aggregate.ts`
- `backend/src/modules/accounting/infrastructure/persistence/typeorm/quick-action.orm-entity.ts`
- `backend/src/modules/accounting/infrastructure/persistence/mappers/quick-action.mapper.ts`
- `backend/src/modules/accounting/application/commands/create-quick-action/create-quick-action.command.ts`
- `backend/src/modules/accounting/application/commands/create-quick-action/create-quick-action.handler.ts`
- `backend/src/modules/accounting/application/commands/update-quick-action/update-quick-action.command.ts`
- `backend/src/modules/accounting/application/commands/update-quick-action/update-quick-action.handler.ts`
- `backend/src/modules/accounting/application/commands/quick-action-response.ts`
- `backend/src/modules/accounting/presentation/controllers/quick-actions.controller.ts`
- `backend/src/modules/accounting/presentation/dtos/create-quick-action.dto.ts`
- `backend/src/modules/accounting/presentation/dtos/update-quick-action.dto.ts`
- New migration file

**Frontend**:
- `frontend/src/shared/api/database.types.ts` (add `amount` to `quick_actions` Row/Insert/Update)
- `frontend/src/entities/quick-action/api/quickActionApi.ts`
- `frontend/src/entities/quick-action/api/useQuickActions.ts`
- `frontend/src/features/configure-quick-action/model/types.ts` (add `amount?: number | null`)
- `frontend/src/features/configure-quick-action/model/useQuickActions.ts`
- `frontend/src/features/configure-quick-action/ui/QuickActionModal.vue`
- `frontend/src/pages/dashboard/ui/DashboardQuickActions.vue`
- `frontend/src/pages/dashboard/model/useDashboardQuickActions.ts`
- `frontend/src/pages/settings/quick-actions/QuickActionsSettingsPage.vue`

## Out of Scope

- Description/note field for one-tap transactions (can be added later)
- Reordering UI changes (existing drag behavior stays)
- Premium gating (6 slots available to all users)
