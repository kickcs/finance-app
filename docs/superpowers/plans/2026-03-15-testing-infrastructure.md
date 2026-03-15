# Testing Infrastructure Setup Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up frontend testing infrastructure (Vitest + MSW + test utilities) and add test step to CI/CD pipeline.

**Architecture:** Vitest extends existing Vite config via `mergeConfig` for alias resolution. MSW v2 intercepts fetch at network level. `renderWithProviders()` helper wraps components with Vue Router, TanStack Query, and auth context. A smoke test validates the entire setup works end-to-end.

**Tech Stack:** Vitest, @vue/test-utils, jsdom, MSW v2, @tanstack/vue-query, vue-router

**Spec:** `docs/superpowers/specs/2026-03-15-testing-strategy-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `frontend/vitest.config.ts` | Vitest config extending Vite config |
| Create | `frontend/src/test/setup.ts` | MSW lifecycle hooks (beforeAll/afterEach/afterAll) |
| Create | `frontend/src/test/mocks/server.ts` | MSW `setupServer()` |
| Create | `frontend/src/test/mocks/handlers.ts` | Default MSW handlers (empty, extensible) |
| Create | `frontend/src/test/test-utils.ts` | `renderWithProviders()`, `createTestRouter()` |
| Create | `frontend/src/shared/lib/format/currency.spec.ts` | Smoke test — verifies setup works |
| Modify | `frontend/package.json` | Add `test` and `test:watch` scripts |
| Modify | `frontend/tsconfig.json` | Add `vitest/globals` to types |
| Modify | `.github/workflows/deploy.yml:185-191` | Add frontend test step before build |

---

## Chunk 1: Install Dependencies and Configure Vitest

### Task 1: Install test dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install Vitest, Vue Test Utils, jsdom, MSW**

```bash
cd frontend && bun add -d vitest @vue/test-utils jsdom msw
```

- [ ] **Step 2: Verify installation**

```bash
cd frontend && bun run vitest --version
```

Expected: Vitest version printed (e.g., `vitest/3.x.x`)

- [ ] **Step 3: Add test scripts to package.json**

In `frontend/package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

### Task 2: Create Vitest config

**Files:**
- Create: `frontend/vitest.config.ts`

- [ ] **Step 1: Create vitest.config.ts**

```typescript
// frontend/vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      passWithNoTests: true,
    },
  }),
)
```

This inherits all Vite aliases (`@/*`, `@/shared/*`, etc.) and plugins automatically.

- [ ] **Step 2: Add vitest globals to tsconfig.json**

In `frontend/tsconfig.json`, update the `"types"` array to include vitest globals:

```json
"types": ["vite/client", "vite-plugin-pwa/client", "vitest/globals"]
```

This gives TypeScript access to `describe`, `it`, `expect`, `vi` without explicit imports.

- [ ] **Step 3: Verify vitest can start**

```bash
cd frontend && bun run test
```

Expected: Vitest runs, finds 0 tests, passes (due to `passWithNoTests: true`).

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/bun.lockb frontend/vitest.config.ts frontend/tsconfig.json
git commit -m "chore(frontend): add vitest with jsdom and MSW dependencies"
```

---

## Chunk 2: MSW Setup and Test Utilities

### Task 3: Create MSW mock server

**Files:**
- Create: `frontend/src/test/mocks/handlers.ts`
- Create: `frontend/src/test/mocks/server.ts`
- Create: `frontend/src/test/setup.ts`

- [ ] **Step 1: Create default handlers file**

```typescript
// frontend/src/test/mocks/handlers.ts
import type { RequestHandler } from 'msw'

export const handlers: RequestHandler[] = [
  // Default handlers — extend per module as tests are added
]
```

- [ ] **Step 2: Create MSW server**

```typescript
// frontend/src/test/mocks/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

- [ ] **Step 3: Create test setup file**

```typescript
// frontend/src/test/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

- [ ] **Step 4: Verify setup loads without errors**

```bash
cd frontend && bun run test
```

Expected: Vitest runs, setup file loads, 0 tests, passes.

### Task 4: Create test utilities

**Files:**
- Create: `frontend/src/test/test-utils.ts`

- [ ] **Step 1: Create renderWithProviders helper**

This helper wraps components with Vue Router, TanStack Vue Query, and auth context — the three dependencies that every page/widget needs.

```typescript
// frontend/src/test/test-utils.ts
import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type RouteRecordRaw } from 'vue-router'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import type { Component } from 'vue'
import type { User } from '@/shared/api/composables/useAuth'

const defaultRoute: RouteRecordRaw = {
  path: '/',
  component: { template: '<div />' },
}

export function createTestRouter(routes: RouteRecordRaw[] = [defaultRoute]) {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  })
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
}

interface RenderOptions extends ComponentMountingOptions<any> {
  router?: ReturnType<typeof createTestRouter>
  queryClient?: QueryClient
  provideAuth?: { user: User }
}

