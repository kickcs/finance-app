# UI/UX Performance Optimizations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the app feel instant and native — preload fonts, persist key data offline, add iOS splash screens.

**Architecture:** Three independent optimizations: (1) Vite plugin for font preload injection, (2) TanStack Query persistence to localStorage with selective dehydration, (3) static PNG splash screens with dark mode support.

**Tech Stack:** Vite plugin API, `@tanstack/query-sync-storage-persister`, `@tanstack/query-persist-client-core`, Node.js canvas (sharp) for splash generation.

---

### Task 1: Font Preload — Vite Plugin

**Files:**
- Create: `frontend/src/app/plugins/fontPreloadPlugin.ts`
- Modify: `frontend/vite.config.ts` (add plugin)

**Step 1: Create the Vite plugin**

Create `frontend/src/app/plugins/fontPreloadPlugin.ts`:

```typescript
import type { Plugin } from 'vite';

/**
 * Vite plugin that injects <link rel="preload"> for critical Inter font files.
 * Only activates during build (not dev server).
 * Matches hashed font filenames in the bundle and generates preload tags.
 */
export function fontPreloadPlugin(): Plugin {
  const CRITICAL_FONTS = [
    'inter-latin-wght-normal',
    'inter-cyrillic-wght-normal',
  ];

  return {
    name: 'font-preload',
    enforce: 'post',
    apply: 'build',
    transformIndexHtml(html, ctx) {
      const bundle = ctx.bundle;
      if (!bundle) return html;

      const tags: { tag: string; attrs: Record<string, string>; injectTo: 'head' }[] = [];

      for (const [fileName] of Object.entries(bundle)) {
        if (
          fileName.endsWith('.woff2') &&
          CRITICAL_FONTS.some((font) => fileName.includes(font))
        ) {
          tags.push({
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'font',
              type: 'font/woff2',
              crossorigin: 'anonymous',
              href: `/${fileName}`,
            },
            injectTo: 'head',
          });
        }
      }

      return tags;
    },
  };
}
```

**Step 2: Register plugin in vite.config.ts**

In `frontend/vite.config.ts`, add import and plugin registration:

```typescript
import { fontPreloadPlugin } from './src/app/plugins/fontPreloadPlugin'
```

Add `fontPreloadPlugin()` to the plugins array, right after `vue()`:

```typescript
plugins: [
  vue(),
  fontPreloadPlugin(),  // <-- add here
  tailwindcss(),
  // ... rest
]
```

**Step 3: Build and verify**

Run: `cd frontend && bun run build`
Expected: Build succeeds. Check `dist/index.html` contains two `<link rel="preload" as="font" ...>` tags in `<head>` pointing to hashed woff2 files.

Run: `grep 'rel="preload"' dist/index.html`
Expected: Two lines with `inter-latin-wght-normal` and `inter-cyrillic-wght-normal`.

**Step 4: Commit**

```bash
git add frontend/src/app/plugins/fontPreloadPlugin.ts frontend/vite.config.ts
git commit -m "perf: preload critical Inter font files via Vite plugin"
```

---

### Task 2: Offline-First — Install Dependencies

**Step 1: Install TanStack persistence packages**

Run: `cd frontend && bun add @tanstack/query-persist-client-core @tanstack/query-sync-storage-persister`

**Step 2: Verify installation**

Run: `cd frontend && grep "persist" package.json`
Expected: Both `@tanstack/query-persist-client-core` and `@tanstack/query-sync-storage-persister` present.

**Step 3: Commit**

```bash
git add frontend/package.json frontend/bun.lock
git commit -m "chore: add TanStack Query persistence packages"
```

---

### Task 3: Offline-First — Implement Query Persistence

**Files:**
- Modify: `frontend/src/shared/api/queryClient.ts` (add persistence config)
- Modify: `frontend/src/main.ts` (setup persister before mount)
- Modify: `frontend/src/shared/api/composables/useAuth.ts` (clear persisted cache on logout)

**Step 1: Update queryClient.ts with persistence setup**

Replace `frontend/src/shared/api/queryClient.ts` with:

