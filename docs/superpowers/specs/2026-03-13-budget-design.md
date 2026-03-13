# Budget Feature — Design Spec

## Overview

Monthly expense budget with plan-vs-actual tracking. A single total expense limit per month displayed as a dashboard widget with progress bar.

## Scope (v1)

- One total monthly expense budget (no per-category limits)
- Dashboard widget (no dedicated page)
- Default amount + per-month overrides
- Budget in user's primary currency (other currencies converted via exchange rates)
- Free feature (no paywall)
- Budget history viewable for past months

## Domain Model

### Aggregate: `Budget`

Located in `modules/planning/`.

| Field       | Type    | Description                              |
|-------------|---------|------------------------------------------|
| id          | UUID    | Primary key                              |
| userId      | string  | Owner                                    |
| year        | number  | Budget year (NULL for default)           |
| month       | number  | Budget month 1-12 (NULL for default)     |
| amount      | number  | Expense limit, must be > 0              |
| currency    | string  | User's primary currency at creation time |
| isDefault   | boolean | True = template for future months        |
| createdAt   | Date    |                                          |
| updatedAt   | Date    |                                          |

### Business Rules

- A user may have at most one default budget (`isDefault = true`)
- A user may have at most one override per `(year, month)`
- `amount` must be greater than zero
- When user changes primary currency, existing budget amounts must be re-denominated via exchange rates on next `SetDefaultBudget` call. `GetBudgetForMonth` compares budget amount against spent in budget's stored currency (converting multi-currency expenses via exchange rates)

### Resolution Logic (read-only, no writes)

When requesting budget for a given month:
1. Find record with `(userId, year, month, isDefault=false)` → return if found
2. No override found → find record with `(userId, isDefault=true)` → return its `amount` as the effective budget (no DB write, virtual resolution)
3. No budget set → return null

## Commands & Queries

### Commands

| Command                    | Input                  | Behavior                                                    |
|----------------------------|------------------------|-------------------------------------------------------------|
| SetDefaultBudget           | `{ amount }`           | Create or update the `isDefault=true` record. Currency resolved from user profile |
| SetMonthlyBudgetOverride   | `{ year, month, amount }` | Create or update record for specific month. Currency resolved from user profile |
| RemoveMonthlyBudgetOverride| `{ year, month }`      | Delete override, month falls back to default                |

### Queries

| Query              | Input                              | Output                                              |
|--------------------|------------------------------------|------------------------------------------------------|
| GetBudgetForMonth  | `{ userId, year, month }`          | `{ budget, spent, remaining, percentage }` or null   |
| GetBudgetHistory   | `{ userId, months }` (default: 6)  | Array of `{ year, month, amount, spent, percentage }`|

`spent` is computed at query time. The handler converts multi-currency expenses to the budget's currency using exchange rates, then compares against `amount`.

### Cross-Module Dependency

`GetBudgetForMonth` and `GetBudgetHistory` need expense data from the accounting module. `PlanningModule` must import `AccountingModule`, and `AccountingModule` must export `TRANSACTION_REPOSITORY`. The handler injects `ITransactionRepository` via `@Inject(TRANSACTION_REPOSITORY)` to call `getMonthlyStats()`.

For currency conversion, inject `IExchangeRateRepository` via `@Inject(EXCHANGE_RATE_REPOSITORY)` from the exchange module (same pattern).

## API Endpoints

All endpoints require JWT authentication. Controller: `BudgetsController` at `/api/budgets`.

| Method | Path                              | Body / Query              | Response                                           |
|--------|-----------------------------------|---------------------------|-----------------------------------------------------|
| GET    | `/api/budgets/current`            | —                         | `{ budget, spent, remaining, percentage }` or null  |
| GET    | `/api/budgets/history`            | `?months=6`               | `{ items: [{ year, month, amount, spent, percentage }] }` |
| PUT    | `/api/budgets/default`            | `{ amount }`              | `{ budget }`                                        |
| PUT    | `/api/budgets/override`           | `{ year, month, amount }` | `{ budget }`                                        |
| DELETE | `/api/budgets/override/:year/:month` | —                      | `204 No Content`                                    |

Currency is resolved from user's profile (`defaultCurrency`) in command handlers, not from request body.

## Backend File Structure

```
modules/planning/
├── domain/
│   ├── aggregates/budget.ts
│   └── repositories/budget-repository.interface.ts
├── application/
│   ├── commands/
│   │   ├── index.ts                          # export CommandHandlers array
│   │   ├── set-default-budget/
│   │   │   ├── set-default-budget.command.ts
│   │   │   └── set-default-budget.handler.ts
│   │   ├── set-monthly-budget-override/
│   │   │   ├── set-monthly-budget-override.command.ts
│   │   │   └── set-monthly-budget-override.handler.ts
│   │   └── remove-monthly-budget-override/
│   │       ├── remove-monthly-budget-override.command.ts
│   │       └── remove-monthly-budget-override.handler.ts
│   └── queries/
│       ├── index.ts                          # export QueryHandlers array
│       ├── get-budget-for-month/
│       │   ├── get-budget-for-month.query.ts
│       │   └── get-budget-for-month.handler.ts
│       └── get-budget-history/
│           ├── get-budget-history.query.ts
│           └── get-budget-history.handler.ts
├── infrastructure/
│   └── persistence/
│       ├── budget.orm-entity.ts
│       ├── mappers/budget.mapper.ts
│       └── repositories/budget.repository.ts
└── presentation/
    ├── budgets.controller.ts
    └── dto/
        ├── set-default-budget.dto.ts
        ├── set-monthly-override.dto.ts
        └── budget-response.dto.ts
```

