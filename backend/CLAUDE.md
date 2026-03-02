# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
bun run build          # Compile TypeScript
bun run start:dev      # Development with watch mode
bun run start:debug    # Debug mode with watch
bun run start:prod     # Production mode
bun run lint           # ESLint with auto-fix
bun run format         # Prettier formatting
bun run test           # Run Jest tests
bun run test:watch     # Tests in watch mode
bun run test:e2e       # E2E tests
bun install            # Install dependencies
```

## Architecture Overview

This is a **personal finance management backend** built with NestJS using **Domain-Driven Design (DDD)** architecture with **CQRS** pattern.

### Tech Stack
- NestJS 11, TypeORM 0.3.28, PostgreSQL
- @nestjs/cqrs for Command/Query separation
- JWT + Passport for authentication

### Bounded Contexts (src/modules/)

| Context | Entities | Purpose |
|---------|----------|---------|
| **identity** | Profile | Auth, user profiles, JWT tokens |
| **accounting** | Account, Transaction, Category | Core financial operations |
| **debt** | Debt | Debt tracking with payments |
| **planning** | Goal, Reminder | Financial goals and reminders |
| **exchange** | ExchangeRate | Currency conversion |
| **subscription** | UserSubscription | Premium plans, LemonSqueezy payments |
| **person** | Person | Shared contacts for debts |

### Module Structure (each bounded context follows this pattern)

```
modules/<context>/
├── domain/
│   ├── aggregates/      # Aggregate roots with business logic
│   ├── value-objects/   # Immutable value types
│   ├── events/          # Domain events
│   └── repositories/    # Repository interfaces (IXxxRepository)
├── application/
│   ├── commands/        # Write operations (CQRS)
│   └── queries/         # Read operations (CQRS)
├── infrastructure/
│   └── persistence/
│       ├── typeorm/     # ORM entities (*OrmEntity)
│       ├── repositories/# Repository implementations
│       └── mappers/     # Domain ↔ ORM conversion
└── presentation/
    ├── controllers/     # REST endpoints
    └── dto/             # Request/Response DTOs
```

### Shared Kernel (src/shared/)

Base classes for DDD building blocks:
- `AggregateRoot<TId>` - Base for aggregates, extends NestJS AggregateRoot
- `Entity<TId>` - Base entity with ID equality
- `ValueObject<T>` - Immutable value objects
- `DomainEvent` - Base domain event
- `DomainEventPublisher` - Publishes events to NestJS EventBus

### Key Patterns

**Repository Pattern**: Interfaces in `domain/repositories/`, implementations in `infrastructure/persistence/repositories/`. Injected via tokens:
```typescript
@Inject(ACCOUNT_REPOSITORY) private readonly accountRepository: IAccountRepository
```

**CQRS**: Commands modify state, Queries read data. Both use CommandBus/QueryBus from @nestjs/cqrs.

**Domain Events**: Aggregates raise events via `addDomainEvent()`. Events are published after repository save via `DomainEventPublisher.publishEvents()`.

### API Routes

All routes prefixed with `/api` (configured in main.ts):
- `/api/auth/*` - Authentication
- `/api/profiles/*` - User profiles
- `/api/accounts/*` - Financial accounts
- `/api/transactions/*` - Transactions
- `/api/categories/*` - Categories
- `/api/debts/*` - Debts
- `/api/goals/*` - Goals
- `/api/reminders/*` - Reminders
- `/api/exchange-rates/*` - Exchange rates
- `/api/subscription/*` - Subscription & premium
- `/api/quick-actions/*` - Quick actions

### TypeScript Configuration

`isolatedModules: false` is required due to interface usage with @Inject decorators in CQRS handlers.
