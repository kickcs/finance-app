# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun dev         # Start Vite dev server (or: bun dev)
bun build       # Type-check with vue-tsc, then build with Vite
bun preview     # Preview production build
```

## Architecture

This is a personal finance app built with **Feature-Sliced Design (FSD)** architecture:

```
src/
├── app/           # App initialization, router, global styles
├── pages/         # Route pages (compose widgets/features)
├── widgets/       # Large self-contained UI blocks
├── features/      # User interactions and actions
├── entities/      # Business entities (Account, Transaction, etc.)
└── shared/        # Reusable code: UI kit, utilities, hooks, API
```

### FSD Import Rules
Layers can only import from layers below them:
- `pages` → `widgets` → `features` → `entities` → `shared`
- Never import from the same or higher layer

### Path Aliases
```typescript
@/         → src/
@/app/     → src/app/
@/pages/   → src/pages/
@/widgets/ → src/widgets/
@/features/→ src/features/
@/entities/→ src/entities/
@/shared/  → src/shared/
```

## Key Patterns

### Entity Structure
Each entity follows this structure:
```
entities/account/
├── api/
│   ├── queryKeys.ts      # TanStack Query keys for this entity
│   ├── accountsApi.ts    # Supabase API service
│   ├── useAccounts.ts    # Vue Query composable
│   └── index.ts          # API barrel export
├── model/
│   └── types.ts          # TypeScript interfaces, constants
├── ui/
│   └── AccountCard.vue
└── index.ts              # Public API exports
```

### Feature Structure
Features contain business logic and UI for user actions:
```
features/create-account/
├── model/
│   └── useCreateAccount.ts  # Composable with state/logic
├── ui/
│   ├── AccountForm.vue
│   └── IconSelector.vue
└── index.ts
```

### Shared UI Kit
Import from `@/shared/ui`:
- `UButton` - variants: primary, secondary, ghost, icon
- `UInput` - variants: default, search, glass, currency
- `UCard` - variants: default, glass
- `UProgressBar` - with gradient support
- `UIcon` - Material Symbols wrapper
- `UTabs` - pill-style tabs (uses `items` prop with `id` field)
- `UModal` - modal dialog component

### Utilities
- `@/shared/lib/format/currency.ts` - `formatCurrency(amount, currencyCode)`
- `@/shared/lib/format/date.ts` - `formatDate(timestamp, options)`

## Tech Stack

- **Vue 3.5+** with `<script setup lang="ts">` Composition API
- **TanStack Query (Vue Query)** for server state management, caching, and mutations
- **Tailwind CSS v4** with `@tailwindcss/vite` plugin (uses `@import "tailwindcss"` and `@theme {}`)
- **Supabase** for backend (PostgreSQL + Auth + Realtime)
- **Vue Router 4** with navigation guards for onboarding flow

## Supabase Setup

### Environment Variables
Configure in `.env.local`:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Client
Import from `@/shared/api`:
```typescript
import { supabase } from '@/shared/api'
```

### Entity Composables (TanStack Query)
Each entity has its own composable with CRUD + realtime:
```typescript
// Import from entity directly (recommended)
import { useAccounts, accountQueryKeys } from '@/entities/account'
import { useTransactions, transactionQueryKeys } from '@/entities/transaction'
import { useGoals, goalQueryKeys } from '@/entities/goal'
import { useDebts, debtQueryKeys } from '@/entities/debt'
import { useReminders, reminderQueryKeys } from '@/entities/reminder'

// Or import from shared/api for backward compatibility
import { useAccounts, useTransactions } from '@/shared/api'
```

### Auth & Profile (in shared)
```typescript
import { useAuth, useProfile, useExchangeRates } from '@/shared/api'

const { user, isAuthenticated, signIn, signOut } = useAuth()
const { profile, setCurrency, completeOnboarding } = useProfile(userId)
const { rates, convert } = useExchangeRates()
```

### Example Usage
```typescript
import { useAccounts } from '@/entities/account'
import { useAuth } from '@/shared/api'

const { user } = useAuth()
const { accounts, createAccount, totalBalance, isLoading } = useAccounts(user.value?.id ?? null)
```

### Query Cache Invalidation
```typescript
import { queryClient } from '@/shared/api'
import { accountQueryKeys } from '@/entities/account'

// Invalidate accounts cache
queryClient.invalidateQueries({ queryKey: accountQueryKeys.list(userId) })
```

### Database Types
TypeScript types generated from Supabase schema in `@/shared/api/database.types.ts`:
- `Profile`, `Account`, `Transaction`, `Goal`, `Debt`, `Reminder`, `Settings`
- Insert types: `AccountInsert`, `TransactionInsert`, etc.

## Database Schema

Tables in Supabase (PostgreSQL):
- `profiles` - user profiles with currency preference
- `accounts` - bank accounts/wallets with balance
- `transactions` - income/expense records
- `goals` - savings goals with progress
- `debts` - debt tracking with payments
- `reminders` - recurring payment reminders
- `settings` - user preferences (theme, language)

All tables have Row Level Security (RLS) enabled - users can only access their own data.

## Design Tokens

Design system defined in `src/app/styles/index.css` using Tailwind v4 `@theme {}`:
- Primary color: `#3b82f6` (blue)
- Use semantic colors: `success`, `danger`, `warning`
- Category colors prefixed with `cat-` (e.g., `bg-cat-groceries`)

## Routing

### Navigation
```typescript
import { router, navigateBack } from '@/app/router'

// Use navigateBack() for slide-back animation (instead of router.back())
navigateBack()
```

### Route Meta Fields
- `requiresAuth: true` - Redirects to login if not authenticated
- `requiresOnboarding: true` - Redirects to onboarding if not completed
- `guestOnly: true` - For login page, redirects authenticated users

### Onboarding Flow
Router guards in `src/app/router/index.ts` manage onboarding:
1. New users → `/onboarding/first-account` (create first account with currency)
2. After account → Dashboard (sets `profile.has_completed_onboarding = true`)
