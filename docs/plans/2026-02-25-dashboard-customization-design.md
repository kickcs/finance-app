# Dashboard Customization — Design Document

**Date**: 2026-02-25
**Status**: Approved

## Summary

Two features:
1. **Hide accounts from total balance** — per-account toggle excluding from balance calculation
2. **Customize dashboard widgets** — DnD reorder + toggle visibility

## Requirements

- Separate settings screen at `/dashboard/settings`
- Hero section (balance + stats) stays fixed at top — not customizable
- Configurable widgets: Quick Actions, Accounts, Transactions, Debts, Reminders
- Backend storage via JSONB column in `profiles` table
- Available to all users (not premium-gated)

## Data Model

### New column: `profiles.dashboard_settings JSONB DEFAULT NULL`

```json
{
  "widgetOrder": ["quick_actions", "accounts", "transactions", "debts", "reminders"],
  "hiddenWidgets": ["reminders"],
  "hiddenAccountIds": ["uuid-1", "uuid-2"]
}
```

When `null` — all widgets visible, default order, all accounts in balance.

### Domain Value Object: `DashboardSettings`

```typescript
interface DashboardSettings {
  widgetOrder: WidgetId[];
  hiddenWidgets: WidgetId[];
  hiddenAccountIds: string[];
}

type WidgetId = 'quick_actions' | 'accounts' | 'transactions' | 'debts' | 'reminders';
```

## API

No new endpoints. Extend existing:
- `GET /api/profiles/me` → returns `dashboardSettings`
- `PATCH /api/profiles/me` → accepts `dashboardSettings`

## Frontend Architecture

### Settings Screen (`/dashboard/settings`)

Two sections:

**1. Widgets section** — DnD list with drag handle + toggle:
```
☰ Quick Actions          [✓]
☰ Счета                  [✓]
☰ Последние транзакции   [✓]
☰ Долги                  [○]
☰ Напоминания            [✓]
```

**2. Accounts in balance** — account list with toggle:
```
Основной счёт     [✓]
Кредитка          [✓]
Заначка           [○]  ← excluded from balance
```

DnD: `vuedraggable` or `@vueuse/integrations/useSortable`

### Dashboard Changes

1. Render widgets in `widgetOrder` order
2. Skip widgets in `hiddenWidgets`
3. Filter `hiddenAccountIds` from `totalBalancesByCurrency` calculation

### Entry Point

Gear icon in dashboard header → navigate to `/dashboard/settings`

## Storage

JSONB in existing `profiles` table. One migration, one column.
Backend validation in domain layer. Frontend uses `useProfile` composable.
