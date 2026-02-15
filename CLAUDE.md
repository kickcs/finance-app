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

Custom component library wrapping Reka UI headless primitives:
- `UButton` — variants: `primary`, `secondary`, `ghost`, `icon`, `danger`, `outline`; sizes: `xs`, `sm`, `md`, `lg`, `xl`; props: `fullWidth`, `loading`, `disabled`
- `UInput` — variants: `default`, `search`, `currency`; sizes: `md`, `lg`; supports `icon`, `suffix`, `showPasswordToggle`
- `UCard` — variants: `default`, `bordered`, `flat`; padding: `none`, `sm`, `md`, `lg`; `hoverable`, `clickable`
- `UModal`, `UTabs`, `UIcon`, `Skeleton`, `SwipeableItem`, `EmptyState`, `PullToRefresh`, `Toast`

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

## Common Gotchas

- Backend requires `isolatedModules: false` in tsconfig due to interface usage with @Inject decorators
- Frontend uses multi-currency support via `account_balances` table
- **API field naming**: Backend returns camelCase, frontend transforms to snake_case - ensure consistency in cursor/pagination interfaces
- **Profile fields**: When adding new profile fields, update both `ProfileResponse` type and all handlers that return it (get-profile, update-profile, create-demo-user, etc.)
- **Material Symbols**: Uses `display=block` to prevent icon text flash (FOUT) - do not change to `swap`
- **Global state**: User auth provided via Vue `provide/inject` pattern from `App.vue`
- **TypeORM synchronize**: Disabled (`synchronize: false`) - always use migrations for schema changes, never enable synchronize
- **New ORM entities**: Must be registered in `backend/src/config/data-source.ts` entities array, otherwise migrations won't detect them
- **PullToRefresh**: Wraps content in two nested divs (relative container + transform content), which breaks flex layout chains. When using with `h-dvh` fixed layout, wrap PullToRefresh in a separate `flex-1 overflow-y-auto` div rather than making PullToRefresh itself flex
- **Tailwind v4**: Uses class-based dark mode strategy; theme tokens defined in `frontend/src/app/styles/` (background-light/dark, text-primary-light/dark, etc.)
