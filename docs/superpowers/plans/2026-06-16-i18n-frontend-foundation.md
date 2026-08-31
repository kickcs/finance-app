# i18n Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate `vue-i18n`, add a `useLocale()` singleton + `detectLocale()`, sync the chosen language with the backend profile, make formatters locale-aware, and add a language switcher in the profile — establishing the frontend i18n scaffold that the extraction workflow will fill in.

**Architecture:** One `vue-i18n` instance (Composition API, `legacy: false`). Messages are assembled at build time via `import.meta.glob('@/**/locales/*.json', { eager: true })`, with the namespace derived from each file's FSD path (Approach A). A `useLocale()` singleton (module-level `ref` + `useLocalStorage`, modeled on `useTheme`/`useAuth`) is the source of truth before login; after login the backend profile wins on conflict. Date/currency formatters stop hardcoding `'ru-RU'` and read the active locale. A language item in the profile navigates to a settings page mirroring the currency selector.

**Tech Stack:** Vue 3.5, `vue-i18n@11`, `@vueuse/core`, TanStack Vue Query, Vitest. Requires the backend foundation plan (profile `language` field + API) to be done first for profile sync.

**Spec:** `docs/superpowers/specs/2026-06-16-i18n-english-language-design.md` (Sections 1 & 2).

---

## File Structure

**Create:**
- `frontend/src/shared/i18n/detectLocale.ts` — `navigator.language` → `'en' | 'ru'`, fallback `'ru'`
- `frontend/src/shared/i18n/index.ts` — `createI18n`, glob message assembly, `setI18nLocale`
- `frontend/src/shared/i18n/locales/shared/ru.json` + `en.json` — shared namespace (date words, common UI)
- `frontend/src/shared/i18n/useLocale.ts` — singleton composable
- `frontend/src/shared/i18n/detectLocale.spec.ts` — unit test
- `frontend/src/shared/i18n/useLocale.spec.ts` — unit test
- `frontend/src/pages/settings-language/SettingsLanguagePage.vue` — language selector page
- `frontend/src/pages/settings-language/locales/ru.json` + `en.json`

**Modify:**
- `frontend/package.json` — add `vue-i18n`
- `frontend/src/main.ts` — `app.use(i18n)`
- `frontend/src/app/App.vue` — init locale, sync from profile after auth
- `frontend/src/shared/lib/format/date.ts` — locale-aware `formatRelativeDate`, `formatDateGroup`, default locale
- `frontend/src/shared/api/services/profileApi.ts` — map `language` in update + transform
- `frontend/src/shared/api/composables/useProfile.ts` — `setLanguage`
- `frontend/src/shared/api/database.types.ts` — `language` in `profiles.Row`
- `frontend/src/pages/profile/ProfilePage.vue` — language menu item + click handler
- `frontend/src/app/router/index.ts` — route for settings-language
- `frontend/src/shared/config/*` STORAGE_KEYS — add `LOCALE` key (find exact file during Task)

---

## Task 1: Install vue-i18n and create the i18n instance

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/shared/i18n/index.ts`
- Create: `frontend/src/shared/i18n/locales/shared/ru.json`, `en.json`

- [ ] **Step 1: Install vue-i18n**

Run: `cd frontend && bun add vue-i18n@11`
Expected: added to `dependencies`.

- [ ] **Step 2: Create the shared namespace dictionaries**

`frontend/src/shared/i18n/locales/shared/ru.json`:
```json
{
  "date": {
    "today": "Сегодня",
    "yesterday": "Вчера",
    "daysAgo": "{n} дн. назад"
  }
}
```
`frontend/src/shared/i18n/locales/shared/en.json`:
```json
{
  "date": {
    "today": "Today",
    "yesterday": "Yesterday",
    "daysAgo": "{n} days ago"
  }
}
```

- [ ] **Step 3: Create the i18n instance with glob assembly**

`frontend/src/shared/i18n/index.ts`:
```typescript
import { createI18n } from 'vue-i18n';
import { detectLocale } from './detectLocale';

export type AppLocale = 'ru' | 'en';