```typescript
import { QueryClient } from '@tanstack/vue-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { persistQueryClient } from '@tanstack/query-persist-client-core';

const PERSIST_STORAGE_KEY = 'ouro-query-cache';
const MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Query key prefixes that should be persisted to localStorage.
 * Only critical dashboard data — keeps storage small and restore fast.
 */
const PERSISTED_KEY_PREFIXES = [
  'accounts',
  'profile',
  'categories',
  'monthly-stats',
];

/** Check if a query key should be persisted */
function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const prefix = queryKey[0];
  if (typeof prefix !== 'string') return false;
  // 'transactions' keys: only persist 'recent' subkey
  if (prefix === 'transactions') {
    return queryKey.includes('recent');
  }
  return PERSISTED_KEY_PREFIXES.includes(prefix);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
      gcTime: MAX_AGE, // Match persistence maxAge so restored data isn't GC'd
      refetchOnWindowFocus: false,
      retry: 1,
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: PERSIST_STORAGE_KEY,
});

// Setup persistence — restores cache on load, saves on changes
const { remove: removePersistence } = persistQueryClient({
  queryClient,
  persister,
  maxAge: MAX_AGE,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      // Only persist successful queries that match our whitelist
      return query.state.status === 'success' && shouldPersistQuery(query.queryKey);
    },
  },
});

/** Clear persisted cache (call on logout) */
export function clearPersistedCache() {
  removePersistence();
  localStorage.removeItem(PERSIST_STORAGE_KEY);
}
```

**Step 2: Update main.ts — no changes needed**

The `persistQueryClient` call is self-contained in `queryClient.ts`. It auto-restores on import and auto-saves via subscribe. No changes to `main.ts` required.

**Step 3: Update useAuth.ts signOut to clear persisted cache**

In `frontend/src/shared/api/composables/useAuth.ts`, add import:

```typescript
import { queryClient, clearPersistedCache } from '@/shared/api/queryClient';
```

In the `signOut()` function, after `queryClient.clear()`, add:

```typescript
      // Clear all cached queries
      queryClient.clear();

      // Clear persisted query cache from localStorage
      clearPersistedCache();
```

**Step 4: Build and verify**

Run: `cd frontend && bun run build`
Expected: Build succeeds with no type errors.

**Step 5: Commit**

```bash
git add frontend/src/shared/api/queryClient.ts frontend/src/shared/api/composables/useAuth.ts
git commit -m "feat: persist key Vue Query data to localStorage for instant load"
```

---

### Task 4: iOS Splash Screens — Generate Images

**Files:**
- Create: `frontend/scripts/generate-splash-screens.ts` (one-time script)
- Create: `frontend/public/splash/` directory with 12 PNG files

**Step 1: Create splash screen generator script**

Create `frontend/scripts/generate-splash-screens.ts`:

```typescript
/**
 * Generates iOS PWA splash screen images.
 * Uses Node.js canvas to render logo SVG centered on light/dark backgrounds.
 *
 * Run: cd frontend && bun run scripts/generate-splash-screens.ts
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SCREENS = [
  { name: '1290x2796', width: 1290, height: 2796, ratio: 3 }, // iPhone 15 Pro Max / 16 Plus
  { name: '1179x2556', width: 1179, height: 2556, ratio: 3 }, // iPhone 15 Pro / 16
  { name: '1170x2532', width: 1170, height: 2532, ratio: 3 }, // iPhone 14 / 15
  { name: '750x1334', width: 750, height: 1334, ratio: 2 },   // iPhone SE 3rd
  { name: '1125x2436', width: 1125, height: 2436, ratio: 3 }, // iPhone 12/13 mini
  { name: '1242x2208', width: 1242, height: 2208, ratio: 3 }, // iPhone 8 Plus
];

const THEMES = [
  { name: 'light', bg: '#FAFAFA' },
  { name: 'dark', bg: '#09090B' },
];

const OUTPUT_DIR = join(import.meta.dir, '../public/splash');
const LOGO_SVG = readFileSync(join(import.meta.dir, '../public/favicon.svg'));
const LOGO_SIZE_RATIO = 0.2; // Logo takes 20% of screen width

async function generateSplash(
  width: number,
  height: number,
  bgColor: string,
  outputPath: string,
) {
  const logoSize = Math.round(width * LOGO_SIZE_RATIO);

  const logoBuffer = await sharp(LOGO_SVG)
    .resize(logoSize, logoSize)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: bgColor,
    },
  })
    .composite([
      {
        input: logoBuffer,
        left: Math.round((width - logoSize) / 2),
        top: Math.round((height - logoSize) / 2),
      },
    ])
    .png({ quality: 90 })
    .toFile(outputPath);
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const screen of SCREENS) {
    for (const theme of THEMES) {
      const filename = `apple-splash-${screen.name}-${theme.name}.png`;
      const outputPath = join(OUTPUT_DIR, filename);
      await generateSplash(screen.width, screen.height, theme.bg, outputPath);
      console.log(`Generated: ${filename}`);
    }
  }

  console.log(`\nDone! Generated ${SCREENS.length * THEMES.length} splash screens in public/splash/`);
}

main();
```

