# Quick Actions: Server-Side Storage Design

**Date**: 2026-03-01
**Status**: Approved

## Problem

Quick actions are stored in localStorage, so they don't sync across devices/platforms.

## Decision

Move quick actions to a dedicated database table with CRUD API endpoints. UI state (hidden, hintDismissed) moves to profile fields. Migrate existing localStorage data on first load.

## Scope

- Expense-only quick actions (same as current)
- Max 4 slots with position ordering
- Migrate localStorage → server on first load
- No commit/push — review with /crq twice after implementation

## Backend

### Database

**Table `quick_actions`**:
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| userId | UUID | FK → users, NOT NULL |
| categoryId | UUID | FK → categories, NOT NULL |
| accountId | UUID | FK → accounts, NOT NULL |
| label | varchar | NOT NULL |
| position | smallint | 0-3 |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Profile table** — add columns:
- `quickActionsHidden` boolean DEFAULT false
- `quickActionsHintDismissed` boolean DEFAULT false

### Module Structure (in `modules/accounting`)

- `domain/entities/quick-action.entity.ts`
- `domain/repositories/quick-action-repository.interface.ts`
- `application/commands/` — create, update, delete, reorder
- `application/queries/` — get-user-quick-actions
- `infrastructure/persistence/` — TypeORM entity, mapper, repository
- `presentation/` — controller, DTOs

### API Endpoints

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/api/quick-actions` | — | QuickAction[] |
| POST | `/api/quick-actions` | {categoryId, accountId, label} | QuickAction |
| PATCH | `/api/quick-actions/:id` | Partial<{categoryId, accountId, label}> | QuickAction |
| DELETE | `/api/quick-actions/:id` | — | void |
| PATCH | `/api/quick-actions/reorder` | {ids: string[]} | QuickAction[] |

All endpoints require JWT auth. Max 4 actions enforced on POST.

## Frontend

### New entity: `entities/quick-action/`

- `api/quickActionApi.ts` — HTTP functions (camelCase → snake_case transform)
- `api/useQuickActions.ts` — Vue Query composable
- `api/queryKeys.ts` — query key factory
- `model/types.ts` — TypeScript types

### Composable API: `useQuickActions(userId)`

Returns same interface as current localStorage version:
- `quickActions`, `slots` (always 4, padded with null)
- `hidden`, `hintDismissed` (from profile)
- `addAction`, `updateAction`, `removeAction` (mutations)
- `toggleHidden`, `dismissHint` (profile mutations)

### Migration (one-time)

1. On init, check `localStorage.getItem('quick_actions')`
2. If data exists AND server returns empty → POST each action to server
3. Migrate `quick_actions_hidden` and `quick_actions_hint_dismissed` to profile
4. Remove all localStorage keys
5. One-time operation

### Component Changes

Minimal — same composable interface:
- `DashboardPage.vue` — update import
- `QuickActionsSettingsPage.vue` — update import
- `QuickActionModal.vue` — no changes (props-driven)
- `DashboardQuickActions.vue` — no changes (props-driven)
- `useDashboardQuickActions.ts` — update import