type LocaleJson = Record<string, unknown>;

// Files live at @/<layer>/<slice>/locales/{ru,en}.json (+ shared namespace).
// Namespace is derived from the path: features/add-transaction/locales/ru.json
// → messages.ru.features.addTransaction.*
function buildMessages(): Record<AppLocale, LocaleJson> {
  const modules = import.meta.glob<{ default: LocaleJson }>('@/**/locales/*.json', {
    eager: true,
  });
  const messages: Record<AppLocale, LocaleJson> = { ru: {}, en: {} };

  for (const [path, mod] of Object.entries(modules)) {
    const match = path.match(/\/src\/(.+)\/locales\/(ru|en)\.json$/);
    if (!match) continue;
    const [, slicePath, locale] = match;
    const data = (mod as { default: LocaleJson }).default;

    if (slicePath === 'shared/i18n/locales/shared') {
      // shared namespace: merge at top level under "shared"
      assignDeep(messages[locale as AppLocale], ['shared'], data);
      continue;
    }
    // layer/slice → camelCase segments → nested namespace
    const segments = slicePath.split('/').map(toCamel);
    assignDeep(messages[locale as AppLocale], segments, data);
  }
  return messages;
}

function toCamel(seg: string): string {
  return seg.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function assignDeep(target: LocaleJson, segments: string[], value: LocaleJson): void {
  let node = target;
  for (let i = 0; i < segments.length - 1; i++) {
    node[segments[i]] ??= {};
    node = node[segments[i]] as LocaleJson;
  }
  node[segments[segments.length - 1]] = value;
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'ru',
  messages: buildMessages(),
});

export function setI18nLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale;
}
```

> NOTE: the `slicePath` for the shared dictionary depends on its real path. Verify the regex matches `shared/i18n/locales/shared` after creating the file; adjust the special-case branch if the folder differs.

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && bun run build`
Expected: success (no usages yet, just the module compiling). If `import.meta.glob` typing complains, the generic on `import.meta.glob<...>` resolves it.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add package.json src/shared/i18n/index.ts src/shared/i18n/locales
git commit -m "feat(i18n): add vue-i18n instance with FSD glob message assembly"
```

---

## Task 2: detectLocale()

**Files:**
- Create: `frontend/src/shared/i18n/detectLocale.ts`
- Test: `frontend/src/shared/i18n/detectLocale.spec.ts`

- [ ] **Step 1: Write the failing test**

`frontend/src/shared/i18n/detectLocale.spec.ts`:
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectLocale } from './detectLocale';

function mockNavLang(value: string | undefined) {
  vi.stubGlobal('navigator', { language: value });
}

afterEach(() => vi.unstubAllGlobals());

describe('detectLocale', () => {
  it('returns "en" for English browser locales', () => {
    mockNavLang('en-US');
    expect(detectLocale()).toBe('en');
  });
  it('returns "ru" for Russian browser locales', () => {
    mockNavLang('ru-RU');
    expect(detectLocale()).toBe('ru');
  });
  it('falls back to "ru" for any other locale', () => {
    mockNavLang('de-DE');
    expect(detectLocale()).toBe('ru');
  });
  it('falls back to "ru" when navigator.language is missing', () => {
    mockNavLang(undefined);
    expect(detectLocale()).toBe('ru');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && bun run test -- detectLocale`
Expected: FAIL — module not found / `detectLocale` undefined.

- [ ] **Step 3: Implement**

`frontend/src/shared/i18n/detectLocale.ts`:
```typescript
import type { AppLocale } from './index';

export function detectLocale(): AppLocale {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || '';
  return lang.toLowerCase().startsWith('en') ? 'en' : 'ru';
}
```

> NOTE: `detectLocale.ts` and `index.ts` reference each other's types. To avoid a cycle, define `AppLocale` once. If the circular type import is a problem at build, move `export type AppLocale = 'ru' | 'en'` into `detectLocale.ts` and import it into `index.ts` instead. Pick whichever keeps `bun run build` green.

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && bun run test -- detectLocale`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/shared/i18n/detectLocale.ts src/shared/i18n/detectLocale.spec.ts
git commit -m "feat(i18n): add detectLocale with navigator.language detection"
```

