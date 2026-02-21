# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Root (runs both frontend and backend)
bun run dev              # Start both frontend and backend concurrently
bun run build            # Build both projects
bun run install:all      # Install dependencies in both projects

# Backend only (cd backend/)
bun run start:dev        # Development with watch mode
bun run build            # Build (verify before committing)
bun run test             # Run Jest tests
bun run test -- --testPathPattern=<pattern>  # Run a single test file
bun run test:cov         # Tests with coverage
bun run test:e2e         # E2E tests
bun run lint             # ESLint with auto-fix

# Frontend only (cd frontend/)
bun run dev              # Start Vite dev server
bun run build            # Type-check + production build (verify before committing)

# Database migrations (cd backend/)
bun run migration:generate src/database/migrations/<MigrationName>
bun run migration:run     # Apply pending migrations
bun run migration:revert  # Revert last migration

# Docker (local development)
docker compose up -d postgres  # Start only PostgreSQL
docker compose up -d           # Start all services
```

## CI/CD

GitHub Actions (`deploy.yml`): validate-backend (lint + test with PostgreSQL) + validate-frontend (type-check + build) → build Docker images → push to GHCR → deploy via SSH with migrations. Production uses `docker-compose.prod.yml`.

## Architecture Overview

**Personal finance management application** with Vue 3 frontend and NestJS backend.

### Backend (NestJS + DDD + CQRS)

- **Tech**: NestJS 11, TypeORM, PostgreSQL, JWT + Passport, @nestjs/cqrs
- **Bounded Contexts** (`backend/src/modules/`): `identity` (auth, profiles), `accounting` (accounts, transactions, categories), `debt`, `planning` (goals, reminders), `exchange` (currency conversion)

**Module Structure**: `domain/` → `application/` (commands + queries) → `infrastructure/` (TypeORM, mappers) → `presentation/` (controllers, DTOs)

**Key Patterns**:
- Repository interfaces in `domain/repositories/`, implementations in `infrastructure/persistence/repositories/`
- Inject via tokens: `@Inject(ACCOUNT_REPOSITORY)`
- Domain events via `addDomainEvent()`, published after save via `DomainEventPublisher`
- Mappers in `infrastructure/persistence/mappers/` convert domain ↔ ORM entities
- **API Routes**: All prefixed with `/api`

**Creating a new Command**:
1. `<name>.command.ts` → `<name>.handler.ts` with `@CommandHandler()`
2. Export from `application/commands/index.ts`, register in module `providers`
3. Inject `CommandBus` in controller and execute

### Frontend (Vue 3 + FSD)

- **Tech**: Vue 3, TypeScript, TanStack Vue Query, Tailwind CSS v4, Reka UI, Vue Router, PWA (vite-plugin-pwa)

**FSD Layers** (`frontend/src/`): `app/` → `pages/` → `widgets/` → `features/` → `entities/` → `shared/`

**API Layer Pattern** (each entity in `entities/<name>/api/`):
- `*Api.ts` — HTTP functions (transform backend camelCase → frontend snake_case)
- `use*.ts` — Vue Query composables with mutations and cache invalidation
- `queryKeys.ts` — query key factory; `model/types.ts` — TypeScript types

**Authentication**: JWT via `useAuth()`. Access token in localStorage, refresh token in httpOnly cookie. Auto-refresh on 401.

**Cursor Pagination**: `{ date, createdAt }` cursor format (camelCase from backend)

### Frontend UI Components (`shared/ui/`)

Custom component library wrapping Reka UI headless primitives (CVA-based variants). All exported from `shared/ui/index.ts`. Read component source for props — see `frontend/DESIGN_SYSTEM.md` for full docs.

**Core**: `UButton`, `UBadge`, `UInput` (variants: default/search/currency), `UCard`, `UModal`, `UTabs` (pills with sliding indicator / underline), `UIcon` (Material Symbol name → Lucide mapping via `shared/ui/icon/iconMap.ts`), `UProgressBar`, `USpinner`

**Composite**: `EmptyState` (default/inline), `SwipeableItem`, `PullToRefresh`, `Skeleton`/`SkeletonListItem`, `IconBadge`, `SectionHeader`, `ConfirmDeleteModal`, `UColorPicker`, `UIconSelector`, `NotFoundState`, `ViewAllButton`, `NavigationProgress`

**Toast System**: Source at `shared/lib/composables/useToast.ts`, re-exported via `shared/ui`. Call `toast({ title, description, variant, action?: {label, onClick} })`. `<Toaster />` placed in app root.

### Frontend Shared Utilities (`shared/lib/`)

- **Format** (`format/`): `formatCurrency`, `formatMasked`, `formatNumberWithSpaces`/`parseFormattedNumber`, `getCurrencySymbol`, `formatPercentage`, `formatDate` (ru-RU), `formatRelativeDate`, `formatDateGroup`, `formatLocalDate`
- **Date** (`date/`): `isToday`, `isPastDate`, `isFutureDate`, `getTodayISO`; timestamp boundaries in `format/date.ts`
- **Utils** (`utils.ts`): `cn()` (clsx + tailwind-merge — always use for dynamic classes), `cleanUndefined(obj)`
- **Transitions** (`transitions.ts`): `listTransition` preset for `<TransitionGroup>`
- **Haptics** (`haptics/`): `haptics.tap()`, `.success()`, `.error()`, `.warning()`, `.swipeThreshold()`, `.pullThreshold()` — Navigator Vibration API with graceful fallback
- **CSV** (`csv/`): `parseMoneyLoverCsv` — import parser for Money Lover format

### Frontend Composables

**Hooks** (`shared/lib/hooks/`):
`useCurrentUser`, `useLocalStorage`, `useAsyncOperation`, `useUserCurrency`, `usePullToRefresh`, `useSwipe`, `useSlidingIndicator`

**Composables** (`shared/lib/composables/`):
- `useToast()` — custom reactive toast store with haptics (re-exported via `shared/ui`)
- `usePwaUpdate()` — auto-detects SW updates, shows persistent toast with "Обновить" action

**API composables** (`shared/api/composables/`):
- `useAuth()` — singleton: signUp, signIn, signInAnonymously, signOut, refreshUser
- `useProfile(userId)` — profile CRUD, setCurrency, completeOnboarding, defaultAccountId
- `useExchangeRates(baseCurrency)` — convert, convertBetween, getRate. Cached 24h

**Cache invalidation** (`shared/api/invalidation.ts`): `invalidateTransactionRelated`, `invalidateAccountRelated`

### Frontend Entity API Composables

All accept `userId: MaybeRefOrGetter<string|null>`, auto-disable when falsy, include optimistic updates.

- `useAccounts` — accounts CRUD, totalBalancesByCurrency
- `useTransactions` — last 50, create/delete with balance update callback
- `useInfiniteTransactions(userId, filters?)` — cursor-paginated, PAGE_SIZE=20
- `useInfiniteAccountTransactions(userId, accountId)` — same, scoped to account
- `useRecentTransactions(userId, limit=5)` — read-only for dashboard
- `useMonthlyStats(userId, {year?, month?})` — income/expense by currency
- `useAnalyticsStats({startDate, endDate, accountIds?})` — totals + categoryBreakdown + by-currency
- `useDebts` — CRUD, totalDebt, debtsByPerson, makePayment
- `useGoals` — CRUD, totalSaved/Target, overallProgress
- `useReminders` — CRUD, active/upcoming/overdue filters
- `useCategories` — expense/income categories, reorder
- `useHashtags` — transaction hashtag suggestions

### Frontend Entities

`account`, `account-balance` (multi-currency balances), `category`, `currency`, `debt`, `goal`, `reminder`, `transaction`

**Key constants**: `EXPENSE_CATEGORIES` (12), `INCOME_CATEGORIES` (6), `DEBT_CATEGORIES` (4), `TRANSFER_CATEGORY` in `entities/category/model/constants.ts`. `CURRENCIES` (USD, EUR, RUB, UZS, GBP, CNY). `VISIBLE_ACCOUNT_TYPES` (basic, savings, credit_card). `ENTITY_COLORS` in `shared/config/colors.ts`.

**Entity UI**: `AccountCard`, `AccountSelector`, `TransactionItem`, `VirtualGroupedTransactionList` (@tanstack/vue-virtual — set `height` with `calc()`), `VirtualTransactionList` (flat non-grouped variant), `DebtCard`, `GoalCard`, `ReminderCard`, `CategoryCard`, `CategoryChips`, `CurrencyBadge`. `useGroupedTransactions()` for transaction grouping.

### Frontend Widgets (`widgets/`)

`AppHeader`, `BottomNav`, `BalanceCard`, `AccountStack`, `SaveSpendSection`, `RecentTransactions`, `DebtsSection`, `GoalsSection`, `RemindersSection`, `CurrencyList`. Analytics: `StatCard`, `DonutChart`, `DailyStatsCards`, `TopCategories`, `SavingsGauge`. Each widget with `loading` has a `*Skeleton.vue` companion.

### Frontend Features (`features/`)

`add-transaction` (HeroAmount, TransactionForm, panels), `analytics-filters` (FilterChips, DateRangePicker, ModeToggle), `changelog`, `close-debt`, `configure-quick-action`, `create-account`, `create-debt`, `create-reminder`, `demo-mode`, `edit-account`, `edit-profile`, `edit-reminder`, `edit-transaction`, `import-data`, `install-pwa`, `manage-categories`, `partial-payment`, `search-transactions` (SearchInput), `select-currency` (CurrencyItem), `split-expense`, `toggle-theme` (ThemeToggle)

### Page Layout Pattern

Standard pages: `min-h-screen bg-background-light dark:bg-background-dark pb-28` (pb-28 for BottomNav). Fixed-scroll pages: `h-dvh flex flex-col overflow-hidden` with `flex-1 overflow-y-auto` on scrollable section.

## Environment Variables

```bash
# Backend (.env) — copy from backend/.env.example
DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USERNAME, DATABASE_PASSWORD
JWT_SECRET, JWT_EXPIRES_IN, PORT

