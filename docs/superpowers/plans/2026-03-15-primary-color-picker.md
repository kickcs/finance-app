# Primary Color Picker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to change the app's primary accent color from 12 presets via a new settings page, persisted in localStorage and applied at runtime via CSS custom properties.

**Architecture:** New FSD feature `select-primary-color` with a singleton composable (`usePrimaryColor`) that reads/writes localStorage and overrides CSS custom properties on `document.documentElement.style`. A new page at `/settings/color` uses Reka UI `ColorSwatchPicker` (headless) for accessible color selection with live preview.

**Tech Stack:** Vue 3, Reka UI ColorSwatchPicker (requires upgrade to v2.9.2), Tailwind CSS v4, VueUse `useLocalStorage`, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-15-primary-color-picker-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `frontend/src/features/select-primary-color/model/colors.ts` | Color palette config (12 colors × 4 variants) |
| Create | `frontend/src/features/select-primary-color/model/usePrimaryColor.ts` | Singleton composable: get/set/apply/init |
| Create | `frontend/src/features/select-primary-color/index.ts` | Public API exports |
| Create | `frontend/src/pages/settings/color/PrimaryColorPage.vue` | Route page with ColorSwatchPicker + preview |
| Modify | `frontend/src/shared/config/storageKeys.ts` | Add `PRIMARY_COLOR` key |
| Modify | `frontend/src/shared/config/routeNames.ts` | Add `SETTINGS_COLOR` route name |
| Modify | `frontend/src/app/router/index.ts` | Add `/settings/color` route |
| Modify | `frontend/src/app/App.vue` | Call `initPrimaryColor()` on startup |
| Modify | `frontend/src/pages/profile/ProfilePage.vue` | Add menu item + color circle indicator |

---

## Chunk 1: Foundation

### Task 1: Upgrade reka-ui to v2.9.2

`ColorSwatchPicker` is only available from reka-ui v2.9.2+. Current installed version is 2.7.0.

- [ ] **Step 1: Upgrade reka-ui**

```bash
cd frontend && bun add reka-ui@^2.9.2
```

- [ ] **Step 2: Verify ColorSwatchPicker is available**

```bash
ls node_modules/reka-ui/dist/ColorSwatchPicker/
```

Expected: `ColorSwatchPickerRoot.js`, `ColorSwatchPickerItem.js`, `ColorSwatchPickerItemSwatch.js`, `ColorSwatchPickerItemIndicator.js`

- [ ] **Step 3: Verify build still works**

```bash
cd frontend && bun run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/bun.lock
git commit -m "chore: upgrade reka-ui to v2.9.2 for ColorSwatchPicker support"
```

---

### Task 2: Add storage key and route name

**Files:**
- Modify: `frontend/src/shared/config/storageKeys.ts`
- Modify: `frontend/src/shared/config/routeNames.ts`

- [ ] **Step 1: Add PRIMARY_COLOR to storageKeys.ts**

In `frontend/src/shared/config/storageKeys.ts`, add after the `PWA_INSTALL_DISMISSED` entry:

```typescript
  /** User's chosen primary accent color name (e.g. 'blue', 'rose') */
  PRIMARY_COLOR: 'primary_color',
```

- [ ] **Step 2: Add SETTINGS_COLOR to routeNames.ts**

In `frontend/src/shared/config/routeNames.ts`, add after `SETTINGS_QUICK_ACTIONS`:

```typescript
  SETTINGS_COLOR: 'settings-color',
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && bun run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/config/storageKeys.ts frontend/src/shared/config/routeNames.ts
git commit -m "feat: add PRIMARY_COLOR storage key and SETTINGS_COLOR route name"
```

---

### Task 3: Create color palette config

**Files:**
- Create: `frontend/src/features/select-primary-color/model/colors.ts`

- [ ] **Step 1: Create the palette config**

Create `frontend/src/features/select-primary-color/model/colors.ts`:

