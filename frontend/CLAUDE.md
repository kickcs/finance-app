# CLAUDE.md — frontend

Vue 3 + TypeScript app on Feature-Sliced Design. Layers under `src/`: `app/` → `pages/` → `widgets/` → `features/` → `entities/` → `shared/`, with imports only ever pointing downward. Server state is TanStack Vue Query; styling is Tailwind v4 over Reka UI headless primitives.

`DESIGN_SYSTEM.md` documents tokens, typography and the component library — read component source for props.

## API layer pattern

Each entity in `entities/<name>/api/`:
- `*Api.ts` — HTTP functions; this is where backend camelCase is transformed into frontend snake_case
- `use*.ts` — Vue Query composables with mutations and cache invalidation
- `queryKeys.ts` — query key factory; `model/types.ts` — types

Entity composables all take `userId: MaybeRefOrGetter<string|null>`, auto-disable when it is falsy, and apply optimistic updates.

**Cache invalidation** (`shared/api/invalidation.ts`): after ANY debt mutation use `invalidateDebtRelated` — it is the broadest helper and covers debts, transactions and accounts. Narrower helpers leave stale balances on screen.

**Cursor pagination**: transactions use a `{ date, createdAt }` cursor; debts use `{ personName, debtType, createdAt }` with group-level pagination, so a person's group is never split across pages. Cursor fields arrive camelCase from the backend.

## Authentication

`useAuth()` — access token in localStorage, refresh token in an httpOnly cookie set by the backend. `shared/api/http.ts` auto-refreshes on 401. Router guards read the `requiresAuth` / `requiresOnboarding` route meta. Anonymous demo mode has an expiry.

## Conventions & gotchas

- **Page layout**: standard pages use `min-h-screen bg-background-light dark:bg-background-dark pb-28` (`pb-28` clears BottomNav). Fixed-scroll pages use `h-dvh flex flex-col overflow-hidden` with `flex-1 overflow-y-auto` on the scrolling section
- **Design tokens only**: `bg-surface-light dark:bg-surface-dark`, never raw Tailwind colors. See `DESIGN_SYSTEM.md` § Anti-Patterns
- **`cn()`** from `shared/lib/utils.ts` for every dynamic class string (clsx + tailwind-merge)
- **VueUse first**: for localStorage, event listeners, media queries, resize observers and timers use `@vueuse/core` rather than hand-rolling. Check https://vueuse.org before writing a custom hook
- **Icons**: `<UIcon name="material_symbol_name" />` — Material Symbol names are mapped to Lucide in `shared/ui/icon/iconMap.ts`; a new icon needs a new mapping there first
- **PullToRefresh breaks flex chains** — wrap it in its own `flex-1 overflow-y-auto` div
- **Virtual lists**: `VirtualGroupedTransactionList` needs an explicit `height` set with `calc()`; it will not size itself from a flex parent
- **Split expense**: one transaction + N debts linked by `source_transaction_id`. When editing, save the transaction first (via the `onSave` prop), THEN the debts — the reverse order orphans the debts
- **Global user state** is provided from `App.vue` via `provide/inject`
- **`usePremiumFeature()`** is a singleton and must be `init()`-ed in `App.vue` before `requirePremium()` is used anywhere
- **LemonSqueezy SDK** is loaded on demand via `loadLemonSqueezy()` from `shared/lib/lemonSqueezy.ts` — never from `index.html`, it costs a redirect and two extra origins on every app start. Window type is declared in `vite-env.d.ts`; use `window.LemonSqueezy?.Url.Open(url)` with a `window.open` fallback
- **Eager import graph**: anything `App.vue` reaches synchronously ends up in the first-paint bundle. Vue SFC barrels (`shared/ui/index.ts`, feature `index.ts`) are not tree-shakeable — one barrel import pulls every component it re-exports. In modules reachable from `App.vue`, import by subpath (`@/shared/ui/icon`), not from the barrel. `scripts/check-eager-bundle.mjs` guards the budget after `bun run build`