# Frontend (.env)
VITE_API_URL=http://localhost:3000
```

## Key Files

- `backend/src/shared/` — DDD base classes (AggregateRoot, Entity, ValueObject, DomainEvent)
- `backend/src/config/data-source.ts` — TypeORM data source + entity registration
- `frontend/src/app/router/index.ts` — routes with auth guards
- `frontend/src/shared/api/http.ts` — HTTP client with JWT management
- `frontend/src/shared/api/composables/useAuth.ts` — authentication logic
- `frontend/src/app/styles/index.css` — Tailwind v4 `@theme` block with design tokens
- `frontend/DESIGN_SYSTEM.md` — full design system docs (tokens, typography, components)
- `backend/CLAUDE.md`, `frontend/CLAUDE.md` — detailed sub-project docs

## Changelog

Update `frontend/src/features/changelog/model/changelogData.ts`:
- **Always bump minor version** (e.g. `1.3.0` → `1.4.0`). A PostToolUse hook (`.claude/hooks/check-changelog-version.sh`) blocks non-zero patch
- Add entry at **top** of `CHANGELOG_ENTRIES` array
- Descriptions **на русском**, простым языком для пользователей
- Types: `feature`, `fix`, `improvement`

## Common Gotchas

- **isolatedModules**: Backend requires `false` in tsconfig (interface usage with @Inject)
- **API field naming**: Backend camelCase → frontend snake_case. Transform in `*Api.ts` files
- **Profile fields**: When adding new fields, update `ProfileResponse` + all handlers (get-profile, update-profile, create-demo-user)
- **Icons**: `<UIcon name="material_symbol_name" />` — add new mappings to `shared/ui/icon/iconMap.ts`
- **Global state**: User auth via Vue `provide/inject` from `App.vue`
- **TypeORM**: `synchronize: false` — always use migrations. New entities must be registered in `backend/src/config/data-source.ts`
- **PullToRefresh**: Breaks flex chains — wrap in separate `flex-1 overflow-y-auto` div
- **Design tokens**: Always use semantic tokens (`bg-surface-light dark:bg-surface-dark`) not raw Tailwind colors. See `frontend/DESIGN_SYSTEM.md` § Anti-Patterns
- **Multi-currency**: Account balances stored in separate `account_balances` table