```typescript
export interface PrimaryColorVariants {
  base: string;
  hover: string;
  pressed: string;
  light: string;
}

export const PRIMARY_COLORS: Record<string, PrimaryColorVariants> = {
  indigo: {
    base: '#4F46E5',
    hover: '#6366F1',
    pressed: '#3730A3',
    light: 'rgba(79,70,229,0.12)',
  },
  blue: {
    base: '#3B82F6',
    hover: '#60A5FA',
    pressed: '#2563EB',
    light: 'rgba(59,130,246,0.12)',
  },
  sky: {
    base: '#0EA5E9',
    hover: '#38BDF8',
    pressed: '#0284C7',
    light: 'rgba(14,165,233,0.12)',
  },
  cyan: {
    base: '#06B6D4',
    hover: '#22D3EE',
    pressed: '#0891B2',
    light: 'rgba(6,182,212,0.12)',
  },
  teal: {
    base: '#14B8A6',
    hover: '#2DD4BF',
    pressed: '#0D9488',
    light: 'rgba(20,184,166,0.12)',
  },
  emerald: {
    base: '#10B981',
    hover: '#34D399',
    pressed: '#059669',
    light: 'rgba(16,185,129,0.12)',
  },
  lime: {
    base: '#84CC16',
    hover: '#A3E635',
    pressed: '#65A30D',
    light: 'rgba(132,204,22,0.12)',
  },
  amber: {
    base: '#F59E0B',
    hover: '#FBBF24',
    pressed: '#D97706',
    light: 'rgba(245,158,11,0.12)',
  },
  orange: {
    base: '#F97316',
    hover: '#FB923C',
    pressed: '#EA580C',
    light: 'rgba(249,115,22,0.12)',
  },
  red: {
    base: '#EF4444',
    hover: '#F87171',
    pressed: '#DC2626',
    light: 'rgba(239,68,68,0.12)',
  },
  rose: {
    base: '#F43F5E',
    hover: '#FB7185',
    pressed: '#E11D48',
    light: 'rgba(244,63,94,0.12)',
  },
  purple: {
    base: '#A855F7',
    hover: '#C084FC',
    pressed: '#9333EA',
    light: 'rgba(168,85,247,0.12)',
  },
};

export const DEFAULT_COLOR_NAME = 'indigo';

export const COLOR_NAMES = Object.keys(PRIMARY_COLORS);
```

- [ ] **Step 2: Verify no syntax errors**

