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
bun run start:debug      # Debug mode with watch
bun run build            # Build (verify before committing)
bun run test             # Run Jest tests
bun run test -- --testPathPattern=<pattern>  # Run a single test file
bun run test:cov         # Tests with coverage
bun run test:e2e         # E2E tests
bun run lint             # ESLint with auto-fix

# Frontend only (cd frontend/)
bun run dev              # Start Vite dev server
bun run build            # Type-check + production build (verify before committing)
bun run preview          # Preview production build

# Database migrations (cd backend/)
bun run migration:generate src/database/migrations/<MigrationName>  # Generate from entity changes
bun run migration:run     # Apply pending migrations
bun run migration:revert  # Revert last migration
bun run migration:show    # Show migration status

# Docker (local development)
docker compose up -d postgres  # Start only PostgreSQL
docker compose up -d           # Start all services (postgres, backend, frontend)
```

## CI/CD

GitHub Actions (`deploy.yml`) runs: validate (lint + test + type-check with PostgreSQL) → build Docker images → push to GHCR → deploy via SSH with migrations. Production uses `docker-compose.prod.yml`.

## Project Structure

```
finance-app/
├── backend/             # NestJS API (DDD + CQRS)
├── frontend/            # Vue 3 SPA (Feature-Sliced Design)
└── package.json         # Root scripts for unified dev experience
```

## Architecture Overview

**Personal finance management application** with Vue 3 frontend and NestJS backend.

### Backend (NestJS + DDD + CQRS)

- **Tech**: NestJS 11, TypeORM, PostgreSQL, JWT + Passport
- **Pattern**: Domain-Driven Design with CQRS via @nestjs/cqrs

**Bounded Contexts** (`backend/src/modules/`):
| Context | Purpose |
|---------|---------|
| identity | Auth, profiles, JWT tokens |
| accounting | Accounts, Transactions, Categories |
| debt | Debt tracking with payments |
| planning | Goals and Reminders |
| exchange | Currency conversion |

**Module Structure**:
```
modules/<context>/
├── domain/           # Aggregates, value-objects, events, repository interfaces
├── application/      # Commands (writes) and Queries (reads)
├── infrastructure/   # TypeORM entities, repository implementations, mappers
└── presentation/     # Controllers and DTOs
```

**Key Patterns**:
- Repository interfaces in `domain/repositories/`, implementations in `infrastructure/persistence/repositories/`
- Inject via tokens: `@Inject(ACCOUNT_REPOSITORY)`
- Domain events raised via `addDomainEvent()`, published after save via `DomainEventPublisher`
- Mappers in `infrastructure/persistence/mappers/` convert between domain aggregates and ORM entities

**Creating a new Command** (CQRS write operation):
1. Create `<name>.command.ts` with command class
2. Create `<name>.handler.ts` with `@CommandHandler()` decorator
3. Export from `application/commands/index.ts`
4. Register handler in module's `providers` array
5. Inject `CommandBus` in controller and execute

**API Routes**: All prefixed with `/api` (auth, profiles, accounts, transactions, categories, debts, goals, reminders, exchange-rates)

### Frontend (Vue 3 + FSD)

- **Tech**: Vue 3, TypeScript, TanStack Vue Query, Tailwind CSS v4, Reka UI, Vue Router

**FSD Layers** (`frontend/src/`):
```
app/        # Entry, router, global styles
pages/      # Route pages
widgets/    # Composite UI (header, bottom-nav)
features/   # User actions (create-account, add-transaction)
entities/   # Business entities with API layer (account, transaction, debt, etc.)
shared/     # UI components, HTTP client, hooks
```

**API Layer Pattern** (each entity in `entities/<name>/api/`):
- `*Api.ts` - HTTP functions (transform camelCase responses to snake_case)
- `use*.ts` - Vue Query composables with mutations and cache invalidation
- `queryKeys.ts` - Query key factory for cache management
- `model/types.ts` - TypeScript types

**Data Transformation**: Backend returns camelCase (NestJS), frontend uses snake_case internally. Transform in `*Api.ts` files.

**Authentication**: JWT-based via `useAuth()` composable. Access token in localStorage, refresh token in httpOnly cookie (set by backend). Auto-refresh on 401.

**Cursor Pagination**: Uses `{ date, createdAt }` cursor format (camelCase from backend)

### Frontend UI Components (`shared/ui/`)

Custom component library wrapping Reka UI headless primitives (CVA-based variants). All exported from `shared/ui/index.ts`.

**Core Components:**
- `UButton` — variants: `primary`, `secondary`, `ghost`, `icon`, `danger`, `outline`; sizes: `xs`, `sm`, `md`, `lg`, `xl`; props: `fullWidth`, `loading`, `disabled`. Heights: xs=h-7, sm=h-8, md=h-10, lg=h-11, xl=h-12. `icon` variant renders square button
- `UBadge` — variants: `primary`, `success`, `danger`, `warning`, `neutral`, `debt-given`, `debt-received`, `goal`, `reminder`; sizes: `xs`, `sm`, `md`; shapes: `rounded`, `pill`. Domain variants use semantic tokens
- `UInput` — variants: `default`, `search`, `currency`; sizes: `md`, `lg`; props: `icon`, `suffix`, `showPasswordToggle`, `label`, `error` (with shake animation). `currency` variant formats numbers with spaces and emits raw numeric string. Exposes `focus()` method
- `UCard` — variants: `default`, `bordered`, `flat`; padding: `none`, `sm`, `md`, `lg`; `hoverable`, `clickable` (adds `role="button"` + `tabindex`)
- `UModal` — props: `modelValue`, `title`, `closeable`; slots: `default` (body), `#actions` (footer). Auto scroll-lock
- `UTabs` — props: `items: {id, label}[]`, `modelValue`, `size: 'sm'|'md'`, `variant: 'pills'|'underline'`. `pills` has animated sliding indicator. Only renders tab bar — manage content via `v-if` on modelValue
- `UIcon` — props: `name` (Material Symbol name), `size: 'xs'|'sm'|'md'|'lg'|'xl'|'2xl'`, `filled`, `color`. Sizes: xs=12, sm=16, md=20, lg=24, xl=28, 2xl=32px. Maps via `shared/ui/icon/iconMap.ts`
- `UProgressBar` — props: `value`, `max`, `color` (named: `primary`/`success`/`danger`/`warning` or hex), `size`, `showLabel`

