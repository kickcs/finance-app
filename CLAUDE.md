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
bun run test:e2e         # E2E tests
bun run lint             # ESLint with auto-fix

# Frontend only (cd frontend/)
bun run dev              # Start Vite dev server
bun run build            # Type-check + production build (verify before committing)
bun run preview          # Preview production build
```

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

**Authentication**: JWT-based via `useAuth()` composable, tokens in localStorage, auto-refresh on 401

**Cursor Pagination**: Uses `{ date, createdAt }` cursor format (camelCase from backend)

## Environment Variables

```bash
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

## Common Gotchas

- Backend requires `isolatedModules: false` in tsconfig due to interface usage with @Inject decorators
- Frontend uses multi-currency support via `account_balances` table
- **API field naming**: Backend returns camelCase, frontend transforms to snake_case - ensure consistency in cursor/pagination interfaces
- **Profile fields**: When adding new profile fields, update both `ProfileResponse` type and all handlers that return it (get-profile, update-profile, create-demo-user, etc.)
- **Material Symbols**: Uses `display=block` to prevent icon text flash (FOUT) - do not change to `swap`
- **Global state**: User auth provided via Vue `provide/inject` pattern from `App.vue`
