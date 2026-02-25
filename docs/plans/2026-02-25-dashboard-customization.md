# Dashboard Customization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to hide accounts from total balance and customize dashboard widget order/visibility.

**Architecture:** JSONB column `dashboard_settings` in existing `profiles` table. Backend: extend profile domain/ORM/API. Frontend: new settings page with DnD reorder + toggles, dashboard reads settings to filter widgets and balance.

**Tech Stack:** NestJS + TypeORM (backend), Vue 3 + TanStack Vue Query + vuedraggable (frontend), Tailwind CSS v4

---

### Task 1: Backend — Migration

**Files:**
- Create: `backend/src/database/migrations/1772100000000-AddDashboardSettings.ts`

**Step 1: Create migration file**

```typescript
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddDashboardSettings1772100000000 implements MigrationInterface {
  name = 'AddDashboardSettings1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD COLUMN "dashboard_settings" jsonb DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" DROP COLUMN "dashboard_settings"`,
    );
  }
}
```

**Step 2: Run migration locally**

Run: `cd backend && bun run migration:run`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add backend/src/database/migrations/1772100000000-AddDashboardSettings.ts
git commit -m "feat: add dashboard_settings JSONB column to profiles"
```

---

### Task 2: Backend — Domain Layer

**Files:**
- Modify: `backend/src/modules/identity/domain/entities/profile.entity.ts`

**Step 1: Add DashboardSettings interface and field to ProfileProps**

At top of file, before `ProfileProps`, add:

```typescript
export type WidgetId = 'quick_actions' | 'accounts' | 'transactions' | 'debts' | 'reminders';

export interface DashboardSettings {
  widgetOrder: WidgetId[];
  hiddenWidgets: WidgetId[];
  hiddenAccountIds: string[];
}
```

Add to `ProfileProps` interface:
```typescript
dashboardSettings: DashboardSettings | null;
```

**Step 2: Add private field, constructor assignment, and getter to Profile class**

Add private field:
```typescript
private _dashboardSettings: DashboardSettings | null;
```

In constructor, add:
```typescript
this._dashboardSettings = props.dashboardSettings;
```

Add getter:
```typescript
get dashboardSettings(): DashboardSettings | null {
  return this._dashboardSettings;
}
```

**Step 3: Update factory methods**

In `createRegistered()` and `createDemo()`, add to props object:
```typescript
dashboardSettings: null,
```

**Step 4: Add dashboardSettings to updateProfile method**

Extend the `data` parameter type:
```typescript
dashboardSettings?: DashboardSettings | null;
```

Add handling block:
```typescript
if (data.dashboardSettings !== undefined) {
  this._dashboardSettings = data.dashboardSettings;
  changes.dashboardSettings = data.dashboardSettings;
}
```

**Step 5: Verify backend builds**

Run: `cd backend && bun run build`
Expected: Success

**Step 6: Commit**

```bash
git add backend/src/modules/identity/domain/entities/profile.entity.ts
git commit -m "feat: add dashboardSettings to Profile domain entity"
```

---

### Task 3: Backend — ORM Entity + Mapper

**Files:**
- Modify: `backend/src/modules/identity/infrastructure/persistence/typeorm/profile.orm-entity.ts`
- Modify: `backend/src/modules/identity/infrastructure/persistence/mappers/profile.mapper.ts`

**Step 1: Add column to ORM entity**

In `ProfileOrmEntity`, add after `refreshToken` column:

```typescript
@Column({ name: 'dashboard_settings', type: 'jsonb', nullable: true })
dashboardSettings: Record<string, unknown> | null;
```

**Step 2: Update mapper — toDomain**

In `ProfileMapper.toDomain()`, add to reconstitute props:
```typescript
dashboardSettings: ormEntity.dashboardSettings as DashboardSettings | null,
```

Import `DashboardSettings` from domain:
```typescript
import { Profile, Email, Password, type DashboardSettings } from '../../../domain';
```

Note: The domain barrel export (`domain/index.ts`) needs to re-export `DashboardSettings`. Check if it exists, and if not, add the re-export.

**Step 3: Update mapper — toOrm**

