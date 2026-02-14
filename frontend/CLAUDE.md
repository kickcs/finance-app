# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
bun run dev          # Start dev server (Vite)
bun run build        # Type-check (vue-tsc) + build for production
bun run preview      # Preview production build locally
```

## Architecture Overview

This is a **Vue 3 personal finance app** using Feature-Sliced Design (FSD) architecture with NestJS REST API backend.

### Tech Stack
- **Vue 3** (Composition API, `<script setup>`)
- **TypeScript**
- **TanStack Vue Query** - server state management with caching and invalidation
- **NestJS Backend** - REST API with JWT authentication
- **Tailwind CSS v4** - styling
- **Reka UI** - headless UI components
- **Vue Router** - routing with auth guards

### FSD Layer Structure

```
src/
├── app/              # App entry, router, global styles
├── pages/            # Route pages (LoginPage, DashboardPage, etc.)
├── widgets/          # Composite UI blocks (header, bottom-nav)
├── features/         # User actions (create-account, add-transaction, toggle-theme)
├── entities/         # Business entities with API layer
│   ├── account/      # accounts + account_balances
│   ├── transaction/
│   ├── debt/
│   ├── reminder/
│   ├── goal/
│   ├── category/
│   └── currency/
└── shared/           # Shared utilities, UI components, API client
    ├── api/          # HTTP client, query keys, services
    ├── ui/           # Button, Input, Card, Modal, Icon
    └── lib/          # Hooks, formatters
```

### API Layer Pattern

Each entity follows this structure:
- `*Api.ts` - HTTP API functions (e.g., `accountsApi.getAll()`)
- `use*.ts` - Vue Query composables with mutations and invalidation (e.g., `useAccounts()`)
- `queryKeys.ts` - Query key factory for caching
- `model/types.ts` - TypeScript types

Example usage:
```typescript
const { data: accounts, isLoading } = useAccounts().list(userId)
const { mutate: createAccount } = useAccounts().create()
```

### Authentication Flow

- `useAuth()` composable handles JWT-based authentication (email/password, anonymous)
- Tokens stored in localStorage (`access_token`, `refresh_token`)
- HTTP client (`http.ts`) auto-refreshes tokens on 401 responses
- Router guards check `requiresAuth` and `requiresOnboarding` route meta
- Demo mode with expiry for anonymous users
- Profile fetched via `/auth/me` endpoint

### Multi-Currency Support

- Accounts can have multiple currency balances via `account_balances` table
- Exchange rates API for currency conversion
- `useExchangeRates()` composable for conversion
- User's preferred currency stored in profile

### Environment Variables

```
VITE_API_URL=<backend-url>  # e.g., http://localhost:3000
```

## Key Files

- `src/app/router/index.ts` - All routes with auth guards
- `src/shared/api/http.ts` - HTTP client with JWT token management
- `src/shared/api/composables/useAuth.ts` - Authentication logic
- `src/shared/api/database.types.ts` - TypeScript types for entities