**Composite Components:**
- `EmptyState` — props: `icon`, `title`, `description`, `variant: 'default'|'inline'`, `action: {label, onClick}`. `inline` variant has dashed border — use inside cards/lists
- `SwipeableItem` — props: `leftAction`, `rightAction` (`{icon, color, label}`), `disabled`. Emits: `action-left`, `action-right`. Exposes `resetSwipe()`
- `PullToRefresh` — props: `onRefresh: () => Promise<void>`. **Important:** breaks flex chains, wrap in separate `flex-1 overflow-y-auto` div
- `Skeleton` / `SkeletonListItem` — `Skeleton`: `class` for shape, `variant: 'shimmer'|'pulse'`. `SkeletonListItem`: `showTrailing`, `avatarClass`
- `IconBadge` — props: `icon`, `size`, `color` (hex — auto-generates `bg: color+'15'`), `bgClass`, `iconClass`
- `SectionHeader` — props: `title`, `count`, `showAdd`, `showViewAll`, `viewAllText`, `badgeVariant`. Emits: `add-click`, `view-all`
- `ConfirmDeleteModal` — props: `modelValue`, `title`, `warningText`, `confirmLabel`, `isDeleting`, `error`. Emits: `confirm`, `cancel`
- `UColorPicker` — props: `modelValue`, `colors: string[]`, `label`. Grid of color swatches
- `UIconSelector` — props: `modelValue`, `icons: string[]`, `color`, `label`, `maxHeight`
- `NotFoundState` — full-page 404 with `message`, `icon`, `actionLabel`, `actionRoute` (named route)
- `ViewAllButton` — full-width text button with chevron. Props: `label`. Emits: `click`