```bash
cd frontend && npx vue-tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to `colors.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/select-primary-color/model/colors.ts
git commit -m "feat: add primary color palette config with 12 color presets"
```

---

### Task 4: Create usePrimaryColor composable

**Files:**
- Create: `frontend/src/features/select-primary-color/model/usePrimaryColor.ts`

- [ ] **Step 1: Create the composable**

Create `frontend/src/features/select-primary-color/model/usePrimaryColor.ts`:

```typescript
import { useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { PRIMARY_COLORS, DEFAULT_COLOR_NAME } from './colors';
import type { PrimaryColorVariants } from './colors';

/**
 * Convert hex color (#RRGGBB) to space-separated RGB integers.
 * Example: '#4F46E5' → '79 70 229'
 * Required by shadcn-vue CSS variables (--primary, --ring).
 */
function hexToRgbString(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

// Singleton state — shared across all usePrimaryColor() calls
const colorName = useLocalStorage<string>(STORAGE_KEYS.PRIMARY_COLOR, DEFAULT_COLOR_NAME);
let initialized = false;

function getVariants(name: string): PrimaryColorVariants {
  return PRIMARY_COLORS[name] ?? PRIMARY_COLORS[DEFAULT_COLOR_NAME];
}

function applyColor(name: string): void {
  const variants = getVariants(name);
  const el = document.documentElement;

  // Tailwind v4 @theme tokens
  el.style.setProperty('--color-primary', variants.base);
  el.style.setProperty('--color-primary-hover', variants.hover);
  el.style.setProperty('--color-primary-pressed', variants.pressed);
  el.style.setProperty('--color-primary-light', variants.light);

  // Info color is aliased to primary
  el.style.setProperty('--color-info', variants.base);
  el.style.setProperty('--color-info-light', variants.light);

  // shadcn-vue :root RGB variables
  const rgb = hexToRgbString(variants.base);
  el.style.setProperty('--primary', rgb);
  el.style.setProperty('--ring', rgb);
}

/**
 * Apply stored primary color on app startup.
 * Skips when the default color (indigo) is active because CSS @theme
 * tokens already define indigo — no runtime override needed.
 * IMPORTANT: This assumes PRIMARY_COLORS.indigo always matches the
 * default values in app/styles/index.css. If those defaults change,
 * update them in sync.
 */
export function initPrimaryColor(): void {
  if (initialized) return;

  if (colorName.value !== DEFAULT_COLOR_NAME) {
    applyColor(colorName.value);
  }

  initialized = true;
}

export function usePrimaryColor() {
  function setColor(name: string): void {
    colorName.value = name;
    applyColor(name);
  }

  return {
    colorName,
    setColor,
    applyColor,
    initPrimaryColor,
  };
}
```

- [ ] **Step 2: Verify no type errors**

```bash
cd frontend && npx vue-tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to `usePrimaryColor.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/select-primary-color/model/usePrimaryColor.ts
git commit -m "feat: add usePrimaryColor composable with localStorage + CSS override"
```

---

### Task 5: Create feature index.ts and wire into App.vue

**Files:**
- Create: `frontend/src/features/select-primary-color/index.ts`
- Modify: `frontend/src/app/App.vue`

- [ ] **Step 1: Create feature public API**

Create `frontend/src/features/select-primary-color/index.ts`:

```typescript
export { usePrimaryColor, initPrimaryColor } from './model/usePrimaryColor';
export { PRIMARY_COLORS, COLOR_NAMES, DEFAULT_COLOR_NAME } from './model/colors';
export type { PrimaryColorVariants } from './model/colors';
```

- [ ] **Step 2: Add initPrimaryColor() to App.vue**

In `frontend/src/app/App.vue`, add import after the `useTheme` import (line 4):

```typescript
import { initPrimaryColor } from '@/features/select-primary-color';
```

Then after `initTheme();` (line 27), add:

```typescript
// Initialize primary color synchronously (before mount, like theme)
initPrimaryColor();
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && bun run build
```

Expected: Build succeeds. App starts with default indigo (no visual change).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/select-primary-color/index.ts frontend/src/app/App.vue
git commit -m "feat: wire initPrimaryColor into App.vue startup"
```

---

## Chunk 2: UI & Integration

### Task 6: Create PrimaryColorPage

**Files:**
- Create: `frontend/src/pages/settings/color/PrimaryColorPage.vue`

- [ ] **Step 1: Create the page component**

Create `frontend/src/pages/settings/color/PrimaryColorPage.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import {
  ColorSwatchPickerRoot,
  ColorSwatchPickerItem,
  ColorSwatchPickerItemSwatch,
  ColorSwatchPickerItemIndicator,
} from 'reka-ui';
import { AppHeader } from '@/widgets/header';
import { PageContainer, UButton, UBadge, UProgressBar, UIcon, UCard } from '@/shared/ui';
import { navigateBack } from '@/app/router';
import { usePrimaryColor, PRIMARY_COLORS, COLOR_NAMES } from '@/features/select-primary-color';

const { colorName, setColor } = usePrimaryColor();

const selectedValue = computed({
  get: () => PRIMARY_COLORS[colorName.value]?.base ?? PRIMARY_COLORS.indigo.base,
  set: (hex: string) => {
    const name = COLOR_NAMES.find((n) => PRIMARY_COLORS[n].base === hex);
    if (name) setColor(name);
  },
});
</script>

<template>
  <PageContainer max-width="2xl" class="relative bg-background-light dark:bg-background-dark">
    <template #header>
      <AppHeader title="Основной цвет" show-back @back="navigateBack" />
    </template>

    <main class="pt-8 pb-28 md:pb-8 space-y-6">
      <!-- Color Picker -->
      <UCard class="p-5" variant="bordered">
        <h2
          class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-4 uppercase tracking-wider"
        >
          Выберите цвет
        </h2>

        <ColorSwatchPickerRoot
          v-model="selectedValue"
          class="flex flex-wrap gap-3"
        >
          <ColorSwatchPickerItem
            v-for="name in COLOR_NAMES"
            :key="name"
            :value="PRIMARY_COLORS[name].base"
            class="relative w-10 h-10 rounded-full cursor-pointer transition-transform hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            <ColorSwatchPickerItemSwatch
              class="w-full h-full rounded-full"
            />
            <ColorSwatchPickerItemIndicator
              class="absolute inset-0 flex items-center justify-center"
            >
              <UIcon name="check" size="sm" class="text-white drop-shadow-md" />
            </ColorSwatchPickerItemIndicator>
          </ColorSwatchPickerItem>
        </ColorSwatchPickerRoot>
      </UCard>

      <!-- Live Preview -->
      <UCard class="p-5" variant="bordered">
        <h2
          class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-4 uppercase tracking-wider"
        >
          Предпросмотр
        </h2>

        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <UButton variant="primary">Кнопка</UButton>
            <UButton variant="secondary">Вторичная</UButton>
          </div>

          <div class="flex items-center gap-2">
            <UBadge variant="default">Бейдж</UBadge>
            <UBadge variant="outline">Контур</UBadge>
          </div>

          <div>
            <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-2">
              Прогресс
            </p>
            <UProgressBar :value="65" size="md" />
          </div>
        </div>
      </UCard>
    </main>
  </PageContainer>
</template>
```

- [ ] **Step 2: Verify no type errors**

```bash
cd frontend && npx vue-tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/settings/color/PrimaryColorPage.vue
git commit -m "feat: add PrimaryColorPage with Reka UI ColorSwatchPicker and live preview"
```

---

### Task 7: Add route

**Files:**
- Modify: `frontend/src/app/router/index.ts`

- [ ] **Step 1: Add the route**

In `frontend/src/app/router/index.ts`, add a new child route inside the main layout children array. Add after the `settings/quick-actions` route (after line 177). Note: `requiresAuth` is inherited from the parent `/` route — same pattern as `settings/currency`, `settings/categories`, etc.

```typescript
        {
          path: 'settings/color',
          name: ROUTE_NAMES.SETTINGS_COLOR,
          component: () => import('@/pages/settings/color/PrimaryColorPage.vue'),
        },
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/router/index.ts
git commit -m "feat: add /settings/color route for primary color picker"
```

---

### Task 8: Add menu item to ProfilePage

**Files:**
- Modify: `frontend/src/pages/profile/ProfilePage.vue`

- [ ] **Step 1: Add imports**

In `frontend/src/pages/profile/ProfilePage.vue`, add after the existing imports (after line 16):

```typescript
import { usePrimaryColor, PRIMARY_COLORS } from '@/features/select-primary-color';
```

- [ ] **Step 2: Add color state**

After the `usePremiumFeature()` line (line 42), add:

```typescript
// Primary color
const { colorName: primaryColorName } = usePrimaryColor();
const currentPrimaryColor = computed(() => PRIMARY_COLORS[primaryColorName.value]?.base ?? '#4F46E5');
```

- [ ] **Step 3: Add menu item to settingsGroup**

In the `settingsGroup` array, add a new entry after the `currency` item (after the object ending at line 66):

```typescript
  {
    id: 'color',
    icon: 'palette',
    label: 'Основной цвет',
    color: '#a855f7',
  },
```

- [ ] **Step 4: Add color circle in the settings template**

In the settings group template, find the `<span v-if="item.value"` block (lines 201-206). After it, add:

```vue
            <span
              v-if="item.id === 'color'"
              class="w-5 h-5 rounded-full border border-border-light dark:border-border-dark mr-2 shrink-0"
              :style="{ backgroundColor: currentPrimaryColor }"
            />
```

- [ ] **Step 5: Add route case to handleMenuClick**

In the `handleMenuClick` function, add a case before the closing `}` of the switch (before line 127):

```typescript
    case 'color':
      router.push({ name: ROUTE_NAMES.SETTINGS_COLOR });
      break;
```

- [ ] **Step 6: Verify build**

```bash
cd frontend && bun run build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/profile/ProfilePage.vue
git commit -m "feat: add primary color picker menu item to profile settings"
```

---

### Task 9: Update changelog

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

- [ ] **Step 1: Add changelog entry**

Open `frontend/src/features/changelog/model/changelogData.ts`. Bump the version patch by 1 and add a new entry at the **top** of the `CHANGELOG_ENTRIES` array:

```typescript
  {
    version: '<bumped_version>',
    date: '2026-03-15',
    entries: [
      {
        type: 'feature',
        description: 'Выбор основного цвета приложения в настройках профиля',
      },
    ],
  },
```

Also update `CURRENT_VERSION` to match the new version.

- [ ] **Step 2: Verify build**

```bash
cd frontend && bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "feat: add changelog entry for primary color picker"
```

---

### Task 10: Final verification

- [ ] **Step 1: Full build check**

```bash
cd frontend && bun run build
```

Expected: Build succeeds with no errors or warnings.

- [ ] **Step 2: Manual smoke test**

```bash
cd frontend && bun run dev
```

Verify:
1. Open Profile → Settings → "Основной цвет" shows with palette icon and colored circle
2. Click → opens `/settings/color` page with 12 color swatches
3. Select a color → preview section updates instantly (button, badge, progress bar)
4. Navigate away and back → color persists
5. Refresh browser → color persists (no flash of default indigo)
6. Works in both light and dark theme