In `ProfileMapper.toOrm()`, add:
```typescript
ormEntity.dashboardSettings = domainEntity.dashboardSettings;
```

**Step 4: Verify backend builds**

Run: `cd backend && bun run build`
Expected: Success

**Step 5: Commit**

```bash
git add backend/src/modules/identity/infrastructure/persistence/typeorm/profile.orm-entity.ts
git add backend/src/modules/identity/infrastructure/persistence/mappers/profile.mapper.ts
git commit -m "feat: add dashboardSettings to ORM entity and mapper"
```

---

### Task 4: Backend — API Layer (DTO, Command, Query, Response)

**Files:**
- Modify: `backend/src/modules/identity/presentation/dto/update-profile.dto.ts`
- Modify: `backend/src/modules/identity/application/commands/update-profile/update-profile.command.ts`
- Modify: `backend/src/modules/identity/application/commands/update-profile/update-profile.handler.ts`
- Modify: `backend/src/modules/identity/application/queries/get-profile/get-profile.handler.ts`
- Modify: `backend/src/modules/identity/application/types/index.ts`

**Step 1: Add to ProfileResponse type**

In `backend/src/modules/identity/application/types/index.ts`, add field to `ProfileResponse`:
```typescript
dashboardSettings: DashboardSettings | null;
```

Import the type:
```typescript
import type { DashboardSettings } from '../../domain/entities/profile.entity';
```

**Step 2: Add to UpdateProfileDto**

In `update-profile.dto.ts`, add:
```typescript
@IsOptional()
dashboardSettings?: {
  widgetOrder?: string[];
  hiddenWidgets?: string[];
  hiddenAccountIds?: string[];
} | null;
```

Use `@ValidateNested()` is overkill here — the JSONB is validated at domain level.

**Step 3: Add to UpdateProfileCommand**

In `update-profile.command.ts`, extend the data type:
```typescript
import type { DashboardSettings } from '../../../domain/entities/profile.entity';

export class UpdateProfileCommand {
  constructor(
    public readonly userId: string,
    public readonly data: {
      name?: string;
      currency?: string;
      hasCompletedOnboarding?: boolean;
      defaultAccountId?: string | null;
      dashboardSettings?: DashboardSettings | null;
    },
  ) {}
}
```

**Step 4: Add dashboardSettings to toResponse in both handlers**

In both `get-profile.handler.ts` and `update-profile.handler.ts`, add to `toResponse()`:
```typescript
dashboardSettings: profile.dashboardSettings,
```

**Step 5: Verify backend builds**

Run: `cd backend && bun run build`
Expected: Success

**Step 6: Run tests**

Run: `cd backend && bun run test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add backend/src/modules/identity/
git commit -m "feat: expose dashboardSettings through profile API"
```

---

### Task 5: Frontend — Types & API Layer

**Files:**
- Modify: `frontend/src/shared/api/database.types.ts`
- Modify: `frontend/src/shared/api/services/profileApi.ts`

**Step 1: Add DashboardSettings type and update Profile type**

In `database.types.ts`, add near the top (after Json type):
```typescript
export type WidgetId = 'quick_actions' | 'accounts' | 'transactions' | 'debts' | 'reminders';

export interface DashboardSettings {
  widget_order: WidgetId[];
  hidden_widgets: WidgetId[];
  hidden_account_ids: string[];
}
```

Add `dashboard_settings` to profiles Row, Insert, and Update types:
```typescript
// In Row:
dashboard_settings: DashboardSettings | null;
// In Insert:
dashboard_settings?: DashboardSettings | null;
// In Update:
dashboard_settings?: DashboardSettings | null;
```

**Step 2: Update profileApi.ts**

In `ProfileResponse` interface, add:
```typescript
dashboardSettings: {
  widgetOrder: string[];
  hiddenWidgets: string[];
  hiddenAccountIds: string[];
} | null;
```

In `transformProfile()`, add:
```typescript
dashboard_settings: profile.dashboardSettings ? {
  widget_order: profile.dashboardSettings.widgetOrder as WidgetId[],
  hidden_widgets: profile.dashboardSettings.hiddenWidgets as WidgetId[],
  hidden_account_ids: profile.dashboardSettings.hiddenAccountIds,
} : null,
```

