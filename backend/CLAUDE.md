# CLAUDE.md — backend

NestJS backend built with Domain-Driven Design and CQRS. Bounded contexts live in `src/modules/` (read the directory for the current list); each one follows the same shape: `domain/` → `application/` (commands + queries) → `infrastructure/` (TypeORM entities, repositories, mappers) → `presentation/` (controllers, DTOs).

All REST routes are prefixed with `/api` (set in `main.ts`).

## Key patterns

**Repository pattern** — interfaces in `domain/repositories/`, implementations in `infrastructure/persistence/repositories/`. Inject by token, never by class:

```typescript
@Inject(ACCOUNT_REPOSITORY) private readonly accountRepository: IAccountRepository
```

**CQRS** — commands modify state, queries read it. Both go through `CommandBus`/`QueryBus` from `@nestjs/cqrs`.

**Domain events** — aggregates raise them via `addDomainEvent()`, but they are published only *after* the repository save, by `DomainEventPublisher.publishEvents()`. Raising an event does not publish it.

**Mappers** in `infrastructure/persistence/mappers/` convert domain ↔ ORM entities. Domain aggregates never reach controllers directly.

**Shared kernel** (`src/shared/`) — DDD base classes: `AggregateRoot<TId>`, `Entity<TId>`, `ValueObject<T>`, `DomainEvent`, `DomainEventPublisher`.

## Adding a Command

1. `<name>.command.ts` → `<name>.handler.ts` with `@CommandHandler()`
2. Export from `application/commands/index.ts` and register the handler in the module's `providers`
3. Inject `CommandBus` in the controller and `execute()` it

Skipping step 2 fails at runtime, not at compile time.

## Gotchas

- **New TypeORM entities must be registered in TWO places**: `src/config/data-source.ts` (for CLI migrations) AND the `entities` array of `TypeOrmModule.forRootAsync` in `src/app.module.ts` (for the NestJS runtime). Missing either produces "No metadata for X was found"
- **`isolatedModules: false`** is required in tsconfig — CQRS handlers inject interfaces via `@Inject`, which breaks under `isolatedModules: true`
- **QueryBuilder takes entity property names, not column names**: `d.userId`, `d.isClosed` — NOT `d.user_id`, `d.is_closed`. TypeORM maps columns from the decorators
- **`synchronize: false`** — every schema change goes through a migration
- **Env vars**: `.env.example` is the source of truth. `PUBLIC_APP_URL` is the base for public receipt links `/r/<token>` and defaults to `CORS_ORIGIN` in production
- **Receipt OG images** use `@resvg/resvg-js` with fonts bundled in `assets/fonts` — they are not available from the system font stack in the container