---

## Task 3: useLocale() singleton

**Files:**
- Create: `frontend/src/shared/i18n/useLocale.ts`
- Test: `frontend/src/shared/i18n/useLocale.spec.ts`
- Modify: STORAGE_KEYS file (add `LOCALE: 'locale'`)

- [ ] **Step 1: Add the storage key**

Run: `cd frontend && grep -rn "STORAGE_KEYS" src/shared | head`
Open the file defining `STORAGE_KEYS` (used by `useTheme`/`usePrimaryColor`) and add:
```typescript
LOCALE: 'locale',
```

- [ ] **Step 2: Write the failing test**

`frontend/src/shared/i18n/useLocale.spec.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./index', () => ({
  setI18nLocale: vi.fn(),
}));

import { useLocale } from './useLocale';
import { setI18nLocale } from './index';

describe('useLocale', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('setLocale updates the ref, localStorage and the i18n instance', () => {
    const { locale, setLocale } = useLocale();
    setLocale('en');
    expect(locale.value).toBe('en');
    expect(localStorage.getItem('locale')).toBe('en');
    expect(setI18nLocale).toHaveBeenCalledWith('en');
  });

  it('exposes available locales', () => {
    const { availableLocales } = useLocale();
    expect(availableLocales).toEqual(['ru', 'en']);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd frontend && bun run test -- useLocale`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement (singleton modeled on useTheme)**

`frontend/src/shared/i18n/useLocale.ts`:
```typescript
import { useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys'; // adjust path to the real STORAGE_KEYS module
import { detectLocale } from './detectLocale';
import { setI18nLocale, type AppLocale } from './index';

// Module-level singleton state (matches useTheme / useAuth pattern)
const locale = useLocalStorage<AppLocale>(STORAGE_KEYS.LOCALE, detectLocale());

export function useLocale() {
  function setLocale(next: AppLocale): void {
    locale.value = next;
    setI18nLocale(next);
  }

  /** Apply the persisted locale to the i18n instance (call once on app init). */
  function initLocale(): void {
    setI18nLocale(locale.value);
  }

  /** Profile wins on conflict at login: adopt the backend value into local state. */
  function adoptFromProfile(profileLanguage: AppLocale | null | undefined): void {
    if (profileLanguage && profileLanguage !== locale.value) {
      setLocale(profileLanguage);
    }
  }

  return {
    locale,
    availableLocales: ['ru', 'en'] as const,
    setLocale,
    initLocale,
    adoptFromProfile,
  };
}
```

> NOTE: import `STORAGE_KEYS` from its real module path (found in Step 1). The test mocks `./index`, so `setI18nLocale` is a spy; `useLocalStorage` uses the jsdom `localStorage` provided by Vitest.

- [ ] **Step 5: Run to verify it passes**