/**
 * Mount a component with Vue Router, TanStack Query, and auth context.
 *
 * Provides the same inject keys as App.vue:
 * - 'user' (Ref<User>)
 * - 'isDemo' (Ref<boolean>)
 * - 'getCategoryById' (stub returning undefined — override via global.provide if needed)
 *
 * Usage:
 * ```ts
 * const wrapper = renderWithProviders(MyPage, {
 *   provideAuth: { user: mockUser },
 * })
 * ```
 */
export function renderWithProviders(
  component: Component,
  options: RenderOptions = {},
) {
  const { router, queryClient, provideAuth, ...mountOptions } = options

  const testRouter = router ?? createTestRouter()
  const testQueryClient = queryClient ?? createTestQueryClient()

  return mount(component, {
    ...mountOptions,
    global: {
      ...mountOptions.global,
      plugins: [
        ...(mountOptions.global?.plugins ?? []),
        testRouter,
        [VueQueryPlugin, { queryClient: testQueryClient }],
      ],
      provide: {
        // Stub for getCategoryById — override in global.provide if test needs real categories
        getCategoryById: () => undefined,
        ...mountOptions.global?.provide,
        ...(provideAuth
          ? {
              // Matches App.vue: provide('user', user) and provide('isDemo', isDemo)
              user: { value: provideAuth.user },
              isDemo: { value: provideAuth.user.isDemo ?? false },
            }
          : {}),
      },
    },
  })
}

/** Reusable mock user for tests */
export const mockUser: User = {
  id: 'test-user-1',
  name: 'Test User',
  email: 'test@example.com',
  currency: 'UZS',
  hasCompletedOnboarding: true,
  defaultAccountId: 'acc-1',
  createdAt: '2025-01-01T00:00:00.000Z',
  isDemo: false,
  demoExpiresAt: null,
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/test/
git commit -m "chore(frontend): add MSW server, test setup, and renderWithProviders utility"
```

---

## Chunk 3: Smoke Test and CI/CD

### Task 5: Write a smoke test

**Files:**
- Create: `frontend/src/shared/lib/format/currency.spec.ts`

A simple unit test for an existing utility to verify the entire test pipeline works (vitest → jsdom → aliases → setup file → test execution).

- [ ] **Step 1: Read the existing currency formatter**

Read `frontend/src/shared/lib/format/currency.ts` to understand what functions it exports and their signatures.

- [ ] **Step 2: Write the smoke test**

```typescript
// frontend/src/shared/lib/format/currency.spec.ts
import { describe, it, expect } from 'vitest'
import { formatCurrency, getCurrencySymbol } from './currency'

describe('formatCurrency', () => {
  it('formats UZS amount with spaces', () => {
    const result = formatCurrency(50000, 'UZS')
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })
})

describe('getCurrencySymbol', () => {
  it('returns symbol for known currency', () => {
    const symbol = getCurrencySymbol('USD')
    expect(symbol).toBeDefined()
    expect(typeof symbol).toBe('string')
  })
})
```

Note: The exact assertion values depend on what `formatCurrency` and `getCurrencySymbol` return. Read the source first, then write assertions that match the actual output.

- [ ] **Step 3: Run the test**

```bash
cd frontend && bun run test
```

Expected: 2 tests pass. This validates:
- Vitest loads correctly
- `@/` aliases resolve (the import uses `./currency` relative, but the setup file uses `@/` paths)
- jsdom environment works
- Setup file (MSW) loads without errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/lib/format/currency.spec.ts
git commit -m "test(frontend): add smoke test for currency formatter"
```

### Task 6: Add frontend tests to CI/CD pipeline

**Files:**
- Modify: `.github/workflows/deploy.yml:185-191`

- [ ] **Step 1: Add test step to build-frontend job**

In `.github/workflows/deploy.yml`, in the `build-frontend` job, add a test step **after** "Install frontend dependencies" (line 185) and **before** "Frontend type-check and build" (line 187):

```yaml
      - name: Frontend tests
        working-directory: frontend
        run: bun run test
```

The resulting order should be:
1. Checkout code
2. Setup Bun
3. Cache bun dependencies
4. Install frontend dependencies
5. **Frontend tests** ← NEW
6. Frontend type-check and build
7. (Docker steps...)

- [ ] **Step 2: Verify YAML is valid**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo "Valid YAML"
```

Expected: "Valid YAML"

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add frontend test step to deploy pipeline"
```

### Task 7: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd frontend && bun run test
```

Expected: All tests pass.

- [ ] **Step 2: Run build to ensure no conflicts**

```bash
cd frontend && bun run build
```

Expected: Type-check + build succeeds. Vitest config does not interfere with production build.

- [ ] **Step 3: Verify test:watch works**

```bash
cd frontend && timeout 5 bun run test:watch || true
```

Expected: Vitest starts in watch mode, finds tests, exits after timeout.