In `update()` method, add to the PATCH body:
```typescript
dashboardSettings: updates.dashboard_settings ? {
  widgetOrder: updates.dashboard_settings.widget_order,
  hiddenWidgets: updates.dashboard_settings.hidden_widgets,
  hiddenAccountIds: updates.dashboard_settings.hidden_account_ids,
} : updates.dashboard_settings,
```

**Step 3: Verify frontend builds**

Run: `cd frontend && bun run build`
Expected: Success

**Step 4: Commit**

```bash
git add frontend/src/shared/api/database.types.ts frontend/src/shared/api/services/profileApi.ts
git commit -m "feat: add dashboardSettings to frontend types and API"
```

---

### Task 6: Frontend — useProfile composable update

**Files:**
- Modify: `frontend/src/shared/api/composables/useProfile.ts`

**Step 1: Add dashboard settings helpers**

Add after `setDefaultAccount()`:

```typescript
const dashboardSettings = computed(() => profile.value?.dashboard_settings ?? null);

async function updateDashboardSettings(settings: DashboardSettings) {
  return updateProfile({ dashboard_settings: settings });
}
```

Import `DashboardSettings` type from `database.types`.

**Step 2: Add to return object**

Add `dashboardSettings` and `updateDashboardSettings` to the return object.

**Step 3: Verify frontend builds**

Run: `cd frontend && bun run build`
Expected: Success

**Step 4: Commit**

```bash
git add frontend/src/shared/api/composables/useProfile.ts
git commit -m "feat: add dashboardSettings helpers to useProfile"
```

---

### Task 7: Frontend — Dashboard Settings Page

**Files:**
- Create: `frontend/src/pages/dashboard-settings/DashboardSettingsPage.vue`
- Create: `frontend/src/pages/dashboard-settings/model/constants.ts`
- Modify: `frontend/src/app/router/index.ts`

Use the **frontend-design** skill for this task to create a polished, distinctive UI.

**Step 1: Create constants file**

```typescript
import type { WidgetId } from '@/shared/api/database.types';

export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  'quick_actions',
  'accounts',
  'transactions',
  'debts',
  'reminders',
];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  quick_actions: 'Быстрые действия',
  accounts: 'Счета',
  transactions: 'Последние транзакции',
  debts: 'Долги',
  reminders: 'Напоминания',
};

export const WIDGET_ICONS: Record<WidgetId, string> = {
  quick_actions: 'bolt',
  accounts: 'account_balance_wallet',
  transactions: 'receipt_long',
  debts: 'handshake',
  reminders: 'notifications',
};
```

**Step 2: Create DashboardSettingsPage.vue**

This is the main settings page with two sections:
1. **Widget order** — DnD reorder list with drag handles + visibility toggles
2. **Balance accounts** — list of user accounts with toggles for inclusion in total balance

Use `vuedraggable` for DnD (install: `cd frontend && bun add vuedraggable@next`).

The page should:
- Read current `dashboardSettings` from `useProfile()`
- Initialize with defaults if `null`
- Auto-save on every change (debounced 500ms via `useDebounceFn` from VueUse)
- Use `UCard`, `UIcon`, switch/toggle pattern from existing components
- Back button navigation to dashboard
- Standard page layout: `min-h-screen bg-background-light dark:bg-background-dark pb-28`

**Step 3: Add route**

In `frontend/src/app/router/index.ts`, add within the authenticated routes children array:

```typescript
{
  path: '/dashboard/settings',
  name: 'dashboard-settings',
  component: () => import('@/pages/dashboard-settings/DashboardSettingsPage.vue'),
  meta: { requiresAuth: true, requiresOnboarding: true },
},
```

**Step 4: Install vuedraggable**

Run: `cd frontend && bun add vuedraggable@next`

**Step 5: Verify frontend builds**

Run: `cd frontend && bun run build`
Expected: Success

**Step 6: Commit**

```bash
git add frontend/src/pages/dashboard-settings/ frontend/src/app/router/index.ts frontend/bun.lockb frontend/package.json
git commit -m "feat: add dashboard settings page with DnD widget reorder"
```

---