### Required Registration Changes

1. **`data-source.ts`** — add `BudgetOrmEntity` to entities array (for CLI migrations)
2. **`app.module.ts`** — add `BudgetOrmEntity` to `TypeOrmModule.forRootAsync` entities array (for runtime)
3. **`planning.module.ts`**:
   - Add `BudgetOrmEntity` to `TypeOrmModule.forFeature([..., BudgetOrmEntity])`
   - Add `{ provide: BUDGET_REPOSITORY, useClass: BudgetRepository }` to `providers`
   - Spread `...BudgetCommandHandlers, ...BudgetQueryHandlers` into `providers`
   - Import `AccountingModule` and `ExchangeModule` for cross-module queries
4. **`accounting.module.ts`** — export `TRANSACTION_REPOSITORY` so `PlanningModule` can inject it
5. **`exchange.module.ts`** — export `EXCHANGE_RATE_REPOSITORY` for currency conversion

Plus: TypeORM migration for `budgets` table.

## Frontend

### Entity: `entities/budget/`

```
entities/budget/
├── api/
│   ├── budgetApi.ts          # HTTP functions (camelCase → snake_case transform)
│   ├── useBudget.ts          # Vue Query composable
│   └── queryKeys.ts          # Query key factory
├── model/
│   └── types.ts              # TypeScript types
├── ui/
│   └── (no entity-level UI)
└── index.ts
```

**Query key factory:**
```typescript
export const budgetQueryKeys = {
  all: ['budgets'] as const,
  current: (userId: string) => ['budgets', 'current', userId] as const,
  history: (userId: string) => ['budgets', 'history', userId] as const,
}
```

**`useBudget` composable signature:**
```typescript
function useBudget(userId: MaybeRefOrGetter<string | null>) {
  // Query enabled guard: enabled: computed(() => !!toValue(userId))
  // Returns:
  //   budget, isLoading — current month data
  //   setDefault(amount) — PUT /api/budgets/default
  //   setOverride(year, month, amount) — PUT /api/budgets/override
  //   removeOverride(year, month) — DELETE /api/budgets/override/:year/:month
  //   isSaving — computed from mutation pending states
}
```

### Widget: `widgets/budget-section/`

`BudgetSection.vue` — new dashboard widget.

**States:**
1. **Loading** — skeleton (matching BalanceCard skeleton style)
2. **Empty** — minimal inline card: icon + "Нет бюджета на месяц" + "Установить лимит расходов" + chevron. Style matches GoalsSection/DebtsSection empty states.
3. **Active** — compact card:
   - Header: budget icon + "Бюджет на месяц" + "Изменить" link
   - Amount: spent / total (e.g., "320 000 из 500 000 сум")
   - Progress bar with smooth gradient using semantic tokens (`--color-success` → `--color-warning` → `--color-danger`)
   - Footer: "Потрачено 64%" left, "Осталось 180 000" right (success color)
4. **Overspent** — same layout, progress bar full danger, remaining shows negative in danger color

### Feature: `features/set-budget/`

Bottom sheet modal (consistent with TransactionForm pattern) for setting/editing budget amount.

- Single numeric input field (currency format with spaces)
- "Сохранить" button (disabled while `isSaving`)
- When editing existing override: shows "Сбросить к дефолту" secondary action

### Dashboard Integration

Register `BudgetSection` as a new dashboard widget:

1. **`shared/api/database.types.ts`** — add `'budget'` to `WidgetId` union type
2. **`shared/config/dashboard.ts`** — add `'budget'` to `DEFAULT_WIDGET_ORDER`, `WIDGET_LABELS` (`'Бюджет'`), and `WIDGET_ICONS`
3. **`DashboardPage.vue`** — add `v-if="widgetId === 'budget'"` block in the widget loop, render `<BudgetSection />`
4. **`DashboardSettingsPage.vue`** — will automatically render the new widget since it iterates `WidgetId`

User can reorder/hide via dashboard settings.

### Data Flow

1. `useBudget(userId)` fetches `GET /api/budgets/current`
2. Widget displays plan vs actual
3. On "Установить" / "Изменить" → open bottom sheet
4. Bottom sheet calls `setDefault(amount)` or `setOverride(year, month, amount)`
5. On success → invalidate budget query keys
6. `spent` comes from backend (which uses `getMonthlyStats` + exchange rates internally) — no separate stats call from frontend

### Cache Invalidation

- Budget mutations → invalidate `budgetQueryKeys.all` (prefix sweep)
- Transaction create/delete → also invalidate `budgetQueryKeys.all` (since spent amount changes)
  - Add `queryClient.invalidateQueries({ queryKey: budgetQueryKeys.all })` to existing `invalidateTransactionRelated()` in `shared/api/invalidation.ts`

## Database Migration

```sql
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER,
  month INTEGER,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- One default budget per user (NULL year/month)
CREATE UNIQUE INDEX uq_budgets_user_default
  ON budgets(user_id) WHERE is_default = true;

-- One override per (user, year, month)
CREATE UNIQUE INDEX uq_budgets_user_year_month
  ON budgets(user_id, year, month) WHERE is_default = false;

CREATE INDEX idx_budgets_user_id ON budgets(user_id);
```

## Out of Scope (v1)

- Per-category expense limits
- Income budget/planning
- Notifications when approaching limit
- Budget sharing between users
- Weekly/daily budget breakdown
- Forecasting/predictions based on history
- Querying arbitrary past month detail (use history endpoint)