**Toast System:** `import { useToast } from '@/shared/ui'`. Call `toast({ title, description, variant })`. Add `<Toaster />` to app root once.

### Frontend Shared Utilities (`shared/lib/`)

**Format utilities** (`shared/lib/format/`):
- `formatCurrency(amount, code, {showSymbol?, compact?, showSign?})` — `formatMasked(amount, code, hidden)` returns `••••` when hidden
- `formatNumberWithSpaces(value)` / `parseFormattedNumber(value)` — for input display (`1 000 000`)
- `getCurrencySymbol(code)` — `'UZS'` → `'сўм'`
- `formatPercentage(value, decimals?, showSign?)` — `COMPACT_FORMAT` reusable option
- `formatDate(timestamp, {format: 'full'|'short'|'relative'|'time'})` — default locale `ru-RU`
- `formatRelativeDate(date)` — `'Сегодня'`, `'Вчера'`, `'3 дн. назад'`
- `formatDateGroup(timestamp)` — for grouping headers: `"19 февраля"` or `"19 февраля 2025"`

**Utility functions** (`shared/lib/utils.ts`):
- `cn(...inputs)` — `clsx` + `tailwind-merge`. Always use for dynamic class composition
- `cleanUndefined(obj)` — strips undefined/null/empty string for API payloads

**Transitions** (`shared/lib/transitions.ts`):
- `listTransition` — preset for `<TransitionGroup v-bind="listTransition">` with 150ms fade+translate

### Frontend Shared Composables (`shared/lib/hooks/`)

- `useCurrentUser()` → `{ user: Ref<User|null>, userId: ComputedRef<string> }`. Injected from `App.vue`
- `useLocalStorage<T>(key, default)` → `Ref<T>`. Reactive localStorage with auto-persist
- `useAsyncOperation(asyncFn, {errorMessage?})` → `{ isLoading, error, execute }`. Returns `false` on failure
- `useUserCurrency()` → `{ currency: ComputedRef<string> }`. Reads from profile → localStorage → `'UZS'`

### Frontend Shared API Composables (`shared/api/composables/`)

- `useAuth()` → singleton: `{ user, isAuthenticated, isAnonymous, signUp, signIn, signInAnonymously, signOut, refreshUser }`
- `useProfile(userId)` → `{ profile, updateProfile, setCurrency, completeOnboarding, defaultAccountId, setDefaultAccount }`
- `useExchangeRates(baseCurrency)` → `{ rates, convert(amount, from), convertBetween(amount, from, to), getRate(target) }`. Cached 24h

**Cache invalidation helpers** (`shared/api/invalidation.ts`):
- `invalidateTransactionRelated(queryClient, userId)` — clears all transaction-related caches
- `invalidateAccountRelated(queryClient, userId)` — clears all account-related caches

### Frontend Entity API Composables

All accept `userId: MaybeRefOrGetter<string|null>`, auto-disable when falsy, include optimistic updates.

- **`useAccounts(userId)`** → `{ accounts, totalBalancesByCurrency, createAccount, createAccountWithBalances, updateAccount, deleteAccount, getAccountById }`
- **`useTransactions(userId)`** → `{ transactions (last 50), createTransaction(tx, updateBalanceFn), deleteTransaction(id, updateBalanceFn), getMonthlySummary, getCategoryBreakdown }`
- **`useInfiniteTransactions(userId, filters?)`** → `{ transactions (flattened), totalCount, fetchNextPage, hasNextPage, isFetchingNextPage, prependTransaction, removeTransaction }`. PAGE_SIZE=20
- **`useInfiniteAccountTransactions(userId, accountId)`** — same as above, scoped to one account
- **`useRecentTransactions(userId, limit=5)`** → `{ transactions, isLoading }` — read-only for dashboard
- **`useMonthlyStats(userId, {year?, month?})`** → `{ totalIncome, totalExpense, incomeByCurrency, expenseByCurrency }`. Month is 1-12
- **`useAnalyticsStats({startDate, endDate, accountIds?})`** → `{ totalIncome, totalExpense, categoryBreakdown }`
- **`useDebts(userId)`** → `{ debts, totalDebt, totalPaid, overallProgress, debtsByPerson, createDebt, makePayment, deleteDebt }`
- **`useGoals(userId)`** → `{ goals, totalSaved, totalTarget, overallProgress, createGoal, addToGoal, deleteGoal }`
- **`useReminders(userId)`** → `{ reminders, activeReminders, upcomingReminders, overdueReminders, createReminder, toggleReminder, completeReminder, deleteReminder }`
- **`useCategories(userId)`** → `{ categories, expenseCategories, incomeCategories, allCategories, getCategoryById, createCategory, reorderCategories }`

