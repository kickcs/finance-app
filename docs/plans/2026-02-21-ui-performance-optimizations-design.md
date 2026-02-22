# UI/UX Performance Optimizations Design

Date: 2026-02-21

## 1. Font Preload (woff2)

**Goal**: Eliminate cascading font load (JS → CSS → woff2) by preloading critical font files in parallel with HTML.

**Approach**: Vite plugin that auto-injects `<link rel="preload">` tags for hashed font assets in `transformIndexHtml`.

**Scope**: 2 files only:
- `inter-latin-wght-normal.woff2` (digits, currency symbols, latin text)
- `inter-cyrillic-wght-normal.woff2` (all Russian UI text)

**Implementation**: Custom Vite plugin in `vite.config.ts` that matches font filenames in the build output bundle and generates preload link tags.

## 2. Offline-First (Vue Query Persistence)

**Goal**: Instant data render on repeat visits (0ms) by persisting Vue Query cache to localStorage.

**Approach**: `@tanstack/query-sync-storage-persister` + `persistQueryClient`.

**Persisted queries** (filter by query key prefix):
- `accounts` — account list and balances
- `recent-transactions` — dashboard transactions
- `categories` — expense/income categories
- `profile` / `auth-me` — user profile
- `monthly-stats` — current month statistics

**Config**:
- maxAge: 24 hours
- Storage: localStorage (sync persister)
- Dehydrate filter: only keys matching whitelist
- Clear on logout: `queryClient.clear()` + `removeItem`

**Behavior**: Cached data renders instantly → background refetch → UI updates seamlessly if data changed.

## 3. iOS PWA Splash Screens

**Goal**: Native app-like launch experience on iOS with branded splash screen instead of white/black flash.

**Approach**: Static PNG splash images with `<link rel="apple-touch-startup-image">` tags supporting light/dark via `media` attribute.

**Target devices** (6 iPhone sizes, no iPad):
- 1290x2796 (iPhone 15 Pro Max / 16 Plus)
- 1179x2556 (iPhone 15 Pro / 16)
- 1170x2532 (iPhone 14 / 15)
- 750x1334 (iPhone SE 3rd)
- 1125x2436 (iPhone 12/13 mini)
- 1242x2208 (iPhone 8 Plus)

**Design**: Centered logo on `#FAFAFA` (light) / `#09090B` (dark). 12 PNGs total (6 sizes x 2 themes).

**Media queries**: Each link tag uses `(prefers-color-scheme: light/dark)` + `(device-width: Xpx) and (device-height: Ypx) and (-webkit-device-pixel-ratio: N)`.