Run: `cd frontend && bun run test -- useLocale`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/shared/i18n/useLocale.ts src/shared/i18n/useLocale.spec.ts src/shared/config
git commit -m "feat(i18n): add useLocale singleton with profile-wins conflict resolution"
```

---

## Task 4: Wire i18n into the app

**Files:**
- Modify: `frontend/src/main.ts`
- Modify: `frontend/src/app/App.vue`

- [ ] **Step 1: Register the plugin in main.ts**

In `main.ts`, after the other `app.use(...)` calls:
```typescript
import { i18n } from './shared/i18n';
// ...
app.use(i18n);
```

- [ ] **Step 2: Initialize locale + sync from profile in App.vue**

In `App.vue` `<script setup>`, alongside the existing synchronous inits (`initTheme()`, `initPrimaryColor()`), add:
```typescript
import { useLocale } from '@/shared/i18n/useLocale';
const { initLocale, adoptFromProfile } = useLocale();
initLocale(); // apply persisted/ detected locale before first render
```
Then, where the profile/user becomes available after auth (the file already watches `user` / uses `useSubscription(userId)`), adopt the profile language. Add a `watch` on the loaded profile's `language`:
```typescript
import { watch } from 'vue';
// `profile` here is the loaded ProfileResponse-derived object the app already has access to.
// If only `user` is provided, read language from the profile query used elsewhere.
watch(
  () => profile.value?.language,
  (lang) => adoptFromProfile(lang as 'ru' | 'en' | undefined),
  { immediate: true },
);
```

> NOTE: `App.vue` already exposes auth `user` via `provide('user', user)` and uses `useSubscription(userId)`. Confirm how the full profile (with `language`) is obtained in `App.vue`; if it isn't, use the same profile query/composable the profile page uses (`useProfile`) to read `language`. The goal: once the authenticated profile loads, `adoptFromProfile(profile.language)` runs (profile wins).

- [ ] **Step 3: Verify build + existing app tests**

Run: `cd frontend && bun run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/main.ts src/app/App.vue
git commit -m "feat(i18n): wire vue-i18n into app, sync locale from profile"
```

---

## Task 5: Make date formatters locale-aware

**Files:**
- Modify: `frontend/src/shared/lib/format/date.ts`
- Test: `frontend/src/shared/lib/format/date.spec.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/lib/format/date.spec.ts`. Mock the i18n module so the formatter reads a controllable locale + translations:
```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/shared/i18n', () => ({
  i18n: {
    global: {
      locale: { value: 'en' },
      t: (key: string, named?: Record<string, unknown>) => {
        const dict: Record<string, string> = {
          'shared.date.today': 'Today',
          'shared.date.yesterday': 'Yesterday',
          'shared.date.daysAgo': `${named?.n} days ago`,
        };
        return dict[key] ?? key;
      },
    },
  },
}));

import { formatRelativeDate } from './date';