### Frontend Entity Constants

- **Categories** (`entities/category/model/constants.ts`): `EXPENSE_CATEGORIES` (12), `INCOME_CATEGORIES` (6), `DEBT_CATEGORIES` (4), `TRANSFER_CATEGORY`, `ALL_CATEGORIES`, `getCategoryById(id)`
- **Currencies** (`entities/currency/model/constants.ts`): `CURRENCIES` array (USD, EUR, RUB, UZS, GBP, CNY), `getCurrencyByCode(code)` → `{code, name, symbol, flag}`
- **Account Types** (`entities/account/model/account-types.ts`): `ACCOUNT_TYPES`, `VISIBLE_ACCOUNT_TYPES` (basic, savings, credit_card), `ACCOUNT_TYPE_LABELS`, `getAccountTypeLabel(type)`
- **Colors** (`shared/config/colors.ts`): `ENTITY_COLORS` — standard palette for color pickers
- **Transaction grouping** (`entities/transaction/model/useGroupedTransactions.ts`): `useGroupedTransactions(transactions, options?)` → `ComputedRef<TransactionGroup[]>` for `VirtualGroupedTransactionList`

### Frontend Entity UI Components

- **`AccountCard`** (`entities/account/ui/`) — props: `account`, `showBalance`, `compact`, `hidden`. Multi-currency shows up to 2 balances + "+N ещё"
- **`TransactionItem`** (`entities/transaction/ui/`) — props: `transaction`, `currency`, `accountName`, `toAccountName`, `viewingAccountId` (controls transfer direction display)
- **`VirtualGroupedTransactionList`** (`entities/transaction/ui/`) — virtualized list via `@tanstack/vue-virtual`. Props: `groups`, `currency`, `hasNextPage`, `isFetchingNextPage`, `getAccountName`, `height` (must set correctly with `calc()`), `swipeEnabled`. Emits: `loadMore`, `transactionClick`, `transactionEdit`, `transactionDelete`

### Frontend Widget Components (`widgets/`)

- **`AppHeader`** — props: `title`, `showBack`, `showNotifications`, `transparent`, `blur`. Slots: `#left`, `#logo`, `#actions`. Sticky with safe-area padding
- **`BalanceCard`** — props: `totalBalance`, `currency`, `percentChange`, `loading`, `hidden`. Dashboard hero with trend indicator
- **`AccountStack`** — props: `accounts`, `loading`, `hidden`. Displays accounts list with SectionHeader and EmptyState
- **`SaveSpendSection`** — props: `savedAmount`, `spentAmount`, `currency`, `period`, `loading`, `hidden`. Side-by-side income/expense cards
- **`RecentTransactions`** — props: `transactions`, `userId`, `loading`, `hidden`. Self-fetches account names
- **`StatCard`** (`widgets/analytics/ui/`) — props: `icon`, `label`, `value`, `loading`, `color`. Analytics metric card

### Reusable Feature Components

- **`FilterChips`** (`features/analytics-filters/ui/`) — props: `items: {id, name, icon?, color?}[]`, `selectedIds`, `label`. Horizontal scrollable multi-select pills
- **`AccountSelector`** (`features/add-transaction/ui/`) — props: `accounts`, `selectedId`, `label`, `activeColor`. Horizontal scrollable account chips
- **`AmountInput`** (`features/add-transaction/ui/`) — props: `amount`, `currency`, `currencySymbol`, `availableCurrencies`, `isMultiCurrency`, `label`, `autofocus`. Large currency input with optional currency selector
- **`ThemeToggle`** (`features/toggle-theme/ui/`) — props: `showLabel`. Ghost button toggling dark/light mode
- **`CurrencyItem`** (`features/select-currency/ui/`) — props: `currency`, `selected`. Full-row currency option with flag