**Step 2: Install sharp as dev dependency**

Run: `cd frontend && bun add -d sharp`

**Step 3: Run the generator**

Run: `cd frontend && bun run scripts/generate-splash-screens.ts`
Expected: 12 PNG files created in `public/splash/`.

**Step 4: Verify files**

Run: `ls -la frontend/public/splash/`
Expected: 12 files (6 sizes x 2 themes), each between 10KB-100KB.

**Step 5: Commit**

```bash
git add frontend/scripts/generate-splash-screens.ts frontend/public/splash/ frontend/package.json frontend/bun.lock
git commit -m "chore: add iOS splash screen generator and generated images"
```

---

### Task 5: iOS Splash Screens — Add HTML Tags

**Files:**
- Modify: `frontend/index.html` (add apple-touch-startup-image link tags)

**Step 1: Add splash screen link tags to index.html**

After the existing `<link rel="apple-touch-icon" href="/logo-192.png">` line, add:

```html
    <!-- iOS PWA Splash Screens (light + dark for each device) -->
    <!-- iPhone 15 Pro Max / 16 Plus -->
    <link rel="apple-touch-startup-image" href="/splash/apple-splash-1290x2796-light.png" media="(prefers-color-scheme: light) and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)">
    <link rel="apple-touch-startup-image" href="/splash/apple-splash-1290x2796-dark.png" media="(prefers-color-scheme: dark) and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)">
    <!-- iPhone 15 Pro / 16 -->
    <link rel="apple-touch-startup-image" href="/splash/apple-splash-1179x2556-light.png" media="(prefers-color-scheme: light) and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)">
    <link rel="apple-touch-startup-image" href="/splash/apple-splash-1179x2556-dark.png" media="(prefers-color-scheme: dark) and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)">
    <!-- iPhone 14 / 15 / 16 -->
    <link rel="apple-touch-startup-image" href="/splash/apple-splash-1170x2532-light.png" media="(prefers-color-scheme: light) and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)">
    <link rel="apple-touch-startup-image" href="/splash/apple-splash-1170x2532-dark.png" media="(prefers-color-scheme: dark) and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)">
    <!-- iPhone SE 3rd gen -->
    <link rel="apple-touch-startup-image" href="/splash/apple-splash-750x1334-light.png" media="(prefers-color-scheme: light) and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)">
    <link rel="apple-touch-startup-image" href="/splash/apple-splash-750x1334-dark.png" media="(prefers-color-scheme: dark) and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)">
    <!-- iPhone 12/13 mini -->
    <link rel="apple-touch-startup-image" href="/splash/apple-splash-1125x2436-light.png" media="(prefers-color-scheme: light) and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)">
    <link rel="apple-touch-startup-image" href="/splash/apple-splash-1125x2436-dark.png" media="(prefers-color-scheme: dark) and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)">
    <!-- iPhone 8 Plus -->
    <link rel="apple-touch-startup-image" href="/splash/apple-splash-1242x2208-light.png" media="(prefers-color-scheme: light) and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)">
    <link rel="apple-touch-startup-image" href="/splash/apple-splash-1242x2208-dark.png" media="(prefers-color-scheme: dark) and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)">
```

**Step 2: Build and verify**

Run: `cd frontend && bun run build`
Expected: Build succeeds. `dist/index.html` contains all splash screen link tags. Splash PNGs are copied to `dist/splash/`.

**Step 3: Commit**

```bash
git add frontend/index.html
git commit -m "feat: add iOS PWA splash screens with dark mode support"
```

---

### Task 6: Final Verification

**Step 1: Full build**

Run: `cd frontend && bun run build`
Expected: No errors, no warnings.

**Step 2: Verify font preload in output**

Run: `grep 'rel="preload".*font' frontend/dist/index.html`
Expected: Two preload tags for latin and cyrillic woff2 files.

**Step 3: Verify splash screens in output**

Run: `ls frontend/dist/splash/ | wc -l`
Expected: 12 files.

**Step 4: Verify persistence module compiles**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: No type errors.

**Step 5: Commit (if any fixups needed)**

```bash
git commit -m "fix: address build issues from performance optimizations"
```