describe('formatRelativeDate (locale-aware)', () => {
  it('returns the localized "today" string', () => {
    expect(formatRelativeDate(new Date())).toBe('Today');
  });
  it('returns the localized "yesterday" string', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    expect(formatRelativeDate(d)).toBe('Yesterday');
  });
  it('returns the localized "N days ago" string', () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    expect(formatRelativeDate(d)).toBe('3 days ago');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && bun run test -- format/date`
Expected: FAIL — `formatRelativeDate` still returns Russian hardcoded strings.

- [ ] **Step 3: Make the formatters read the active locale**

In `date.ts`, import the i18n instance and a helper for the active Intl locale:
```typescript
import { i18n } from '@/shared/i18n';
import { getCachedDateFormat } from './intlCache';

const INTL_LOCALE: Record<string, string> = { ru: 'ru-RU', en: 'en-US' };
function activeIntlLocale(): string {
  return INTL_LOCALE[i18n.global.locale.value] ?? 'ru-RU';
}
```
Rewrite `formatRelativeDate`:
```typescript
export function formatRelativeDate(date: Date | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  const t = i18n.global.t;

  if (days === 0) return t('shared.date.today');
  if (days === 1) return t('shared.date.yesterday');
  if (days < 7) return t('shared.date.daysAgo', { n: days });
  return formatDate(d, { format: 'short' });
}
```
Update `formatDateGroup` to use `activeIntlLocale()` instead of the hardcoded `'ru-RU'`. Change the default `locale` parameter of `formatDate` and `formatLocalDate` from `'ru-RU'` to `activeIntlLocale()` (compute as default at call: `locale = activeIntlLocale()`).

> NOTE: keep `getCachedDateFormat` usage intact — only the locale argument changes. Callers that pass an explicit locale still override.

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && bun run test -- format/date`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify build**

Run: `cd frontend && bun run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/shared/lib/format/date.ts src/shared/lib/format/date.spec.ts
git commit -m "feat(i18n): make date formatters locale-aware"
```

---

## Task 6: Profile API — read & write `language`

**Files:**
- Modify: `frontend/src/shared/api/database.types.ts`
- Modify: `frontend/src/shared/api/services/profileApi.ts`
- Modify: `frontend/src/shared/api/composables/useProfile.ts`

- [ ] **Step 1: Add `language` to the Profile type**

In `database.types.ts`, in `profiles.Row`, add:
```typescript
language: string;
```
(Add to `Insert`/`Update` partial shapes too if those mirror `Row`.)

- [ ] **Step 2: Map `language` in profileApi**

In `profileApi.ts`:
- In `transformProfile(...)` (backend `ProfileResponse` → frontend `Profile`), add `language: data.language`.
- In `update(...)`, add `language: updates.language` to the PATCH body sent to `/profiles/me` (backend expects camelCase `language`).
- Add `language: string` to the local `ProfileResponse` interface in this file.

- [ ] **Step 3: Add setLanguage to useProfile**

In `useProfile.ts`, mirroring `setCurrency`:
```typescript
async function setLanguage(language: 'ru' | 'en') {
  return updateProfile({ language });
}
```
Export `setLanguage` in the composable's return object.

- [ ] **Step 4: Verify build**

Run: `cd frontend && bun run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/shared/api/database.types.ts src/shared/api/services/profileApi.ts src/shared/api/composables/useProfile.ts
git commit -m "feat(i18n): read and write profile language via API"
```

---

## Task 7: Language switcher in profile

**Files:**
- Create: `frontend/src/pages/settings-language/SettingsLanguagePage.vue`
- Create: `frontend/src/pages/settings-language/locales/ru.json`, `en.json`
- Modify: `frontend/src/app/router/index.ts`
- Modify: `frontend/src/pages/profile/ProfilePage.vue`

- [ ] **Step 1: Create the page dictionaries**

`frontend/src/pages/settings-language/locales/ru.json`:
```json
{ "title": "Язык", "russian": "Русский", "english": "English" }
```
`frontend/src/pages/settings-language/locales/en.json`:
```json
{ "title": "Language", "russian": "Русский", "english": "English" }
```
(Namespace becomes `pages.settingsLanguage.*` via the glob assembly.)

- [ ] **Step 2: Create the page**

`SettingsLanguagePage.vue` — list the two locales (mirror the currency selector list UX); selecting one calls `setLocale` + `setLanguage` (persist locally and to the profile when authenticated):
```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useLocale } from '@/shared/i18n/useLocale';
import { useProfile } from '@/shared/api/composables/useProfile';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser'; // adjust to real hook
import { AppHeader } from '@/widgets/AppHeader'; // adjust import to project's header usage
import { UIcon } from '@/shared/ui';

const { t } = useI18n();
const { locale, setLocale } = useLocale();
const userId = useCurrentUser(); // returns ref<string|null>; adjust to actual API
const { setLanguage } = useProfile(userId);

const options = [
  { code: 'ru' as const, label: t('pages.settingsLanguage.russian') },
  { code: 'en' as const, label: t('pages.settingsLanguage.english') },
];

async function choose(code: 'ru' | 'en') {
  setLocale(code);
  if (userId.value) await setLanguage(code);
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
    <AppHeader :title="t('pages.settingsLanguage.title')" />
    <div class="p-4 space-y-2">
      <button
        v-for="opt in options"
        :key="opt.code"
        :data-testid="`language-option-${opt.code}`"
        class="flex w-full items-center justify-between rounded-xl bg-surface-light dark:bg-surface-dark p-4"
        @click="choose(opt.code)"
      >
        <span>{{ opt.label }}</span>
        <UIcon v-if="locale === opt.code" name="check" />
      </button>
    </div>
  </div>
</template>
```

> NOTE: align imports with the project's real header component and current-user hook (recon: `useCurrentUser` exists under `shared/lib/hooks`; `AppHeader` is a widget). Match how `SettingsCurrencyPage` imports them — open that file and copy its header/layout usage exactly.

- [ ] **Step 3: Register the route**

In `app/router/index.ts`, add a route mirroring the currency settings route (find `SETTINGS_CURRENCY`):
```typescript
{
  path: '/settings/language',
  name: 'settings-language',
  component: () => import('@/pages/settings-language/SettingsLanguagePage.vue'),
  meta: { requiresAuth: true }, // match the currency route's meta
},
```
Add `SETTINGS_LANGUAGE: 'settings-language'` to `ROUTE_NAMES` (same file/const the currency route uses).

- [ ] **Step 4: Add the profile menu item**

In `ProfilePage.vue`, add to `settingsGroup` (mirroring the `currency` item):
```typescript
{
  id: 'language',
  icon: 'language',
  label: t('pages.profile.language'), // add this key to the profile page's locale files when that slice is processed; for now a literal 'Язык' is acceptable until the profile slice runs through the workflow
  value: () => (locale.value === 'en' ? 'English' : 'Русский'),
},
```
And in `handleMenuClick`:
```typescript
case 'language':
  router.push({ name: ROUTE_NAMES.SETTINGS_LANGUAGE });
  break;
```
Import `useLocale` in the page to expose `locale` for the `value()` display.

> NOTE: `ProfilePage` is not yet processed by the extraction workflow, so its surrounding labels are still literal Russian. Use a literal `'Язык'` label here (consistent with neighbors) — the workflow will key it later. Do not introduce a half-migrated `$t` for a single item.

- [ ] **Step 5: Verify build**

Run: `cd frontend && bun run build`
Expected: success.

- [ ] **Step 6: Add a page test**

In a new `SettingsLanguagePage.spec.ts` (mirror `ProfilePage.spec.ts` setup — mock `useProfile`, mount with a test router), assert clicking `[data-testid="language-option-en"]` calls `setLocale('en')`. Mock `useLocale` to spy on `setLocale`.

- [ ] **Step 7: Run the test**

Run: `cd frontend && bun run test -- SettingsLanguagePage`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd frontend && git add src/pages/settings-language src/app/router/index.ts src/pages/profile/ProfilePage.vue
git commit -m "feat(i18n): add language switcher page and profile entry"
```

---

## Task 8: Full frontend verification

- [ ] **Step 1: Lint + build + test**

Run: `cd frontend && bun run lint && bun run build && bun run test`
Expected: all green.

- [ ] **Step 2: Manual smoke (optional, local)**

`bun run dev`, open the app, go to Profile → Language, switch to English. Confirm relative dates render in English ("Today"/"Yesterday") and the choice persists across reload (localStorage). Log in and confirm the profile `language` updates (network PATCH `/profiles/me`).

- [ ] **Step 3: Commit fixups**

```bash
cd frontend && git add -A && git commit -m "chore(i18n): frontend foundation verification fixups" || echo "nothing to commit"
```

---

## Self-Review Notes (addressed)

- **Spec Section 1 (vue-i18n, glob assembly Approach A):** Tasks 1, 4. ✓
- **Spec Section 1 (formatters locale-aware; relative/group stop hardcoding ru):** Task 5. ✓
- **Spec Section 2 (useLocale singleton, localStorage persist):** Task 3. ✓
- **Spec Section 2 (detectLocale: navigator → en/ru, fallback ru):** Task 2. ✓
- **Spec Section 2 (sync to profile on setLocale; profile wins on login):** Tasks 3 (`adoptFromProfile`), 4 (watch), 6 (API), 7 (switcher persists to profile). ✓
- **Spec Section 2 (database.types `language`):** Task 6. ✓
- **Placeholder scan:** no TBD/TODO; the ProfilePage label note is a deliberate, explained choice (avoid half-migrating a slice the workflow owns), not a placeholder. ✓
- **Type consistency:** `AppLocale = 'ru' | 'en'` is the single locale type; `setLocale`/`setLanguage`/`adoptFromProfile`/`detectLocale` all use it. `setI18nLocale` is the only function mutating `i18n.global.locale`.
- **Dependency:** profile sync (Tasks 4,6,7) requires the backend `language` field (backend plan). If executed before backend, those steps still build but PATCH will be ignored by the server until the backend ships — note for sequencing.
- **Assumption to verify at execution:** how `App.vue` obtains the full profile object with `language` (Task 4 Step 2) — flagged inline.
```