### Task 8: Frontend — Dashboard reads settings

**Files:**
- Modify: `frontend/src/pages/dashboard/model/useDashboardData.ts`
- Modify: `frontend/src/pages/dashboard/DashboardPage.vue`

**Step 1: Expose dashboardSettings from useDashboardData**

In `useDashboardData.ts`, import and compute filtered balance:

```typescript
import type { WidgetId } from '@/shared/api/database.types';
import { DEFAULT_WIDGET_ORDER } from '@/pages/dashboard-settings/model/constants';
```

Add after existing computeds:

```typescript
const dashboardSettings = computed(() => profile.value?.dashboard_settings ?? null);

const widgetOrder = computed<WidgetId[]>(() =>
  dashboardSettings.value?.widget_order ?? DEFAULT_WIDGET_ORDER,
);

const hiddenWidgets = computed<Set<WidgetId>>(() =>
  new Set(dashboardSettings.value?.hidden_widgets ?? []),
);

const hiddenAccountIds = computed<Set<string>>(() =>
  new Set(dashboardSettings.value?.hidden_account_ids ?? []),
);
```

Modify `totalBalance` to filter hidden accounts:

```typescript
const totalBalance = computed(() => {
  const filteredByCurrency: Record<string, number> = {};
  for (const account of accounts.value) {
    if (hiddenAccountIds.value.has(account.id)) continue;
    for (const balance of account.balances) {
      filteredByCurrency[balance.currency] = (filteredByCurrency[balance.currency] ?? 0) + balance.balance;
    }
  }
  return sumConverted(filteredByCurrency);
});
```

Add `widgetOrder`, `hiddenWidgets` to return object.

**Step 2: Update DashboardPage.vue to render widgets dynamically**

Replace the hardcoded mobile widget sections with a dynamic loop based on `widgetOrder` and `hiddenWidgets`. The hero section stays fixed. Use a component map or `v-if` chain keyed by widget ID.

Example approach — in the mobile layout section, replace the individual widget `<section>` blocks (quick_actions, accounts, activity) with:

```vue
<template v-for="widgetId in widgetOrder" :key="widgetId">
  <section v-if="!hiddenWidgets.has(widgetId)" :class="staggerClass('delay-150')">
    <!-- render widget by ID -->
  </section>
</template>
```

Map each `widgetId` to its component with the correct props.

**Step 3: Add settings gear icon to dashboard header**

Add a settings icon button in `DashboardMobileHeader.vue` or the dashboard page that navigates to `/dashboard/settings`.

**Step 4: Verify frontend builds**

Run: `cd frontend && bun run build`
Expected: Success

**Step 5: Manual test**

1. Open dashboard — should look identical (default settings)
2. Go to `/dashboard/settings` — should see widget list and account toggles
3. Reorder widgets → return to dashboard → verify new order
4. Hide a widget → return to dashboard → verify it's gone
5. Uncheck an account → verify total balance changes

**Step 6: Commit**

```bash
git add frontend/src/pages/dashboard/
git commit -m "feat: dashboard reads widget order and balance settings from profile"
```

---

### Task 9: Changelog entry

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

**Step 1: Add changelog entry**

Add at top of `CHANGELOG_ENTRIES` array:

```typescript
{
  version: '<next-patch>',
  date: '2026-02-25',
  entries: [
    {
      type: 'feature',
      description: 'Настройка дашборда: перетаскивание виджетов, скрытие модулей и исключение счетов из общего баланса',
    },
  ],
},
```

Check current latest version and bump patch.

**Step 2: Commit**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "feat: add changelog entry for dashboard customization"
```

---

### Task 10: Final verification

**Step 1: Backend build + tests**

Run: `cd backend && bun run build && bun run test`
Expected: All pass

**Step 2: Frontend build**

Run: `cd frontend && bun run build`
Expected: No errors

**Step 3: Integration test**

Run: `bun run dev` (both frontend and backend)
Test the full flow:
1. Dashboard loads with default layout
2. Navigate to settings page
3. Drag widgets to reorder
4. Toggle widget visibility
5. Toggle account balance inclusion
6. Return to dashboard — verify changes applied
7. Refresh page — verify settings persisted