Full design system documentation (tokens, typography, spacing, components, patterns): see `frontend/DESIGN_SYSTEM.md`

### Page Layout Pattern

Most pages use `min-h-screen bg-background-light dark:bg-background-dark pb-28` (pb-28 reserves space for fixed BottomNav). Pages with fixed-scroll layout use `h-dvh flex flex-col overflow-hidden` with `flex-1 overflow-y-auto` on the scrollable section (see HistoryPage, CategoriesPage).

## Environment Variables

```bash
# Backend (.env) - copy from backend/.env.example
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=my_finance
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
PORT=3000

# Frontend (.env)
VITE_API_URL=http://localhost:3000
```

## Key Files

**Backend**:
- `backend/src/shared/` - DDD base classes (AggregateRoot, Entity, ValueObject, DomainEvent)

**Frontend**:
- `frontend/src/app/router/index.ts` - Routes with auth guards
- `frontend/src/shared/api/http.ts` - HTTP client with JWT management
- `frontend/src/shared/api/composables/useAuth.ts` - Authentication logic

## Sub-project Documentation

Both `backend/CLAUDE.md` and `frontend/CLAUDE.md` contain more detailed architecture docs for their respective projects.

## Changelog

When adding user-facing features, fixes, or improvements, update `frontend/src/features/changelog/model/changelogData.ts`:
- **Always bump minor version** (e.g. `1.3.0` → `1.4.0`) unless the user explicitly requests a patch or major bump. A PostToolUse hook (`.claude/hooks/check-changelog-version.sh`) enforces this — it blocks edits with non-zero patch
- Add a new entry at the **top** of `CHANGELOG_ENTRIES` array
- Write descriptions **на русском**, простым языком для обычных пользователей (не разработчиков). Например: «Добавлен учёт долгов» вместо «Implement debt tracking module with CQRS handlers»
- Each item has a `type`: `feature` (новая функция), `fix` (исправление), `improvement` (улучшение)

## Common Gotchas

- Backend requires `isolatedModules: false` in tsconfig due to interface usage with @Inject decorators
- Frontend uses multi-currency support via `account_balances` table
- **API field naming**: Backend returns camelCase, frontend transforms to snake_case - ensure consistency in cursor/pagination interfaces
- **Profile fields**: When adding new profile fields, update both `ProfileResponse` type and all handlers that return it (get-profile, update-profile, create-demo-user, etc.)
- **Icons (Lucide)**: All icons use `lucide-vue-next` via `<UIcon name="material_symbol_name" />`. When adding a new icon, add its Material Symbol → Lucide mapping to `frontend/src/shared/ui/icon/iconMap.ts`
- **Global state**: User auth provided via Vue `provide/inject` pattern from `App.vue`
- **TypeORM synchronize**: Disabled (`synchronize: false`) - always use migrations for schema changes, never enable synchronize
- **New ORM entities**: Must be registered in `backend/src/config/data-source.ts` entities array, otherwise migrations won't detect them
- **PullToRefresh**: Wraps content in two nested divs (relative container + transform content), which breaks flex layout chains. When using with `h-dvh` fixed layout, wrap PullToRefresh in a separate `flex-1 overflow-y-auto` div rather than making PullToRefresh itself flex
- **Tailwind v4**: Uses class-based dark mode strategy; theme tokens defined in `frontend/src/app/styles/index.css` (`@theme` block)
- **Design tokens**: Always use semantic tokens instead of raw Tailwind colors. Use `bg-surface-light dark:bg-surface-dark` not `bg-gray-100 dark:bg-gray-800`. Use `text-caption-sm` not `text-[10px]`. Use domain tokens (`debt-given`, `reminder`, `goal`) not `amber-500`/`purple-500`. See `frontend/DESIGN_SYSTEM.md` § Anti-Patterns
