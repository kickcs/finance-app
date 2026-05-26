# Vue → Expo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Поэтапно мигрировать Vue 3 PWA `finance-app` на Expo SDK 56 для публикации нативных приложений в App Store и Google Play.

**Architecture:** Greenfield rewrite в новом root-каталоге `mobile/` параллельно с действующим `frontend/` (Vue PWA продолжает работать в проде). Vue фичи переносятся 1:1 с сохранением FSD-структуры. Стек: Expo SDK 56, RN 0.85, React 19.2.3, Expo Router 6 (независим от React Navigation), NativeWind v5 + Expo UI, TanStack Query v5, react-native-reanimated 4 + react-native-worklets, expo-iap 2.9 (IAP), expo-notifications (push), expo-camera v17 (OCR).

**Tech Stack:** Expo SDK 56, React Native 0.85, React 19.2.3, TypeScript 6.0.3, Expo Router 6, NativeWind v5 + react-native-css (CSS-first, без tailwind.config.js / babel-плагина), react-native-reusables, @tanstack/react-query, Zustand, react-hook-form + zod, expo-secure-store, @react-native-async-storage/async-storage, react-native-reanimated 4, react-native-worklets, react-native-gesture-handler, expo-haptics, expo-notifications, expo-camera v17, expo-image-picker, expo-image, expo-iap 2.9 (либо react-native-iap Nitro на Phase 4), @shopify/flash-list, victory-native, papaparse, EAS Build + Submit + Update (runtimeVersion: fingerprint).

**Минимальные требования платформы:** iOS 16.4+ (поднято с 15.1 в SDK 56), Android 8+, Xcode 26.4+ для локальной сборки.

---

## Progress

| Phase | Tasks | Status |
|---|---|---|
| Phase 0 — Foundation | 1-12 | ✅ Done (branch `feature/mobile-migration`) |
| Phase 1 — Core read screens | 13-22 | ✅ Done |
| Phase 2 — Core mutations | 23-32 | ⏳ Pending |
| Phase 3 — Domain features | 33-50 | ⏳ Pending |
| Phase 4 — Native MVP | 51-62 | ⏳ Pending |
| Phase 5 — Polish & QA | 63-72 | ⏳ Pending |
| Phase 6 — Store submission | 73-80 | ⏳ Pending |

When picking up a phase: mark task header with `**Status:** 🚧 In progress`, flip step checkboxes from `- [ ]` to `- [x]` as each step lands, set header to `**Status:** ✅ Done` once committed. Keep the table above in sync.

---

## Review workflow (применяется ко ВСЕМ задачам ниже)

После завершения значимого шага (имплементация фичи, hook'а, API-layer'а, мутации, экрана) и **перед `git commit`** — обязательный цикл:

1. **Stage всех изменений:** `git add <paths>` (не коммитить ещё).
2. **Запуск `/code-review`** — встроенный skill анализирует staged diff и возвращает findings с severity (CRITICAL / HIGH / MEDIUM / LOW / INFO).
3. **Severity gate:**
   - **CRITICAL / HIGH** (bug, security, data loss, type unsafety, regression) — `git commit` блокируется. Исправить → re-stage → повторить `/code-review` пока чисто.
   - **MEDIUM / LOW / INFO** — записать в commit message как `Review notes:` (или отдельный TODO-комментарий в коде), commit разрешён.
4. **Только после прохождения review** — `git commit` с финальным message.

> **Что считается «значимым шагом»:** любой шаг, который сам по себе мог бы быть отдельным PR'ом. Чистое создание директорий, копипаст pure-функций без правок, переименование констант — не требуют review. Любые новые тесты, hooks, экраны, mutations, API-trasformers, security-чувствительные места (auth, HTTP, IAP, push, file upload, backend endpoints) — требуют **обязательно**.
>
> Каждый Task ниже завершается шагом `git commit`. Шаг `/code-review` — неявный, но обязательный, между предпоследним и последним step'ом. В critical-path задачах (auth, mutations, IAP, push, backend) review-шаг прописан явно.

---

## SDK 56 caveats — обязательно к прочтению перед Phase 1

Эта секция фиксирует расхождения между ранней редакцией плана и фактическим релизом Expo SDK 56. Применять **до начала Phase 1**.

| # | Где в плане | Что было | Что должно быть |
|---|---|---|---|
| 1 | Шапка / Tech Stack | RN 0.81, React 19, TS 5.7 | **RN 0.85, React 19.2.3, TS 6.0.3, iOS 16.4+, Xcode 26.4+** |
| 2 | Task 3 (NativeWind) | `tailwind.config.js` + `nativewind/babel` + `jsxImportSource: 'nativewind'` | CSS-first: `global.css` + `@theme`, `postcss.config.mjs`, **никакого** `tailwind.config.js`/babel-плагина, обёртки через `useCssElement` в `src/shared/ui/tw.tsx`. Пакеты: `nativewind@5.0.0-preview.2`, `react-native-css@0.0.0-nightly.5ce6396`, `@tailwindcss/postcss`, `tailwindcss@^4` + `resolutions.lightningcss` |
| 3 | Task 4 (токены) | Цвета в `tailwind.config.js` | Цвета в `global.css` `@theme` блоке как `--color-<name>` |
| 4 | Task 5 (зависимости) | `react-native-reanimated` без worklets | **Добавить `react-native-worklets`** (обязателен для Reanimated 4 в SDK 54+). Babel-плагин подключается автоматом — ручной `'react-native-reanimated/plugin'` НЕ нужен |
| 5 | Task 9 (NativeTabs) | `import { ..., Icon, Label }`; `<Icon sf=... />` | Compound: `<NativeTabs.Trigger.Icon sf="..." md="..." />`, `<NativeTabs.Trigger.Label>...` |
| 6 | Task 57 (IAP) | `getProducts(skus)`, `requestPurchase({ sku })` | **`fetchProducts({ skus, type: 'subs' })`**, **`requestPurchase({ request: { sku } })`**, `ProductPurchase` тип. expo-iap архивирован — оценить миграцию на `react-native-iap` (Nitro) к Phase 6 |
| 7 | Task 62 (EAS Update) | `runtimeVersion.policy = 'appVersion'` | **`'fingerprint'`** (рекомендация Expo для SDK 56) |
| 8 | Глобально | — | `expo/fetch` теперь default `globalThis.fetch` — для FormData upload в Task 56 (камера) при странностях opt-out через `EXPO_PUBLIC_USE_RN_FETCH=1` |
| 9 | Глобально | `@expo/vector-icons` | Deprecated → `@react-native-vector-icons/*` scoped или `expo-symbols`. Expo CLI больше не тянет пакет автоматически |
| 10 | Глобально | `@react-navigation/*` импорты | Expo Router 6 независим от React Navigation — использовать только `expo-router` entry points (есть codemod в skill `react-navigation-to-expo-router`) |

### Phase 0 reconcile (одноразовая задача перед Phase 1)

Поскольку Phase 0 был закоммичен по старому рецепту, перед стартом Phase 1 выполнить аудит уже существующих файлов:

- [ ] **A. Проверить `mobile/babel.config.js`** — если в нём только `nativewind/babel` и/или `react-native-reanimated/plugin`, удалить файл целиком (SDK 54+ подключает оба автоматически через `babel-preset-expo`).
- [ ] **B. Проверить `mobile/tailwind.config.js`** — удалить, перенести содержимое в `global.css` `@theme` (Task 3 + 4 переписаны выше).
- [ ] **C. Проверить `mobile/metro.config.js`** — заменить опции `withNativewind` на `{ inlineVariables: false, globalClassNamePolyfill: false }` (старый `{ input: './global.css' }` больше не используется).
- [ ] **D. Проверить `mobile/app/(tabs)/_layout.tsx`** — заменить `<Icon>/<Label>` на `<NativeTabs.Trigger.Icon>/<NativeTabs.Trigger.Label>` с `md=` prop'ом (Task 9).
- [ ] **E. Проверить `package.json`** — добавить `react-native-worklets`, `react-native-css`, `@tailwindcss/postcss`, `resolutions.lightningcss = "1.30.1"`. Понизить `nativewind` до `5.0.0-preview.2` если стоит v4.
- [ ] **F. Smoke-test** — `cd mobile && npx expo start --clear`, открыть smoke-page, убедиться что цвета из `@theme` применяются.
- [ ] **G. Commit:** `fix(mobile): Phase 0 reconcile to SDK 56 actuals`.

---

## Phase 0 — Foundation (Tasks 1-12)

Создаём scaffold, базовую инфраструктуру, design-токены, auth.

### Task 1: Scaffold Expo project

**Status:** ✅ Done

**Files:**
- Create: `mobile/` (вся директория через CLI)
- Modify: `package.json` (root) — добавить workspace или скрипты

- [x] **Step 1: Создать Expo проект через template**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app
npx create-expo-app@latest mobile --template default
```

- [x] **Step 2: Перейти в директорию и проверить версию SDK**

```bash
cd mobile
cat package.json | grep '"expo":'
# Expected: "expo": "~56.0.0" (или новее в рамках 56.x)
```

Если версия не 56 — установить явно:

```bash
npx expo install expo@~56.0.0
```

- [x] **Step 3: Удалить демо-роуты из template**

```bash
rm -rf mobile/app/(tabs) mobile/app/+not-found.tsx
# Оставляем только app/_layout.tsx как стартовую точку
```

- [x] **Step 4: Проверить запуск**

```bash
cd mobile && npx expo start
```

Expected: появляется QR код, Metro работает.

- [x] **Step 5: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): scaffold Expo SDK 56 project"
```

---

### Task 2: TypeScript strict + path aliases

**Status:** ✅ Done

**Files:**
- Modify: `mobile/tsconfig.json`

- [x] **Step 1: Заменить содержимое tsconfig.json**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "paths": {
      "@/*": ["./src/*"],
      "@/app/*": ["./app/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [x] **Step 2: Создать структуру каталогов src/**

```bash
cd mobile
mkdir -p src/{app,entities,features,widgets,shared/{ui,api/composables,lib/{format,date,haptics},config,hooks}}
touch src/shared/ui/index.ts
```

- [x] **Step 3: Verify type-check**

```bash
cd mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [x] **Step 4: Commit**

```bash
git add mobile/tsconfig.json mobile/src/
git commit -m "feat(mobile): typescript strict + FSD directory structure"
```

---

### Task 3: NativeWind v5 + Tailwind v4 CSS-first

**Status:** ⚠️ Was marked Done with deprecated recipe (Tailwind v3-style + babel-плагин). Перед Phase 1 — выполнить reconcile (см. Step 0).

> **SDK 56 caveat:** NativeWind v5 + Tailwind v4 настраиваются полностью CSS-first. **Нет** `tailwind.config.js`, **нет** `nativewind/babel`, **нет** `jsxImportSource: 'nativewind'`. Цвета и темы живут в `global.css` блоке `@theme`. Нативные RN-компоненты НЕ понимают `className` — нужны обёртки через `useCssElement` в `src/shared/ui/`.

**Files:**
- Create: `mobile/global.css`
- Create: `mobile/postcss.config.mjs`
- Create: `mobile/metro.config.js`
- Delete (если есть): `mobile/babel.config.js` (когда только NativeWind), `mobile/tailwind.config.js`
- Modify: `mobile/package.json` (resolutions для lightningcss)
- Modify: `mobile/app/_layout.tsx`
- Create: `mobile/src/shared/ui/tw.tsx` (CSS-wrapped View/Text/Pressable/ScrollView/TextInput)

- [ ] **Step 0: Reconcile с уже закоммиченным Phase 0**

Если `mobile/tailwind.config.js` существует — удалить. Если `mobile/babel.config.js` содержит только nativewind/reanimated конфиг — удалить (с SDK 54+ `babel-preset-expo` подключает плагины автоматически). Удалить `jsxImportSource: 'nativewind'`, если он попал в babel.

```bash
cd mobile
rm -f tailwind.config.js
# babel.config.js — открыть и удалить, если содержит только nativewind-блок
```

- [ ] **Step 1: Установить актуальные пакеты NativeWind v5 + Tailwind v4**

```bash
cd mobile
npx expo install tailwindcss@^4 nativewind@5.0.0-preview.2 react-native-css@0.0.0-nightly.5ce6396 @tailwindcss/postcss tailwind-merge clsx
npx expo install react-native-reanimated react-native-worklets react-native-safe-area-context
```

> **Note:** `autoprefixer` не нужен (Expo использует lightningcss). PostCSS уже включён в Expo по умолчанию.

- [ ] **Step 2: Добавить resolutions для lightningcss в `mobile/package.json`**

```json
{
  "resolutions": {
    "lightningcss": "1.30.1"
  }
}
```

- [ ] **Step 3: Создать `mobile/postcss.config.mjs`**

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 4: Создать `mobile/global.css` с импортами Tailwind v4 + platform fonts**

```css
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css";

@media ios {
  :root {
    --font-sans: system-ui;
    --font-rounded: ui-rounded;
    --font-mono: ui-monospace;
    --font-serif: ui-serif;
  }
}

@media android {
  :root {
    --font-sans: normal;
    --font-rounded: normal;
    --font-mono: monospace;
    --font-serif: serif;
  }
}
```

> Все цвета и токены добавим в Task 4 через `@theme` блок в этом же файле.

- [ ] **Step 5: Создать `mobile/metro.config.js`**

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, {
  inlineVariables: false,        // ломает PlatformColor в CSS variables
  globalClassNamePolyfill: false, // обёртки добавляем вручную (Step 7)
});
```

- [ ] **Step 6: Подключить global.css в root layout**

```tsx
// mobile/app/_layout.tsx
import '../global.css';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 7: Создать CSS-обёртки `mobile/src/shared/ui/tw.tsx`**

```tsx
import { useCssElement } from 'react-native-css';
import React from 'react';
import {
  View as RNView,
  Text as RNText,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  TextInput as RNTextInput,
} from 'react-native';

export const View = (props: React.ComponentProps<typeof RNView> & { className?: string }) =>
  useCssElement(RNView, props, { className: 'style' });
View.displayName = 'CSS(View)';

export const Text = (props: React.ComponentProps<typeof RNText> & { className?: string }) =>
  useCssElement(RNText, props, { className: 'style' });
Text.displayName = 'CSS(Text)';

export const Pressable = (props: React.ComponentProps<typeof RNPressable> & { className?: string }) =>
  useCssElement(RNPressable, props, { className: 'style' });
Pressable.displayName = 'CSS(Pressable)';

export const ScrollView = (
  props: React.ComponentProps<typeof RNScrollView> & {
    className?: string;
    contentContainerClassName?: string;
  }
) =>
  useCssElement(RNScrollView, props, {
    className: 'style',
    contentContainerClassName: 'contentContainerStyle',
  });
ScrollView.displayName = 'CSS(ScrollView)';

export const TextInput = (props: React.ComponentProps<typeof RNTextInput> & { className?: string }) =>
  useCssElement(RNTextInput, props, { className: 'style' });
TextInput.displayName = 'CSS(TextInput)';
```

> **Важно для всех последующих экранов:** импортировать `View/Text/Pressable/ScrollView/TextInput` из `@/shared/ui/tw`, а не из `react-native`. Использование сырого `react-native` импорта с `className` стилей не применит.

- [ ] **Step 8: Создать smoke-test page**

```bash
cat > mobile/app/index.tsx <<'EOF'
import { View, Text } from '@/shared/ui/tw';

export default function Home() {
  return (
    <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
      <Text className="text-2xl font-bold text-primary-light">NativeWind v5 works</Text>
    </View>
  );
}
EOF
```

- [ ] **Step 9: Проверить запуск**

```bash
cd mobile && npx expo start --clear
```

Expected: на телефоне — синий жирный текст "NativeWind v5 works" по центру. (Если белый текст без стилей — значит обёртки не сработали или PostCSS не подцепился.)

- [ ] **Step 10: Commit**

```bash
git add mobile/
git commit -m "fix(mobile): migrate Task 3 to NativeWind v5 + Tailwind v4 CSS-first"
```

---

### Task 4: Design tokens — портировать полный @theme из Vue в `global.css`

**Status:** ⚠️ Needs rework — токены сейчас в `tailwind.config.js`, нужно переехать в `global.css` `@theme` блок (после Task 3 reconcile).

> **SDK 56 caveat:** в Tailwind v4 CSS-first нет `tailwind.config.js`. Цвета регистрируются как CSS custom properties `--color-<name>` внутри `@layer theme { @theme { ... } }` — после этого автоматически становятся доступны как Tailwind-классы `bg-<name>`, `text-<name>`, `border-<name>`.

**Files:**
- Read: `frontend/src/app/styles/index.css`
- Modify: `mobile/global.css` (добавить блок `@theme`)
- Create: `mobile/src/shared/config/colors.ts`

- [ ] **Step 1: Прочитать текущие токены из Vue**

```bash
sed -n '/@theme/,/^}/p' frontend/src/app/styles/index.css
```

- [ ] **Step 2: Добавить в `mobile/global.css` блок `@theme` с цветами и radius**

Дописать в конец `mobile/global.css` (созданного в Task 3, Step 4):

```css
@layer theme {
  @theme {
    /* Цвета — перенесены 1:1 из frontend/src/app/styles/index.css. Имена с префиксом --color-<name> автоматически становятся bg-/text-/border-<name>. */
    --color-background-light: #FFFFFF;
    --color-background-dark: #0A0A0A;
    --color-surface-light: #F4F4F5;
    --color-surface-dark: #1C1C1E;
    --color-primary-light: #007AFF;
    --color-primary-dark: #0A84FF;
    --color-text-light: #0A0A0A;
    --color-text-dark: #FAFAFA;
    --color-text-muted-light: #6B7280;
    --color-text-muted-dark: #9CA3AF;
    --color-success-light: #34C759;
    --color-warning-light: #FF9500;
    --color-danger-light: #FF3B30;
    /* ... полный список (~50-80 переменных) из frontend/src/app/styles/index.css @theme — копировать построчно */

    /* Радиусы */
    --radius-xl: 16px;
    --radius-2xl: 20px;
    /* ... */
  }
}
```

> **Важно:** список должен совпадать 1:1 с Vue, чтобы стили виджетов перенеслись без правок. Если что-то выглядит иначе на native — обычно дело в opacity-helpers (`bg-primary-light/70` работает только если цвет задан в OKLCH или RGB формате; HEX тоже допустим).

- [ ] **Step 3: Перенести `ENTITY_COLORS` из frontend/src/shared/config/colors.ts**

```bash
cp frontend/src/shared/config/colors.ts mobile/src/shared/config/colors.ts
```

TS-объекты не зависят от Vue, переносятся без изменений.

- [ ] **Step 4: Verify**

```bash
cd mobile && npx tsc --noEmit
cd mobile && npx expo start --clear
```

Smoke-test страница из Task 3 должна по-прежнему показывать синий текст (цвет берётся уже из `@theme`, не из `tailwind.config.js`).

- [ ] **Step 5: Commit**

```bash
git add mobile/
git commit -m "fix(mobile): move design tokens to global.css @theme block (Tailwind v4)"
```

---

### Task 5: Установить core зависимости

**Status:** ✅ Done

**Files:**
- Modify: `mobile/package.json` (через npx expo install)

- [x] **Step 1: Установить навигацию и storage**

```bash
cd mobile
npx expo install expo-router expo-secure-store @react-native-async-storage/async-storage
```

- [x] **Step 2: Установить state и формы**

```bash
npm install @tanstack/react-query @tanstack/react-query-persist-client @tanstack/query-async-storage-persister zustand react-hook-form zod @hookform/resolvers
```

- [x] **Step 3: Установить UI и анимации**

```bash
npx expo install react-native-gesture-handler react-native-reanimated react-native-worklets expo-image expo-haptics expo-blur
npm install class-variance-authority @shopify/flash-list
```

> **SDK 56 caveat:** Reanimated 4 требует **`react-native-worklets`** как отдельный пакет (раньше worklets были встроены). Babel-плагин подключается автоматически через `babel-preset-expo` — ручной `'react-native-reanimated/plugin'` в `babel.config.js` НЕ нужен (см. Task 3 reconcile).
>
> **Note:** `clsx` и `tailwind-merge` уже установлены в Task 3 Step 1 — не дублируем.

- [x] **Step 4: Установить date/csv libs**

```bash
npm install date-fns papaparse @types/papaparse
```

- [x] **Step 5: Verify**

```bash
cd mobile && npx expo install --check
```

Expected: All dependencies match expected version. (Если warning — `npx expo install --fix`).

- [x] **Step 6: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): install core deps (router, query, RN gesture handler, reanimated, flash-list)"
```

---

### Task 6: Providers root (QueryClient, GestureHandler, SafeArea)

**Status:** ✅ Done

**Files:**
- Create: `mobile/src/app/providers.tsx`
- Modify: `mobile/app/_layout.tsx`

- [x] **Step 1: Создать providers.tsx**

```tsx
// mobile/src/app/providers.tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
    },
  },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage });

// PersistQueryClientProvider holds queries in `isRestoring` state until
// AsyncStorage hydration completes — preventing a "fetch with empty cache,
// then re-render when persisted data arrives" flash. Calling the imperative
// `persistQueryClient()` at module scope skips this gate.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}
        >
          {children}
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export { queryClient };
```

- [x] **Step 2: Обернуть root layout в Providers**

```tsx
// mobile/app/_layout.tsx
import '../global.css';
import { Stack } from 'expo-router';
import { Providers } from '@/app/providers';

export default function RootLayout() {
  return (
    <Providers>
      <Stack screenOptions={{ headerShown: false }} />
    </Providers>
  );
}
```

- [x] **Step 3: Проверить, что приложение запускается без ошибок**

```bash
cd mobile && npx expo start --clear
```

Expected: smoke-test страница из Task 3 продолжает работать.

- [x] **Step 4: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): root providers (QueryClient persisted, SafeArea, GestureHandler)"
```

---

### Task 7: HTTP client с JWT и refresh

**Status:** ✅ Done

**Files:**
- Create: `mobile/src/shared/config/env.ts`
- Create: `mobile/src/shared/api/http.ts`
- Create: `mobile/src/shared/config/storageKeys.ts`
- Create: `mobile/.env.local`

- [x] **Step 1: Env config**

```bash
echo 'EXPO_PUBLIC_API_URL=http://localhost:3000' > mobile/.env.local
echo '.env.local' >> mobile/.gitignore
```

```ts
// mobile/src/shared/config/env.ts
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
```

- [x] **Step 2: Storage keys**

```ts
// mobile/src/shared/config/storageKeys.ts
// Refresh token is NEVER stored on the client — backend issues it as an
// httpOnly cookie (path /api/auth, sameSite=lax) which iOS NSURLSession /
// Android OkHttp persist automatically when credentials:'include' is set.
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'finance.accessToken',
  USER_ID: 'finance.userId',
  THEME: 'finance.theme',
  PRIMARY_COLOR: 'finance.primaryColor',
} as const;
```

- [x] **Step 3: HTTP клиент с авто-refresh**

```ts
// mobile/src/shared/api/http.ts
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/shared/config/env';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    // Backend (backend/.../auth.controller.ts) issues refresh_token only as
    // an httpOnly cookie (path /api/auth, sameSite=lax) on /api/auth/login.
    // iOS NSURLSession and Android OkHttp persist it automatically when
    // credentials:'include' is set on both login and refresh requests.
    // Response body contains only { accessToken } — never refreshToken.
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      await clearTokens();
      return null;
    }
    const { accessToken } = (await res.json()) as { accessToken: string };
    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    return accessToken;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function setAccessToken(accessToken: string) {
  await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
}

type RequestOptions = RequestInit & { skipAuth?: boolean };

export async function http<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { skipAuth, headers, body, ...rest } = opts;
  const token = skipAuth ? null : await getAccessToken();

  // Browser/RN runtimes set the multipart boundary in Content-Type
  // automatically for FormData — don't inject application/json over it.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const doRequest = (authToken: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...rest,
      body,
      credentials: 'include',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...headers,
      },
    });

  let res = await doRequest(token);
  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await doRequest(newToken);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const ct = res.headers.get('content-type');
  if (ct?.includes('application/json')) return (await res.json()) as T;
  return (await res.text()) as T;
}
```

- [x] **Step 4: Verify type-check**

```bash
cd mobile && npx tsc --noEmit
```

- [x] **Step 5: Stage + `/code-review`** ⚠️ **обязательно — security-критичный код (JWT, refresh race, SecureStore)**

```bash
git add mobile/src/shared/ mobile/.env.local mobile/.gitignore
# Запустить /code-review — проверить:
# - shared refreshPromise предотвращает параллельные refresh-запросы
# - 401 после refresh fail не зацикливает — `if (newToken)` гарантирует выход
# - credentials:'include' стоит и на login, и на refresh (иначе cookie не передастся)
# - FormData branch в http() не инжектит Content-Type (multipart boundary должен ставить runtime)
# - access token не пишется в логи / error messages
```
При HIGH/CRITICAL findings — fix → re-stage → re-review до зелёного.

- [x] **Step 6: Commit**

```bash
git commit -m "feat(mobile): http client with JWT auto-refresh via SecureStore"
```

---

### Task 8: Auth store (Zustand) + useAuth hook

**Status:** ✅ Done

**Files:**
- Create: `mobile/src/shared/api/composables/useAuth.ts`

- [x] **Step 1: Создать Zustand store + hook**

```ts
// mobile/src/shared/api/composables/useAuth.ts
import { create } from 'zustand';
import { clearTokens, getAccessToken, http, setAccessToken } from '@/shared/api/http';
import { queryClient } from '@/app/providers';

// Mirrors backend Profile response shape — DO NOT diverge.
export interface User {
  id: string;
  name: string | null;
  email: string | null;
  currency: string;
  hasCompletedOnboarding: boolean;
  defaultAccountId: string | null;
  createdAt: string;
  isDemo: boolean;
  demoExpiresAt: string | null;
}

interface AuthState {
  user: User | null;
  ready: boolean;
  setUser: (u: User | null) => void;
  setReady: (r: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user }),
  setReady: (ready) => set({ ready }),
}));

// Refresh token lives in an httpOnly cookie — backend returns only accessToken.
interface AuthResponse {
  accessToken: string;
  user: User;
}

export async function bootstrapAuth() {
  const token = await getAccessToken();
  if (!token) {
    useAuthStore.getState().setReady(true);
    return;
  }
  try {
    const me = await http<User>('/api/auth/me');
    useAuthStore.getState().setUser(me);
  } catch {
    await clearTokens();
  } finally {
    useAuthStore.getState().setReady(true);
  }
}

export async function signIn(email: string, password: string) {
  const res = await http<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
  await setAccessToken(res.accessToken);
  useAuthStore.getState().setUser(res.user);
  return res.user;
}

export async function signUp(email: string, password: string, name?: string) {
  const res = await http<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
    skipAuth: true,
  });
  await setAccessToken(res.accessToken);
  useAuthStore.getState().setUser(res.user);
  return res.user;
}

export async function signInAnonymously() {
  const res = await http<AuthResponse>('/api/auth/login/anonymous', {
    method: 'POST',
    skipAuth: true,
  });
  await setAccessToken(res.accessToken);
  useAuthStore.getState().setUser(res.user);
  return res.user;
}

export async function signOut() {
  // Backend clears the refresh_token cookie; ignore failures so the local
  // session always tears down even if the network is unreachable.
  try {
    await http('/api/auth/logout', { method: 'POST' });
  } catch {
    /* noop */
  }
  // Tear down listeners that hold per-user state (IAP, push) — see Task 57.
  try {
    const { shutdownIAP } = await import('@/features/upgrade-to-premium/iap');
    await shutdownIAP();
  } catch {
    /* iap module may not be loaded yet — fine */
  }
  await clearTokens();
  useAuthStore.getState().setUser(null);
  // Purge in-memory + persisted query cache so the next user doesn't see
  // the previous user's accounts/transactions/debts from AsyncStorage.
  queryClient.clear();
}

/** Subscribe to the current user only. Most callers want this. */
export function useUser() {
  return useAuthStore((s) => s.user);
}

/** Subscribe to bootstrap-ready flag only. */
export function useAuthReady() {
  return useAuthStore((s) => s.ready);
}

/**
 * Full auth slice. Avoid in widely-rendered components — prefer
 * `useUser` / `useAuthReady` to keep re-renders scoped.
 */
export function useAuth() {
  const user = useUser();
  const ready = useAuthReady();
  return { user, ready };
}
```

- [x] **Step 2: Вызвать bootstrap из root layout**

Обновить `mobile/app/_layout.tsx`:

```tsx
import '../global.css';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Providers } from '@/app/providers';
import { bootstrapAuth, useAuth } from '@/shared/api/composables/useAuth';
import { View, ActivityIndicator } from 'react-native';

function AppShell() {
  const { ready } = useAuth();
  useEffect(() => { bootstrapAuth(); }, []);
  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
        <ActivityIndicator />
      </View>
    );
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return <Providers><AppShell /></Providers>;
}
```

- [x] **Step 3: Stage + `/code-review`** ⚠️ **security-критичный код (auth bootstrap, token persistence)**

```bash
git add mobile/
# /code-review должен проверить:
# - bootstrap очищает access token при невалидном /api/auth/me ответе (clearTokens в catch)
# - signIn/signUp атомарны: setAccessToken и setUser выполняются последовательно;
#   если http() выбросил — токен не записан, store нетронут
# - signOut очищает: backend cookie (/api/auth/logout), SecureStore (clearTokens),
#   in-memory user (setUser(null)), queryClient.clear() и shutdownIAP (через dynamic import)
# - запросы login/register/anonymous идут на актуальные пути backend'a
#   (/api/auth/login, /api/auth/register, /api/auth/login/anonymous)
# - нет утечек PII (email, accessToken) в логах
```

- [x] **Step 4: Commit**

```bash
git commit -m "feat(mobile): auth store + bootstrap from SecureStore"
```

---

### Task 9: NativeTabs root + auth-protected stack

**Status:** ✅ Done

**Files:**
- Create: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(tabs)/index.tsx` (Dashboard placeholder)
- Create: `mobile/app/(tabs)/history.tsx`
- Create: `mobile/app/(tabs)/analytics.tsx`
- Create: `mobile/app/(tabs)/profile.tsx`
- Create: `mobile/app/auth/_layout.tsx`
- Create: `mobile/app/auth/sign-in.tsx`
- Modify: `mobile/app/_layout.tsx`

- [x] **Step 1: Создать auth guard в root**

```tsx
// mobile/app/_layout.tsx
import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Providers } from '@/app/providers';
import { bootstrapAuth, useAuth } from '@/shared/api/composables/useAuth';
import { View, ActivityIndicator } from 'react-native';

function AppShell() {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => { bootstrapAuth(); }, []);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === 'auth';
    if (!user && !inAuth) router.replace('/auth/sign-in');
    if (user && inAuth) router.replace('/');
  }, [ready, user, segments, router]);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
        <ActivityIndicator />
      </View>
    );
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return <Providers><AppShell /></Providers>;
}
```

- [x] **Step 2: NativeTabs layout** ⚠️ **Reconcile с SDK 55+ compound API**

В SDK 55+ `Icon`/`Label`/`Badge` доступны **только** через compound-pattern `NativeTabs.Trigger.Icon`, а не как отдельные импорты. Старый импорт `import { ..., Icon, Label }` перестанет работать. Также добавляем `md=` prop для Android Material Symbols.

```tsx
// mobile/app/(tabs)/_layout.tsx
import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>Главная</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
        <NativeTabs.Trigger.Label>История</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="analytics">
        <NativeTabs.Trigger.Icon sf="chart.pie.fill" md="pie_chart" />
        <NativeTabs.Trigger.Label>Аналитика</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
        <NativeTabs.Trigger.Label>Профиль</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

> **Если Phase 0 уже закоммичен со старым API** — проверить `mobile/app/(tabs)/_layout.tsx` и при необходимости переписать (отдельный fix-коммит).

- [x] **Step 3: Создать stub-страницы 4 табов**

Для каждой создать одинаковый шаблон (отличается только title):

```tsx
// mobile/app/(tabs)/index.tsx
// Импорты ТОЛЬКО из @/shared/ui/tw — раз НативWind v5 в CSS-first режиме
// className на сырых RN-компонентах не применяется (см. Task 3 Step 7).
import { ScrollView, View, Text } from '@/shared/ui/tw';

export default function DashboardScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background-light dark:bg-background-dark">
      <View className="px-4 py-6">
        <Text className="text-3xl font-bold text-text-light dark:text-text-dark">Главная</Text>
      </View>
    </ScrollView>
  );
}
```

Повторить для `history.tsx` ("История"), `analytics.tsx` ("Аналитика"), `profile.tsx` ("Профиль") — те же импорты из `@/shared/ui/tw`.

- [x] **Step 4: Auth layout + sign-in placeholder**

```tsx
// mobile/app/auth/_layout.tsx
import { Stack } from 'expo-router';
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

```tsx
// mobile/app/auth/sign-in.tsx
import { View, Text, TextInput, Pressable } from '@/shared/ui/tw';
import { useState } from 'react';
import { signIn, signInAnonymously } from '@/shared/api/composables/useAuth';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLoading(true); setError(null);
    try { await signIn(email, password); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ошибка входа'); }
    finally { setLoading(false); }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-background-light dark:bg-background-dark">
      <Text className="text-3xl font-bold mb-6 text-text-light dark:text-text-dark">Вход</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        className="bg-surface-light dark:bg-surface-dark rounded-xl px-4 py-3 mb-3 text-text-light dark:text-text-dark"
      />
      <TextInput
        secureTextEntry
        placeholder="Пароль"
        value={password}
        onChangeText={setPassword}
        className="bg-surface-light dark:bg-surface-dark rounded-xl px-4 py-3 mb-3 text-text-light dark:text-text-dark"
      />
      {error && <Text className="text-danger-light mb-3">{error}</Text>}
      <Pressable
        onPress={onSubmit}
        disabled={loading}
        className="bg-primary-light rounded-xl py-3 items-center mb-3"
      >
        <Text className="text-white font-semibold">{loading ? 'Вход…' : 'Войти'}</Text>
      </Pressable>
      <Pressable onPress={signInAnonymously} className="py-3 items-center">
        <Text className="text-primary-light">Попробовать без аккаунта</Text>
      </Pressable>
    </View>
  );
}
```

- [x] **Step 5: Удалить mobile/app/index.tsx (был smoke-test)**

```bash
rm -f mobile/app/index.tsx
```

- [x] **Step 6: Запустить и проверить**

```bash
cd mobile && npx expo start --clear
```

Expected: видим экран Sign In (user не залогинен), после "Попробовать без аккаунта" — попадаем на 4-табовую навигацию.

- [x] **Step 7: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): NativeTabs + auth guard + sign-in screen"
```

---

### Task 10: Перенос format/date/utils утилит

**Status:** ✅ Done

**Files:**
- Read: `frontend/src/shared/lib/format/*`, `frontend/src/shared/lib/date/*`, `frontend/src/shared/lib/utils.ts`
- Create: `mobile/src/shared/lib/format/index.ts` (+ отдельные файлы)
- Create: `mobile/src/shared/lib/date/index.ts`
- Create: `mobile/src/shared/lib/utils.ts`

- [x] **Step 1: Скопировать чистые функции (нет зависимости от Vue)**

Эти модули из Vue — pure TS, переносятся без правок:

```bash
cp -r frontend/src/shared/lib/format mobile/src/shared/lib/format
cp -r frontend/src/shared/lib/date mobile/src/shared/lib/date
cp frontend/src/shared/lib/utils.ts mobile/src/shared/lib/utils.ts
```

- [x] **Step 2: Проверить, что внутри нет vue-импортов**

```bash
grep -rn "from 'vue'" mobile/src/shared/lib/ || echo "OK — нет vue зависимостей"
```

Если что-то найдётся (например, `ref` в utils) — переписать на нативное (`useState`).

- [x] **Step 3: Verify type-check**

```bash
cd mobile && npx tsc --noEmit
```

- [x] **Step 4: Commit**

```bash
git add mobile/src/shared/lib/
git commit -m "feat(mobile): port pure format/date/utils helpers from frontend"
```

---

### Task 11: Перенос Entity типов и констант

**Status:** ✅ Done

**Files:**
- Read: `frontend/src/entities/*/model/types.ts`, `*/model/constants.ts`
- Create: `mobile/src/entities/*` (по всем 14 entities)

- [x] **Step 1: Скопировать model-папки всех entities**

```bash
for entity in account account-balance budget category currency debt goal person push-subscription quick-action recurring-subscription subscription transaction; do
  mkdir -p mobile/src/entities/$entity
  cp -r frontend/src/entities/$entity/model mobile/src/entities/$entity/model
done
```

- [x] **Step 2: Удалить Vue-специфичные ui подпапки если случайно скопировались**

```bash
find mobile/src/entities -type d -name "ui" -exec rm -rf {} +
```

- [x] **Step 3: Проверить отсутствие vue-импортов**

```bash
grep -rn "from 'vue'" mobile/src/entities/ || echo "OK"
```

- [x] **Step 4: Verify**

```bash
cd mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [x] **Step 5: Commit**

```bash
git add mobile/src/entities/
git commit -m "feat(mobile): port entity types and constants (14 entities)"
```

---

### Task 12: EAS init + dev client + project ID

**Status:** ✅ Done

**Files:**
- Create: `mobile/eas.json`
- Modify: `mobile/app.json`

- [x] **Step 1: Установить eas-cli (если ещё нет)**

```bash
npm install -g eas-cli
eas --version
```

- [x] **Step 2: Логин и init**

```bash
cd mobile
eas login
eas init --id <if-existing> # либо просто `eas init` для нового проекта
```

Это запишет `extra.eas.projectId` в `app.json`.

- [x] **Step 3: Создать eas.json с тремя профилями**

```json
{
  "cli": { "version": ">= 16.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true },
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    },
    "production": {
      "channel": "production",
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

- [x] **Step 4: Установить expo-dev-client**

```bash
npx expo install expo-dev-client
```

- [x] **Step 5: Первый dev build для iOS Simulator**

```bash
eas build --profile development --platform ios --local || eas build --profile development --platform ios
```

> Note: `--local` требует Xcode, иначе строится в EAS Cloud (~10-15 мин).

- [x] **Step 6: Запустить с dev client**

```bash
npx expo start --dev-client
```

- [x] **Step 7: Commit**

```bash
git add mobile/eas.json mobile/app.json
git commit -m "chore(mobile): EAS init + dev client config"
```

---

## Phase 1 — Core read screens (Tasks 13-22)

Dashboard, History (read-only), Accounts list, Profile read-only.

### Task 13: Entity API — useAccounts (read)

**Files:**
- Create: `mobile/src/entities/account/api/accountApi.ts`
- Create: `mobile/src/entities/account/api/queryKeys.ts`
- Create: `mobile/src/entities/account/api/useAccounts.ts`

- [ ] **Step 1: Query keys**

```ts
// mobile/src/entities/account/api/queryKeys.ts
export const accountKeys = {
  all: ['accounts'] as const,
  byUser: (userId: string) => [...accountKeys.all, userId] as const,
  detail: (userId: string, accountId: string) => [...accountKeys.byUser(userId), accountId] as const,
};
```

- [ ] **Step 2: API layer (transformers backend camelCase → frontend snake_case)**

```ts
// mobile/src/entities/account/api/accountApi.ts
import { http } from '@/shared/api/http';
import type { Account } from '@/entities/account/model/types';

interface AccountBackend {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  accountType: string;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

function transformAccount(b: AccountBackend): Account {
  return {
    id: b.id,
    name: b.name,
    icon: b.icon,
    color: b.color,
    account_type: b.accountType as Account['account_type'],
    is_hidden: b.isHidden,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
  };
}

export const accountApi = {
  list: async (): Promise<Account[]> => {
    const data = await http<AccountBackend[]>('/api/accounts');
    return data.map(transformAccount);
  },
};
```

- [ ] **Step 3: Hook**

```ts
// mobile/src/entities/account/api/useAccounts.ts
import { useQuery } from '@tanstack/react-query';
import { accountApi } from './accountApi';
import { accountKeys } from './queryKeys';

export function useAccounts(userId: string | null) {
  return useQuery({
    queryKey: userId ? accountKeys.byUser(userId) : accountKeys.all,
    queryFn: accountApi.list,
    enabled: !!userId,
  });
}
```

- [ ] **Step 4: Verify**

```bash
cd mobile && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add mobile/src/entities/account/api/
git commit -m "feat(mobile): useAccounts hook with backend transform"
```

---

### Task 14: useTransactions (last 50) + useInfiniteTransactions

**Files:**
- Create: `mobile/src/entities/transaction/api/transactionApi.ts`
- Create: `mobile/src/entities/transaction/api/queryKeys.ts`
- Create: `mobile/src/entities/transaction/api/useTransactions.ts`
- Create: `mobile/src/entities/transaction/api/useInfiniteTransactions.ts`

- [ ] **Step 1: Скопировать структуру из Vue и адаптировать**

Прочитать `frontend/src/entities/transaction/api/` — там 4 файла.

- [ ] **Step 2: queryKeys**

```ts
// mobile/src/entities/transaction/api/queryKeys.ts
export const transactionKeys = {
  all: ['transactions'] as const,
  list: (userId: string) => [...transactionKeys.all, 'list', userId] as const,
  infinite: (userId: string, filters?: Record<string, unknown>) =>
    [...transactionKeys.all, 'infinite', userId, filters ?? {}] as const,
  byAccount: (userId: string, accountId: string) =>
    [...transactionKeys.all, 'account', userId, accountId] as const,
  recent: (userId: string, limit: number) =>
    [...transactionKeys.all, 'recent', userId, limit] as const,
};
```

- [ ] **Step 3: API + transformer**

```ts
// mobile/src/entities/transaction/api/transactionApi.ts
import { http } from '@/shared/api/http';
import type { Transaction } from '@/entities/transaction/model/types';

interface CursorPage<T> {
  items: T[];
  nextCursor: { date: string; createdAt: string } | null;
}

interface TransactionBackend {
  id: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer';
  categoryId: string;
  accountId: string;
  date: string;
  note: string | null;
  hashtags: string[];
  sourceTransactionId: string | null;
  createdAt: string;
}

// Frontend uses snake_case (Vue parity); backend speaks camelCase.
export interface CreateTransactionInput {
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer';
  category_id: string;
  account_id: string;
  date: string;
  note: string | null;
  hashtags?: string[];
  source_transaction_id?: string | null;
}

function transform(b: TransactionBackend): Transaction {
  return {
    id: b.id,
    amount: b.amount,
    currency: b.currency,
    type: b.type,
    category_id: b.categoryId,
    account_id: b.accountId,
    date: b.date,
    note: b.note,
    hashtags: b.hashtags,
    source_transaction_id: b.sourceTransactionId,
    created_at: b.createdAt,
  };
}

// Write-side mapper — snake_case → camelCase для backend.
function toBackend(i: CreateTransactionInput) {
  return {
    amount: i.amount,
    currency: i.currency,
    type: i.type,
    categoryId: i.category_id,
    accountId: i.account_id,
    date: i.date,
    note: i.note,
    hashtags: i.hashtags ?? [],
    sourceTransactionId: i.source_transaction_id ?? null,
  };
}

export const transactionApi = {
  list: async (): Promise<Transaction[]> => {
    const data = await http<TransactionBackend[]>('/api/transactions?limit=50');
    return data.map(transform);
  },
  infinite: async (
    cursor?: { date: string; createdAt: string },
    pageSize = 20,
    filters?: Record<string, string>
  ): Promise<{ items: Transaction[]; nextCursor: typeof cursor | null }> => {
    const params = new URLSearchParams({ limit: String(pageSize), ...(filters ?? {}) });
    if (cursor) { params.set('cursorDate', cursor.date); params.set('cursorCreatedAt', cursor.createdAt); }
    const data = await http<CursorPage<TransactionBackend>>(`/api/transactions/infinite?${params}`);
    return { items: data.items.map(transform), nextCursor: data.nextCursor };
  },
  create: async (input: CreateTransactionInput): Promise<Transaction> => {
    const data = await http<TransactionBackend>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(toBackend(input)),
    });
    return transform(data);
  },
};
```

- [ ] **Step 4: useTransactions hook**

```ts
// mobile/src/entities/transaction/api/useTransactions.ts
import { useQuery } from '@tanstack/react-query';
import { transactionApi } from './transactionApi';
import { transactionKeys } from './queryKeys';

export function useTransactions(userId: string | null) {
  return useQuery({
    queryKey: userId ? transactionKeys.list(userId) : transactionKeys.all,
    queryFn: transactionApi.list,
    enabled: !!userId,
  });
}
```

- [ ] **Step 5: useInfiniteTransactions hook**

```ts
// mobile/src/entities/transaction/api/useInfiniteTransactions.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { transactionApi } from './transactionApi';
import { transactionKeys } from './queryKeys';

const PAGE_SIZE = 20;

export function useInfiniteTransactions(userId: string | null, filters?: Record<string, string>) {
  return useInfiniteQuery({
    queryKey: userId ? transactionKeys.infinite(userId, filters) : transactionKeys.all,
    queryFn: ({ pageParam }) => transactionApi.infinite(pageParam, PAGE_SIZE, filters),
    initialPageParam: undefined as { date: string; createdAt: string } | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!userId,
  });
}
```

- [ ] **Step 6: Verify**

```bash
cd mobile && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add mobile/src/entities/transaction/api/
git commit -m "feat(mobile): useTransactions + useInfiniteTransactions hooks"
```

---

### Task 15: shared/ui Button + Card + Input + Spinner

**Files:**
- Create: `mobile/src/shared/ui/button.tsx`
- Create: `mobile/src/shared/ui/card.tsx`
- Create: `mobile/src/shared/ui/input.tsx`
- Create: `mobile/src/shared/ui/spinner.tsx`
- Create: `mobile/src/shared/ui/index.ts`

- [ ] **Step 1: cn() утилита (если ещё не было)**

Если в `mobile/src/shared/lib/utils.ts` нет — добавить:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

- [ ] **Step 2: Button**

```tsx
// mobile/src/shared/ui/button.tsx
import { Pressable, Text } from '@/shared/ui/tw';
import type { PressableProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const buttonVariants = cva('rounded-xl items-center justify-center', {
  variants: {
    variant: {
      primary: 'bg-primary-light',
      secondary: 'bg-surface-light dark:bg-surface-dark',
      danger: 'bg-danger-light',
      ghost: 'bg-transparent',
    },
    size: {
      sm: 'px-3 py-2',
      md: 'px-4 py-3',
      lg: 'px-6 py-4',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

const textVariants = cva('font-semibold', {
  variants: {
    variant: {
      primary: 'text-white',
      secondary: 'text-text-light dark:text-text-dark',
      danger: 'text-white',
      ghost: 'text-primary-light',
    },
  },
  defaultVariants: { variant: 'primary' },
});

type Props = PressableProps & VariantProps<typeof buttonVariants> & { title: string; className?: string };

export function Button({ title, variant, size, className, disabled, ...props }: Props) {
  return (
    <Pressable
      disabled={disabled}
      className={cn(buttonVariants({ variant, size }), disabled && 'opacity-50', className)}
      {...props}
    >
      <Text className={textVariants({ variant })}>{title}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 3: Card**

```tsx
// mobile/src/shared/ui/card.tsx
import { View } from '@/shared/ui/tw';
import type { ViewProps } from 'react-native';
import { cn } from '@/shared/lib/utils';

export function Card({ className, style, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn('bg-surface-light dark:bg-surface-dark rounded-2xl p-4', className)}
      style={[{ borderCurve: 'continuous', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }, style]}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Input**

```tsx
// mobile/src/shared/ui/input.tsx
import { TextInput } from '@/shared/ui/tw';
import type { TextInputProps } from 'react-native';
import { cn } from '@/shared/lib/utils';

export function Input({ className, ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      placeholderTextColor="#9CA3AF"
      className={cn(
        'bg-surface-light dark:bg-surface-dark rounded-xl px-4 py-3 text-text-light dark:text-text-dark',
        className
      )}
      style={{ borderCurve: 'continuous' }}
      {...props}
    />
  );
}
```

- [ ] **Step 5: Spinner**

```tsx
// mobile/src/shared/ui/spinner.tsx
import { ActivityIndicator, type ActivityIndicatorProps } from 'react-native';
export function Spinner(props: ActivityIndicatorProps) { return <ActivityIndicator {...props} />; }
```

- [ ] **Step 6: Barrel index**

```ts
// mobile/src/shared/ui/index.ts
export * from './button';
export * from './card';
export * from './input';
export * from './spinner';
```

- [ ] **Step 7: Commit**

```bash
git add mobile/src/shared/
git commit -m "feat(mobile): shared/ui — Button, Card, Input, Spinner"
```

---

### Task 16: BalanceCard widget (read-only)

**Files:**
- Read: `frontend/src/widgets/balance-card/`
- Create: `mobile/src/widgets/balance-card/BalanceCard.tsx`
- Create: `mobile/src/widgets/balance-card/index.ts`
- Create: `mobile/src/entities/account-balance/api/useAccountBalances.ts` (если нет)

- [ ] **Step 1: API для balances (если ещё нет)**

```ts
// mobile/src/entities/account-balance/api/useAccountBalances.ts
import { useQuery } from '@tanstack/react-query';
import { http } from '@/shared/api/http';

interface BalanceByCurrency { currency: string; total: number }

export function useAccountBalances(userId: string | null) {
  return useQuery({
    queryKey: ['account-balances', userId],
    queryFn: () => http<BalanceByCurrency[]>('/api/accounts/balances'),
    enabled: !!userId,
  });
}
```

- [ ] **Step 2: BalanceCard**

```tsx
// mobile/src/widgets/balance-card/BalanceCard.tsx
import { View, Text } from 'react-native';
import { Card, Spinner } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format';
import { useAccountBalances } from '@/entities/account-balance/api/useAccountBalances';
import { useAuth } from '@/shared/api/composables/useAuth';

export function BalanceCard() {
  const { user } = useAuth();
  const { data, isLoading } = useAccountBalances(user?.id ?? null);

  if (isLoading) return <Card><Spinner /></Card>;

  return (
    <Card className="bg-primary-light">
      <Text className="text-white/70 text-sm">Общий баланс</Text>
      {data?.map((b) => (
        <Text key={b.currency} className="text-white text-4xl font-bold" style={{ fontVariant: ['tabular-nums'] }}>
          {formatCurrency(b.total, b.currency)}
        </Text>
      ))}
    </Card>
  );
}
```

- [ ] **Step 3: Barrel**

```ts
// mobile/src/widgets/balance-card/index.ts
export { BalanceCard } from './BalanceCard';
```

- [ ] **Step 4: Подключить на Dashboard**

```tsx
// mobile/app/(tabs)/index.tsx
import { ScrollView, View } from 'react-native';
import { BalanceCard } from '@/widgets/balance-card';

export default function DashboardScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background-light dark:bg-background-dark">
      <View className="px-4 py-6 gap-4">
        <BalanceCard />
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 5: Verify в Expo Go**

```bash
cd mobile && npx expo start --clear
```

Expected: на Dashboard видим синюю карточку с балансом.

- [ ] **Step 6: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): BalanceCard widget + useAccountBalances"
```

---

### Task 17-19: AccountStack, RecentTransactions, SaveSpendSection widgets

Каждый виджет — отдельная задача. Шаблон:

**Task 17 — AccountStack:**
- Read `frontend/src/widgets/account-stack/`
- Создать `mobile/src/widgets/account-stack/AccountStack.tsx` — горизонтальный `<ScrollView horizontal>` с `<AccountCard>` (из entities/account/ui).
- Создать `mobile/src/entities/account/ui/AccountCard.tsx` — карточка одного счёта.
- Подключить на Dashboard.
- Commit.

**Task 18 — RecentTransactions:**
- Read `frontend/src/widgets/recent-transactions/`
- Создать `mobile/src/widgets/recent-transactions/RecentTransactions.tsx` — `<FlashList>` с последними 5.
- Создать `mobile/src/entities/transaction/ui/TransactionItem.tsx`.
- Хук `useRecentTransactions(userId, limit=5)`.
- Commit.

**Task 19 — SaveSpendSection:**
- Месячная статистика income/expense.
- Хук `useMonthlyStats(userId, { year, month })`.
- Создать `mobile/src/widgets/save-spend-section/SaveSpendSection.tsx`.
- Commit.

> Каждый виджет — отдельный TDD-цикл: type-check + smoke в Expo Go.

---

### Task 20: HistoryPage с FlashList и group-by-date

**Files:**
- Modify: `mobile/app/(tabs)/history.tsx`
- Create: `mobile/src/shared/lib/hooks/useGroupedTransactions.ts`

- [ ] **Step 1: useGroupedTransactions hook**

```ts
// mobile/src/shared/lib/hooks/useGroupedTransactions.ts
import { useMemo } from 'react';
import type { Transaction } from '@/entities/transaction/model/types';
import { formatDateGroup } from '@/shared/lib/format';

export interface TransactionGroup { title: string; data: Transaction[] }

export function useGroupedTransactions(transactions: Transaction[]): TransactionGroup[] {
  return useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const key = tx.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return Array.from(map.entries()).map(([date, data]) => ({
      title: formatDateGroup(date),
      data,
    }));
  }, [transactions]);
}
```

- [ ] **Step 2: HistoryPage**

```tsx
// mobile/app/(tabs)/history.tsx
import { SectionList, View, Text } from 'react-native';
import { useInfiniteTransactions } from '@/entities/transaction/api/useInfiniteTransactions';
import { useAuth } from '@/shared/api/composables/useAuth';
import { TransactionItem } from '@/entities/transaction/ui/TransactionItem';
import { useGroupedTransactions } from '@/shared/lib/hooks/useGroupedTransactions';
import { Spinner } from '@/shared/ui';

export default function HistoryScreen() {
  const { user } = useAuth();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteTransactions(user?.id ?? null);
  const allTxs = data?.pages.flatMap((p) => p.items) ?? [];
  const sections = useGroupedTransactions(allTxs);

  return (
    <SectionList
      contentInsetAdjustmentBehavior="automatic"
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <TransactionItem transaction={item} />}
      renderSectionHeader={({ section }) => (
        <View className="bg-background-light dark:bg-background-dark px-4 py-2">
          <Text className="text-sm text-text-muted-light dark:text-text-muted-dark font-medium">{section.title}</Text>
        </View>
      )}
      onEndReached={() => hasNextPage && fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <Spinner /> : null}
      stickySectionHeadersEnabled
    />
  );
}
```

- [ ] **Step 3: Verify**

```bash
cd mobile && npx expo start --clear
```

- [ ] **Step 4: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): HistoryPage with infinite scroll + grouped sections"
```

---

### Task 21: AccountsPage (list + detail)

**Files:**
- Create: `mobile/app/accounts/index.tsx`
- Create: `mobile/app/accounts/[id].tsx`
- Create: `mobile/src/entities/transaction/api/useInfiniteAccountTransactions.ts`

- [ ] **Step 1: Accounts list**

```tsx
// mobile/app/accounts/index.tsx
import { FlatList } from 'react-native';
import { Pressable } from '@/shared/ui/tw';
import { Link, Stack } from 'expo-router';
import { useAccounts } from '@/entities/account/api/useAccounts';
import { useAuth } from '@/shared/api/composables/useAuth';
import { AccountCard } from '@/entities/account/ui/AccountCard';

export default function AccountsScreen() {
  const { user } = useAuth();
  const { data } = useAccounts(user?.id ?? null);
  return (
    <>
      <Stack.Screen options={{ title: 'Счета', headerLargeTitle: true }} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={data ?? []}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          // Link asChild требует ребёнка, принимающего onPress + forwardRef —
          // raw <View> молча игнорирует onPress, тап не сработает.
          <Link href={`/accounts/${item.id}`} asChild>
            <Pressable className="px-4 py-2">
              <AccountCard account={item} />
            </Pressable>
          </Link>
        )}
      />
    </>
  );
}
```

- [ ] **Step 2: Account detail (с фильтрованным списком транзакций)**

```tsx
// mobile/app/accounts/[id].tsx
import { useLocalSearchParams, Stack } from 'expo-router';
import { SectionList, View, Text } from 'react-native';
import { useAccounts } from '@/entities/account/api/useAccounts';
import { useAuth } from '@/shared/api/composables/useAuth';
import { useInfiniteAccountTransactions } from '@/entities/transaction/api/useInfiniteAccountTransactions';
import { TransactionItem } from '@/entities/transaction/ui/TransactionItem';
import { useGroupedTransactions } from '@/shared/lib/hooks/useGroupedTransactions';

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: accounts } = useAccounts(user?.id ?? null);
  const account = accounts?.find((a) => a.id === id);
  const { data, fetchNextPage, hasNextPage } = useInfiniteAccountTransactions(user?.id ?? null, id);
  const allTxs = data?.pages.flatMap((p) => p.items) ?? [];
  const sections = useGroupedTransactions(allTxs);

  return (
    <>
      <Stack.Screen options={{ title: account?.name ?? 'Счёт' }} />
      <SectionList
        contentInsetAdjustmentBehavior="automatic"
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionItem transaction={item} />}
        renderSectionHeader={({ section }) => (
          <View className="bg-background-light dark:bg-background-dark px-4 py-2">
            <Text className="text-sm font-medium">{section.title}</Text>
          </View>
        )}
        onEndReached={() => hasNextPage && fetchNextPage()}
        stickySectionHeadersEnabled
      />
    </>
  );
}
```

- [ ] **Step 3: useInfiniteAccountTransactions**

Аналогично useInfiniteTransactions, но с фильтром `accountId` в `filters`. Передаётся через `transactionApi.infinite(..., { accountId })`.

- [ ] **Step 4: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): AccountsPage list + AccountDetailPage with infinite tx"
```

---

### Task 21a: useProfile composable

Профиль (currency, defaultAccountId, hasCompletedOnboarding, displayName) хранится отдельно от auth-токена — нужен hook до `Task 22` (sign-out читает sub-плана) и до `Task 27` (AddTransaction берёт `defaultAccountId` / `currency` оттуда).

**Files:**
- Create: `mobile/src/shared/api/composables/useProfile.ts`

- [ ] **Step 1: Hook**

```ts
// mobile/src/shared/api/composables/useProfile.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/shared/api/http';

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  currency: string;
  defaultAccountId: string | null;
  hasCompletedOnboarding: boolean;
  isDemo: boolean;
}

const profileKeys = {
  byUser: (userId: string) => ['profile', userId] as const,
};

async function fetchProfile(): Promise<Profile> {
  return http<Profile>('/api/profiles/me');
}

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: profileKeys.byUser(userId ?? '__anon__'),
    queryFn: fetchProfile,
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSetCurrency(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (currency: string) =>
      http<Profile>('/api/profiles/me/currency', {
        method: 'PATCH',
        body: JSON.stringify({ currency }),
      }),
    onSuccess: (next) => {
      if (userId) qc.setQueryData(profileKeys.byUser(userId), next);
    },
  });
}

export function useCompleteOnboarding(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      http<Profile>('/api/profiles/me/onboarding', { method: 'PATCH' }),
    onSuccess: (next) => {
      if (userId) qc.setQueryData(profileKeys.byUser(userId), next);
    },
  });
}
```

- [ ] **Step 2: Verify**

```bash
cd mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/shared/api/composables/useProfile.ts
git commit -m "feat(mobile): useProfile + setCurrency + completeOnboarding"
```

---

### Task 22: Profile (read-only) + sign-out

**Files:**
- Modify: `mobile/app/(tabs)/profile.tsx`
- Create: `mobile/src/entities/subscription/api/useSubscription.ts`

- [ ] **Step 1: useSubscription hook (read-only часть)**

```ts
// mobile/src/entities/subscription/api/useSubscription.ts
import { useQuery } from '@tanstack/react-query';
import { http } from '@/shared/api/http';

export interface SubscriptionStatus {
  plan: string;
  status: string;
  isPremium: boolean;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export function useSubscription(userId: string | null) {
  return useQuery({
    queryKey: ['subscription', userId],
    queryFn: () => http<SubscriptionStatus>('/api/subscription/status'),
    enabled: !!userId,
  });
}
```

- [ ] **Step 2: ProfilePage**

```tsx
// mobile/app/(tabs)/profile.tsx
import { ScrollView, View, Text } from 'react-native';
import { useAuth, signOut } from '@/shared/api/composables/useAuth';
import { useSubscription } from '@/entities/subscription/api/useSubscription';
import { Card, Button } from '@/shared/ui';

export default function ProfileScreen() {
  const { user } = useAuth();
  const { data: sub } = useSubscription(user?.id ?? null);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background-light dark:bg-background-dark">
      <View className="px-4 py-6 gap-4">
        <Text className="text-3xl font-bold text-text-light dark:text-text-dark">Профиль</Text>

        <Card>
          <Text className="text-sm text-text-muted-light dark:text-text-muted-dark">Email</Text>
          <Text className="text-base text-text-light dark:text-text-dark">{user?.email ?? 'Анонимный'}</Text>
        </Card>

        <Card>
          <Text className="text-sm text-text-muted-light dark:text-text-muted-dark">Подписка</Text>
          <Text className="text-base text-text-light dark:text-text-dark">{sub?.plan ?? 'Free'}</Text>
        </Card>

        <Button title="Выйти" variant="danger" onPress={signOut} />
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): ProfilePage read-only + sign-out"
```

---

## Phase 2 — Core mutations (Tasks 23-32)

AddTransaction, AdjustBalance, CreateAccount, EditTransaction, CategoryPicker.

### Task 23: Invalidation helpers + mutation patterns

**Files:**
- Create: `mobile/src/shared/api/invalidation.ts`

- [ ] **Step 1: Invalidation utility**

```ts
// mobile/src/shared/api/invalidation.ts
// Vue parity: frontend/src/shared/api/invalidation.ts.
// Любая мутация транзакции инвалидирует ВСЕ зависимые срезы кэша:
// list, infinite, recent, search, count, monthly, daily, analytics,
// hashtags, budget. Уже одна забытая ветка — и пользователь видит
// устаревшую аналитику или дублирующиеся транзакции в поиске.
import { queryClient } from '@/app/providers';
import { transactionKeys } from '@/entities/transaction/api/queryKeys';
import { accountKeys } from '@/entities/account/api/queryKeys';

export function invalidateTransactionRelated() {
  queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  queryClient.invalidateQueries({ queryKey: ['transactions', 'infinite'] });
  queryClient.invalidateQueries({ queryKey: ['transactions', 'recent'] });
  queryClient.invalidateQueries({ queryKey: ['transactions', 'search'] });
  queryClient.invalidateQueries({ queryKey: ['transactions', 'count'] });
  queryClient.invalidateQueries({ queryKey: ['transactions', 'account'] });
  queryClient.invalidateQueries({ queryKey: ['monthly-stats'] });
  queryClient.invalidateQueries({ queryKey: ['daily-stats'] });
  queryClient.invalidateQueries({ queryKey: ['analytics-stats'] });
  queryClient.invalidateQueries({ queryKey: ['hashtags'] });
  queryClient.invalidateQueries({ queryKey: ['budget'] });
  queryClient.invalidateQueries({ queryKey: accountKeys.all });
  queryClient.invalidateQueries({ queryKey: ['account-balances'] });
}

export function invalidateAccountRelated() {
  queryClient.invalidateQueries({ queryKey: accountKeys.all });
  queryClient.invalidateQueries({ queryKey: ['account-balances'] });
  queryClient.invalidateQueries({ queryKey: ['monthly-stats'] });
}

export function invalidateDebtRelated() {
  // Debt — supersеt transaction: долги влияют на транзакции, балансы, аналитику.
  queryClient.invalidateQueries({ queryKey: ['debts'] });
  invalidateTransactionRelated();
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/shared/api/invalidation.ts
git commit -m "feat(mobile): cache invalidation helpers"
```

---

### Task 24-26: useCreateTransaction, useUpdateTransaction, useDeleteTransaction

Каждый — отдельная задача с TDD-циклом. Шаблон для **Task 24 (Create)**:

- [ ] **Step 1: `create` уже определён в `transactionApi` (Task 14)**

Тип `CreateTransactionInput` и mapper `toBackend(input)` — там же. Если расширяешь форму (например, добавляешь поле `tags`), правь оба интерфейса (`CreateTransactionInput` + `toBackend`) одновременно.

- [ ] **Step 2: useCreateTransaction hook**

```ts
// mobile/src/entities/transaction/api/useCreateTransaction.ts
import { useMutation } from '@tanstack/react-query';
import { transactionApi } from './transactionApi';
import { invalidateTransactionRelated } from '@/shared/api/invalidation';

export function useCreateTransaction() {
  return useMutation({
    mutationFn: transactionApi.create,
    onSuccess: () => invalidateTransactionRelated(),
  });
}
```

- [ ] **Step 3: Stage + `/code-review`** ⚠️ **mutation код — следить за optimistic updates и invalidation**

```bash
git add mobile/src/entities/transaction/api/
# /code-review проверяет:
# - вызывается ли invalidateTransactionRelated (а не голый invalidateQueries — иначе balance/monthly-stats не обновятся)
# - onError откатывает optimistic update (если он был)
# - mutationFn не возвращает stale data (transform отрабатывает)
# - type safety: input ровно CreateTransactionInput, response — Transaction
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): useCreateTransaction mutation"
```

Аналогично для Update и Delete (Tasks 25, 26) — каждый со своим `/code-review` циклом перед commit.

---

### Task 27: AddTransactionPage (formSheet)

**Files:**
- Create: `mobile/app/transactions/new.tsx`
- Create: `mobile/src/features/add-transaction/TransactionForm.tsx`
- Create: `mobile/src/features/add-transaction/HeroAmount.tsx`
- Modify: `mobile/app/_layout.tsx` (Stack.Screen для модалки)

- [ ] **Step 1: Зарегистрировать модальный экран**

```tsx
// в mobile/app/_layout.tsx, внутри Stack:
<Stack.Screen
  name="transactions/new"
  options={{
    presentation: 'formSheet',
    sheetGrabberVisible: true,
    sheetAllowedDetents: [0.75, 1.0],
    title: 'Новая транзакция',
  }}
/>
```

- [ ] **Step 2: HeroAmount (большой numeric input)**

```tsx
// mobile/src/features/add-transaction/HeroAmount.tsx
import { TextInput, View, Text } from '@/shared/ui/tw';

interface Props { value: string; onChange: (v: string) => void; currency: string }

// iOS decimal-pad на ru-RU локали выдаёт запятую как разделитель,
// на en-US — точку. Нормализуем оба в `.`, чтобы Number(v) парсилось
// корректно. Также защищаемся от двух точек подряд (`1..5` → `1.5`).
function normalizeAmount(input: string): string {
  const replaced = input.replace(',', '.').replace(/[^\d.]/g, '');
  const firstDot = replaced.indexOf('.');
  if (firstDot === -1) return replaced;
  return replaced.slice(0, firstDot + 1) + replaced.slice(firstDot + 1).replace(/\./g, '');
}

export function HeroAmount({ value, onChange, currency }: Props) {
  return (
    <View className="items-center py-6">
      <View className="flex-row items-baseline gap-2">
        <TextInput
          value={value}
          onChangeText={(t) => onChange(normalizeAmount(t))}
          keyboardType="decimal-pad"
          placeholder="0"
          className="text-6xl font-bold text-text-light dark:text-text-dark min-w-[120px] text-center"
          style={{ fontVariant: ['tabular-nums'] }}
        />
        <Text className="text-2xl text-text-muted-light">{currency}</Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: TransactionForm (react-hook-form)**

```tsx
// mobile/src/features/add-transaction/TransactionForm.tsx
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from '@/shared/ui/tw';
import { Button, Input } from '@/shared/ui';
import { HeroAmount } from './HeroAmount';
import { useCreateTransaction } from '@/entities/transaction/api/useCreateTransaction';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

const schema = z.object({
  amount: z.string().min(1).refine((v) => Number(v) > 0, 'Сумма > 0'),
  type: z.enum(['income', 'expense']),
  categoryId: z.string().min(1),
  accountId: z.string().min(1),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props { defaultAccountId: string; defaultCurrency: string }

export function TransactionForm({ defaultAccountId, defaultCurrency }: Props) {
  const { control, handleSubmit, formState: { isValid } } = useForm<FormValues>({
    // `onChange` обязателен — иначе formState.isValid не пересчитывается до
    // первого submit, и кнопка "Сохранить" остаётся disabled на всё время
    // заполнения формы.
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: { amount: '', type: 'expense', categoryId: '', accountId: defaultAccountId, note: '' },
  });
  const create = useCreateTransaction();

  const onSubmit = handleSubmit(async (values) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // CreateTransactionInput: см. Task 14 transactionApi.ts
    await create.mutateAsync({
      amount: Number(values.amount),
      currency: defaultCurrency,
      type: values.type,
      category_id: values.categoryId,
      account_id: values.accountId,
      note: values.note ?? null,
      date: new Date().toISOString(),
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  });

  return (
    <View className="flex-1 px-4 gap-4">
      <Controller
        control={control}
        name="amount"
        render={({ field }) => <HeroAmount value={field.value} onChange={field.onChange} currency={defaultCurrency} />}
      />
      <Controller
        control={control}
        name="note"
        render={({ field }) => (
          <Input placeholder="Заметка" value={field.value ?? ''} onChangeText={field.onChange} />
        )}
      />
      {/* Здесь: CategoryPicker, AccountSelector, TypeToggle — в отдельных задачах */}
      <Button title="Сохранить" onPress={onSubmit} disabled={!isValid || create.isPending} />
    </View>
  );
}
```

- [ ] **Step 4: Route**

```tsx
// mobile/app/transactions/new.tsx
import { useAuth } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { TransactionForm } from '@/features/add-transaction/TransactionForm';

export default function NewTransactionScreen() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id ?? null);
  if (!profile?.defaultAccountId || !profile?.currency) return null;
  return <TransactionForm defaultAccountId={profile.defaultAccountId} defaultCurrency={profile.currency} />;
}
```

- [ ] **Step 5: Кнопка "+" на Dashboard для открытия модалки**

```tsx
// Внутри mobile/app/(tabs)/index.tsx — добавить:
<Link href="/transactions/new" asChild>
  <Pressable className="bg-primary-light rounded-full w-14 h-14 items-center justify-center">
    <Text className="text-white text-3xl">+</Text>
  </Pressable>
</Link>
```

- [ ] **Step 6: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): AddTransaction formSheet + react-hook-form + zod"
```

---

### Task 28: CategoryPicker (Expo UI SwiftUI grid)

**Files:**
- Create: `mobile/src/features/add-transaction/CategoryPicker.tsx`

- [ ] **Step 1: Установить @expo/ui если ещё не**

```bash
cd mobile && npx expo install @expo/ui
```

- [ ] **Step 2: CategoryPicker (NativeWind grid 4-колоночный)**

```tsx
// mobile/src/features/add-transaction/CategoryPicker.tsx
import { View, Pressable, Text } from 'react-native';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/entities/category/model/constants';
import { Icon } from '@/shared/ui/icon';

interface Props { type: 'income' | 'expense'; value: string; onChange: (id: string) => void }

export function CategoryPicker({ type, value, onChange }: Props) {
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return (
    <View className="flex-row flex-wrap gap-3">
      {cats.map((cat) => {
        const selected = value === cat.id;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onChange(cat.id)}
            className={`w-[22%] aspect-square items-center justify-center rounded-2xl ${selected ? 'bg-primary-light' : 'bg-surface-light dark:bg-surface-dark'}`}
            style={{ borderCurve: 'continuous' }}
          >
            <Icon name={cat.icon} size={24} color={selected ? 'white' : undefined} />
            <Text className={`text-xs mt-1 ${selected ? 'text-white' : 'text-text-light dark:text-text-dark'}`}>{cat.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 3: Подключить в TransactionForm через Controller**
- [ ] **Step 4: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): CategoryPicker for AddTransaction"
```

---

### Task 29-32: AccountSelector, AdjustBalance, CreateAccount, EditTransaction

Каждая фича — отдельная задача со своим Form + mutation hook + route. Структура идентична Task 27.

- **Task 29** — `AccountSelector` компонент (горизонтальный scroll, выбранный имеет border-primary).
- **Task 30** — `app/accounts/[id]/adjust.tsx` + `useAdjustBalance` мутация (создаёт adjustment-транзакцию).
- **Task 31** — `app/accounts/new.tsx` + форма (name, icon, color, type, currency) + `useCreateAccount`.
- **Task 32** — `app/transactions/[id]/edit.tsx` + переиспользует TransactionForm с initialValues.

---

## Phase 3 — Domain features (Tasks 33-50)

Debts, Goals, Reminders, Budget, Subscriptions, Analytics, Categories management.

### Task 33: Debts API + useInfiniteDebts (group-by-person)

**Files:**
- Create: `mobile/src/entities/debt/api/debtApi.ts`
- Create: `mobile/src/entities/debt/api/queryKeys.ts`
- Create: `mobile/src/entities/debt/api/useDebts.ts`
- Create: `mobile/src/entities/debt/api/useInfiniteDebts.ts`

Аналогично transactions. Cursor: `{ personName, debtType, createdAt }`, PAGE_SIZE = 10, группы НЕ разбиваются.

### Task 34: Debts list page

`mobile/app/debts/index.tsx` — SectionList по `personName + debtType`, фильтры (status, currency, personName) через `headerSearchBarOptions`.

### Task 35: Debt detail + close debt

`mobile/app/debts/[id].tsx` + `useCloseDebt` мутация + `useInvalidateDebtRelated`.

### Task 36: Partial payment

`mobile/src/features/partial-payment/PartialPaymentSheet.tsx` — bottom sheet с суммой + кнопка save.

### Task 37: Add debt + edit debt

`mobile/app/debts/new.tsx`, `mobile/app/debts/[id]/edit.tsx`.

### Task 38: Split expense (1 транзакция + N долгов)

`mobile/src/features/split-expense/SplitExpenseForm.tsx`. **Критично:** сохранять транзакцию первой, потом долги через `source_transaction_id`. Использовать `invalidateDebtRelated`.

⚠️ **Обязательный `/code-review` перед commit** — последовательность мутаций критична для целостности данных:

- Если транзакция создалась, а долги упали — это «сирота» в БД: транзакция без своих долгов. Reviewer должен проверить, что есть либо rollback (удаление транзакции при падении долгов), либо явный warning в UI с возможностью retry.
- `source_transaction_id` действительно проставляется в каждом долге.
- `invalidateDebtRelated` (не `invalidateDebts`) — иначе balance/recent-transactions не обновятся.
- Optimistic update на split — не делать (слишком сложно откатить, лучше показывать spinner).

### Task 39: Goals (CRUD + GoalCard + GoalsSection widget)

Аналогично debts. Хуки `useGoals`, `useCreateGoal`, etc.

### Task 40: Reminders (CRUD)

`mobile/src/entities/reminder/`, фильтры active/upcoming/overdue.

### Task 41: Budget

`useBudget`, `set-budget` фича.

### Task 42: Subscriptions (recurring) — list + detail

`mobile/app/subscriptions/index.tsx`, `mobile/app/subscriptions/[id].tsx`.

### Task 43: Analytics page + DonutChart

```bash
cd mobile && npm install victory-native react-native-svg
npx expo install react-native-svg
```

`mobile/app/(tabs)/analytics.tsx` + `mobile/src/widgets/analytics/DonutChart.tsx` (victory-native VictoryPie).

### Task 44: Analytics filters (date range + accounts + mode)

`mobile/src/features/analytics-filters/AnalyticsFilters.tsx` — period picker через Expo UI DateTimePicker.

### Task 45: Daily stats + TopCategories + SavingsGauge widgets

Три виджета на analytics page.

### Task 46-48: Categories CRUD + reorder + custom

- `useCategories` + drag-to-reorder через `react-native-draggable-flatlist`.

### Task 49: Currency settings page

`mobile/app/settings/currency.tsx` — список из `CURRENCIES`, выбор → `useProfile().setCurrency`.

### Task 50: CSV Import (Money Lover format)

```bash
cd mobile && npx expo install expo-document-picker expo-file-system
```

`mobile/app/settings/import.tsx` + `mobile/src/features/import-data/MoneyLoverImport.tsx` — выбор файла → `papaparse` (переносим `parseMoneyLoverCsv` 1:1) → bulk-create transactions через batch endpoint.

---

## Phase 4 — Native MVP features (Tasks 51-62)

### Task 51: expo-haptics — useHaptics hook

**Files:**
- Create: `mobile/src/shared/lib/haptics/useHaptics.ts`

```ts
// mobile/src/shared/lib/haptics/useHaptics.ts
import * as Haptics from 'expo-haptics';

type Pattern = 'selection' | 'success' | 'error' | 'warning' | 'light';

export function trigger(pattern: Pattern) {
  switch (pattern) {
    case 'selection': return Haptics.selectionAsync();
    case 'success': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'error': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    case 'warning': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'light': return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export function useHaptics() { return { trigger }; }
```

Заменить все вызовы `Haptics.impactAsync(...)` в коде на `useHaptics().trigger(...)`.

### Task 52: Swipeable transaction items (RNGH)

`mobile/src/entities/transaction/ui/TransactionItem.tsx` — обернуть в `<Swipeable>` с правой кнопкой "удалить".

### Task 53: expo-notifications setup + config plugin

```bash
cd mobile && npx expo install expo-notifications expo-constants
```

**Files:**
- Modify: `mobile/app.config.ts`

```ts
// mobile/app.config.ts (или app.json — расширить плагином)
export default {
  expo: {
    name: 'Finance',
    slug: 'finance-app',
    scheme: 'finance',
    ios: {
      bundleIdentifier: 'com.hamkor.finance',
      usesAppleSignIn: false,
    },
    android: {
      package: 'com.hamkor.finance',
    },
    plugins: [
      'expo-router',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#0A84FF',
        },
      ],
    ],
  },
};
```

### Task 54: Push registration flow + backend integration

**Files:**
- Create: `mobile/src/features/manage-push-notifications/registerForPush.ts`

```ts
// mobile/src/features/manage-push-notifications/registerForPush.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { http } from '@/shared/api/http';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const result = await Notifications.requestPermissionsAsync();
    status = result.status;
  }
  if (status !== 'granted') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await http('/api/notifications/register-device', {
    method: 'POST',
    body: JSON.stringify({ token, platform: Platform.OS }),
  });
  return token;
}
```

Вызвать из `bootstrapAuth` после успешного логина (с silent failure если permission denied).

⚠️ **`/code-review` перед commit:**
- Permission flow корректен (existing → request → grant check) — не запрашиваем повторно если уже granted.
- Silent failure не маскирует баги — хотя бы в dev mode warning в console.
- `projectId` fallback (expoConfig → easConfig) рабочий и не молчит при отсутствии обоих.
- Регистрация token идемпотентна на backend (повторный POST с тем же токеном не дублирует строку — Task 55 это обеспечивает).

### Task 55: Backend — endpoint POST /api/notifications/register-device

**Files:**
- Modify: `backend/src/modules/identity/...`

- [ ] **Step 1:** Создать ORM entity `push_devices` (id, userId, token, platform, createdAt). Unique constraint на `(userId, token)` чтобы повторные регистрации не плодили строк.
- [ ] **Step 2:** Регистрация в `data-source.ts` + `app.module.ts` (см. CLAUDE.md «TypeORM entity registration» gotcha — два места!).
- [ ] **Step 3:** Migration.
- [ ] **Step 4:** Controller + command handler. Endpoint защищён JWT (не `@Public()`).
- [ ] **Step 5:** Тест (unit на handler + e2e на endpoint).
- [ ] **Step 6:** Stage + `/code-review`** ⚠️ **backend security/data-integrity критично**

```bash
git add backend/src/modules/identity/ backend/src/database/migrations/
# /code-review проверяет:
# - JWT guard на endpoint (нет утечки чужих токенов в чужой userId)
# - upsert семантика (повторный register не падает с unique constraint)
# - валидация platform enum (только ios/android, не любая строка)
# - migration реверсируется
# - нет logging токена в plaintext
```

- [ ] **Step 7: Commit.**

### Task 56: Camera screen (expo-camera v17)

```bash
cd mobile && npx expo install expo-camera expo-image-picker expo-image-manipulator
```

**Files:**
- Create: `mobile/app/scan-receipt.tsx`
- Create: `mobile/src/features/scan-receipt/CameraView.tsx`
- Create: `mobile/src/features/scan-receipt/processImage.ts`

```tsx
// mobile/app/scan-receipt.tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Linking } from 'react-native';
import { View, Pressable, Text } from '@/shared/ui/tw';
import { router } from 'expo-router';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { http } from '@/shared/api/http';

interface ReceiptScanResponse {
  amount?: string;
  currency?: string;
  category_id?: string;
  note?: string;
}

export default function ScanReceiptScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  if (!permission) return null;
  if (!permission.granted) {
    // После "Don't Allow" canAskAgain === false — requestPermission молча
    // вернёт прежнее состояние. Открываем настройки приложения.
    const onRequest = permission.canAskAgain
      ? requestPermission
      : () => Linking.openSettings();
    return (
      <View className="flex-1 items-center justify-center px-6 bg-background-light dark:bg-background-dark">
        <Text className="text-text-light dark:text-text-dark text-center mb-4">
          Нужен доступ к камере для сканирования чеков
        </Text>
        <Pressable onPress={onRequest} className="bg-primary-light rounded-xl px-6 py-3">
          <Text className="text-white">
            {permission.canAskAgain ? 'Разрешить' : 'Открыть настройки'}
          </Text>
        </Pressable>
      </View>
    );
  }

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
      if (!photo) return;
      const resized = await manipulateAsync(
        photo.uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: SaveFormat.JPEG },
      );
      const form = new FormData();
      // RN допускает { uri, type, name } для FormData entries — приведение
      // через `as unknown as Blob` лучше, чем `as never` (сохраняет тип FormData).
      form.append('image', { uri: resized.uri, type: 'image/jpeg', name: 'receipt.jpg' } as unknown as Blob);
      // http() автоматически: ставит API_URL, JWT Authorization,
      // НЕ инжектит Content-Type (FormData ставит multipart boundary сам).
      const parsed = await http<ReceiptScanResponse>('/api/receipt/scan', {
        method: 'POST',
        body: form,
      });
      router.replace({ pathname: '/transactions/new', params: parsed as Record<string, string> });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1">
      <CameraView ref={cameraRef} style={{ flex: 1 }} />
      <Pressable
        onPress={capture}
        className="absolute bottom-12 self-center bg-white w-20 h-20 rounded-full"
        disabled={busy}
      />
    </View>
  );
}
```

⚠️ **`/code-review` перед commit — verify:**

- Все запросы идут через `http()`, который **детектит FormData** (Task 7) и НЕ инжектит `Content-Type: application/json` поверх multipart boundary.
- При SDK 56 `expo/fetch` теперь default — на FormData upload могут быть отличия от node `fetch`. Если падает — `EXPO_PUBLIC_USE_RN_FETCH=1`.
- `permission.canAskAgain === false` после denied — открываем Settings через `Linking.openSettings()` (уже в коде).
- Quality 0.7 + resize до 1280px → размер ~200-400KB. Если backend OCR timeout — поднять до 0.85.
- `setBusy(false)` в `finally` — гарантия, что shutter-кнопка не залипает на network-ошибке.
- Cleanup tempfile (`photo.uri`, `resized.uri`) после upload не критичен (OS сама), но для долго живущей сессии — стоит.

### Task 57: IAP setup (expo-iap 2.9 → openiap)

> **SDK 56 caveat:** Репозиторий `hyochan/expo-iap` **архивирован 26 апреля 2026**, разработка переехала в OpenIAP monorepo. Действующих преемника два:
> - **`expo-iap` 2.9.x** — последняя опубликованная версия, всё ещё работает на SDK 56, поддерживает `useIAP` hook и OpenIAP-терминологию (`fetchProducts`/`requestPurchase({ request })`).
> - **`react-native-iap` (Nitro Modules)** — новейший унифицированный API от того же автора, рекомендуется для green-field. Установка тяжелее (Nitro), но API стабильнее на длинной дистанции.
>
> На MVP берём **expo-iap 2.9.x** (миграция тривиальная, документация совпадает). К Phase 6 / пост-релизу — переоценить и при необходимости свапнуть на `react-native-iap` через контрактный слой `iap.ts` (см. spec §5 «Риски»).

```bash
cd mobile && npx expo install expo-iap
```

**Files:**
- Modify: `mobile/app.config.ts` (добавить plugin)
- Create: `mobile/src/features/upgrade-to-premium/iap.ts`

```ts
// mobile/src/features/upgrade-to-premium/iap.ts
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type ProductPurchase,
} from 'expo-iap';
import { Platform } from 'react-native';
import { http } from '@/shared/api/http';

const SKU_MONTHLY = 'finance_premium_monthly';
const SKU_YEARLY = 'finance_premium_yearly';

export const IAP_SUBS_SKUS = [SKU_MONTHLY, SKU_YEARLY];

let updateSub: { remove: () => void } | null = null;
let errorSub: { remove: () => void } | null = null;
let initialized = false;

export async function initIAP() {
  // Idempotency: HMR, re-login, повторный mount провайдера могут вызвать
  // initIAP дважды. Без guard'а старые listener'ы остаются в памяти и
  // verifyOnServer + finishTransaction срабатывают N раз на одну покупку.
  if (initialized) return;
  initialized = true;

  await initConnection();
  updateSub = purchaseUpdatedListener(async (purchase: ProductPurchase) => {
    try {
      await verifyOnServer(purchase);
      await finishTransaction({ purchase, isConsumable: false });
    } catch (err) {
      // Не финишируем при сбое валидации — стор повторит событие.
      console.warn('IAP verify failed', err);
    }
  });
  errorSub = purchaseErrorListener((err) => { console.warn('IAP error', err); });
}

export async function listSubscriptions() {
  return fetchProducts({ skus: IAP_SUBS_SKUS, type: 'subs' });
}

export async function buy(sku: string) {
  return requestPurchase({ request: { sku } });
}

async function verifyOnServer(purchase: ProductPurchase) {
  await http('/api/subscription/iap/verify-receipt', {
    method: 'POST',
    body: JSON.stringify({
      platform: Platform.OS,
      productId: purchase.id,
      transactionReceipt: purchase.transactionReceipt,
      purchaseTokenAndroid: 'purchaseTokenAndroid' in purchase ? purchase.purchaseTokenAndroid : undefined,
      packageNameAndroid: 'packageNameAndroid' in purchase ? purchase.packageNameAndroid : undefined,
    }),
  });
}

export async function shutdownIAP() {
  if (!initialized) return;
  updateSub?.remove(); updateSub = null;
  errorSub?.remove(); errorSub = null;
  try {
    await endConnection();
  } finally {
    initialized = false;
  }
}
```

> **Wiring (важно):**
> - `initIAP()` вызывается из `bootstrapAuth()` (Task 8) **после** успешного `setUser` — иначе `verifyOnServer` отправит receipt без JWT.
> - `shutdownIAP()` уже подцеплен внутри `signOut()` (Task 8) — динамический import избегает циклической зависимости `iap.ts ↔ useAuth.ts`.
> - На `AppState 'background'` / `'inactive'` shutdown НЕ вызываем — встроенные listener'ы должны переживать backgrounding, чтобы корректно завершать pending purchases при возврате в foreground.

> **Альтернатива через `useIAP()` hook** (компонентный путь, OpenIAP-style):
>
> ```tsx
> const { connected, subscriptions, requestProducts, requestPurchase, finishTransaction } = useIAP();
> ```
>
> Hook сам управляет lifecycle, подписками и хранит `currentPurchase` в state — удобно внутри `PremiumUpgradeModal` (Task 58).

⚠️ **`/code-review` перед commit — критически важно (платежи, receipt forgery, race conditions):**

- `finishTransaction` вызывается **только после** успешной server-side валидации (`verifyOnServer`). Иначе пользователь получит премиум без оплаты при подделанном чеке.
- При сбое `verifyOnServer` — НЕ финишируем транзакцию (стор повторит событие на следующем launch — корректно).
- Listener'ы (`updateSub`, `errorSub`) удаляются в `shutdownIAP` — иначе утечка subscribers при hot reload / re-login.
- Нет логов с raw `transactionReceipt` (PII / commercial sensitive).
- SKU константы совпадают точь-в-точь с product IDs в App Store Connect / Google Play (Task 75).

### Task 58: PremiumUpgradeModal + IAP UI

`mobile/src/features/upgrade-to-premium/PremiumUpgradeModal.tsx` — Bottom sheet с двумя кнопками (monthly, yearly), цены из `listProducts()`.

### Task 59: Backend — IAP receipt validation endpoints

**Files:**
- Modify: `backend/src/modules/subscription/`

- [ ] Endpoint `POST /api/subscription/iap/verify-receipt` — валидация чека через App Store Server API (для iOS) и Google Play Developer API (для Android).
- [ ] Endpoint `POST /api/subscription/iap/webhooks/apple` — App Store Server Notifications V2 (JWS verify).
- [ ] Endpoint `POST /api/subscription/iap/webhooks/google` — RTDN (Pub/Sub push).
- [ ] Расширить `subscription.entity`: `source`, `original_transaction_id`, `app_account_token`.
- [ ] Migration.

⚠️ **Обязательный `/code-review` перед commit — самое security-критичное место всего приложения:**

- **Webhooks `@Public()` + cryptographic verify** — Apple JWS подпись через App Store root CA, Google RTDN через Pub/Sub OIDC token. Без проверки подписи любой может активировать премиум POST'ом.
- **`verify-receipt` НЕ доверяет клиентскому `productId`** — берёт его из ответа App Store / Google Play API, иначе клиент может купить $0.99 SKU и активировать $99 годовой.
- **Идемпотентность** — повторный webhook с тем же `original_transaction_id` не дублирует активацию (UNIQUE constraint или upsert).
- **Дедупликация LemonSqueezy vs IAP** — пользователь не должен иметь две активные подписки из разных источников. Спека §5: «Унифицировать на уровне `SubscriptionService.activatePremium({ source, externalId, periodEnd })`».
- **App-Specific Shared Secret + Google service account** — НЕ в коде, только в env. Логирование секретов запрещено.
- **Migration** реверсируется + покрывает существующих LemonSqueezy-подписчиков (`source = 'lemonsqueezy'` default).

- [ ] Commit.

### Task 60: usePremiumFeature gate

`mobile/src/features/upgrade-to-premium/usePremiumFeature.ts` — Zustand store с `showUpgradeModal()`, `requirePremium(name)`.

### Task 61: Push subscription endpoint mapping (Vue parity)

Запись/удаление push-токена на backend при login/logout. Используется `useEffect` в `bootstrapAuth`.

### Task 62: EAS Update setup

```bash
cd mobile && npx expo install expo-updates
eas update:configure
```

В `app.config.ts`:

```ts
updates: { url: `https://u.expo.dev/${PROJECT_ID}` },
runtimeVersion: { policy: 'fingerprint' },
```

> **SDK 56 caveat:** `appVersion` policy чревата mismatch'ами, если забыл бампнуть version при изменении нативки. **`fingerprint`** (через `@expo/fingerprint`) автоматически хеширует всё, что влияет на нативный runtime, и предотвращает поломку OTA — это текущая рекомендация Expo для SDK 56. Доступные политики: `appVersion`, `nativeVersion`, `fingerprint` (политика `sdkVersion` больше не документирована).

GitHub Action для publish OTA на push в main:

```yaml
# .github/workflows/eas-update.yml
on: { push: { branches: [main] } }
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
        with: { eas-version: latest, token: ${{ secrets.EXPO_TOKEN }} }
      - run: cd mobile && eas update --channel production --message "${{ github.event.head_commit.message }}"
```

⚠️ **`/code-review` перед commit — OTA на main = моментальный production rollout, ошибки потом сложно откатить:**

- Workflow триггерится на push в `main`, а не на feature/* — иначе случайный push раскатает половину команды в прод.
- `EXPO_TOKEN` в GitHub secrets, не hardcoded.
- Channel `production` соответствует EAS Build `production` profile (eas.json, Task 12) — иначе update полетит мимо stores-билдов.
- Подумать про staged rollout (`--rollout-percentage 10` для первых часов) — особенно для первых OTA после релиза.
- `runtimeVersion: fingerprint` гарантирует, что JS update НЕ полетит на бинарник с другим нативом — но если на main меняется зависимость с native modules, нужно сначала EAS Build, потом EAS Update. Documented в commit message workflow.
- В рамках Task 62 — добавить `if: ${{ !contains(github.event.head_commit.message, '[skip-ota]') }}` чтобы можно было пушить без раската.

---

## Phase 5 — Polish & QA (Tasks 63-72)

### Task 63: Reanimated entering/exiting на cards и list items

Использовать `Animated.View` с `entering={FadeIn}`, `exiting={FadeOut}`, `layout={LinearTransition}` для smooth добавления/удаления.

### Task 64: Pull-to-refresh на Dashboard, History, Accounts

```tsx
<ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />} />
```

### Task 65: Accessibility audit (VoiceOver, TalkBack)

Все `<Pressable>` → `accessibilityLabel`, `accessibilityRole="button"`. Counters → `accessibilityLabel="Баланс 1 234 рубля"`.

### Task 66: Dark mode toggle

`mobile/src/features/toggle-theme/ThemeToggle.tsx` + Zustand store + `Appearance` API. NativeWind поддерживает dark: классы через colorScheme.

### Task 67: Toast system (sonner-native)

```bash
cd mobile && npm install sonner-native
```

Заменить любые in-app notification на `<Toaster />` в `_layout` + `toast.success(...)`.

### Task 68: Skeleton loaders

`mobile/src/shared/ui/skeleton.tsx` — pulsing placeholder для balance, account cards, transaction items.

### Task 69: Error boundary + Sentry

```bash
cd mobile && npx expo install sentry-expo @sentry/react-native
```

Plugin в app.config.ts, init в `_layout.tsx`. Wrap root в Sentry ErrorBoundary.

### Task 70: Analytics / event tracking

Простой `track(event, props)` в `shared/lib/analytics.ts` (PostHog или Amplitude RN SDK). Минимум: app_open, sign_in, transaction_created, premium_purchased.

### Task 71: Splash + icons + brand assets

- `mobile/assets/splash.png` (1284x2778)
- `mobile/assets/icon.png` (1024x1024)
- `mobile/assets/adaptive-icon.png` (1024x1024, Android)
- Прописать в `app.config.ts`:

```ts
icon: './assets/icon.png',
splash: { image: './assets/splash.png', backgroundColor: '#FFFFFF' },
android: { adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#0A84FF' } },
```

### Task 72: Dogfood — TestFlight + Internal Testing build

```bash
eas build --profile preview --platform all
eas submit --profile production --platform ios --latest # → TestFlight
eas submit --profile production --platform android --latest # → Internal Testing track
```

---

## Phase 6 — Store submission (Tasks 73-80)

### Task 73: App Store Connect metadata

В App Store Connect:
- Privacy policy URL (обязательно)
- App Privacy questionnaire (camera, notifications, IAP, contact info)
- Screenshots 6.7", 6.5", 5.5" (fastlane snapshot или вручную)
- App description (ru, en)
- Keywords, support URL

### Task 74: Google Play Console metadata

- Data safety form
- Privacy policy URL
- Content rating questionnaire
- Screenshots phone + tablet (если iPad/tablet — но мы в скоупе только phone)
- Short + full description

### Task 75: IAP products в App Store Connect + Google Play

- iOS: создать 2 auto-renewable subscriptions в одной группе (Premium): monthly + yearly с правильными product IDs (`finance_premium_monthly`, `finance_premium_yearly`).
- Android: создать 2 subscriptions в Google Play Console с теми же ID.
- App Store: subscription localizations, review notes, **App-Specific Shared Secret** (для backend verify-receipt).
- Google Play: **service account JSON** для backend verify через Google Play Developer API.
- Сохранить ключи в `backend/.env.production`.

### Task 76: TestFlight + Closed Testing rollout

- Внутренний TestFlight (до 100 testers без review).
- Внешний — до 10k testers, требует Beta App Review (~24h).
- Google Play Closed Testing track.

### Task 77: App Store Review submission

- Submit build из EAS → "Submit for Review" в App Store Connect.
- Прикрепить demo account (email + password) для review team.
- Указать, что приложение работает без аккаунта (anonymous flow).
- Ожидание ~24-48h.

### Task 78: Google Play Production submission

- Из Closed Testing → Promote to Production.
- 1-day to 7-day review.

### Task 79: Monitoring post-launch

- Sentry dashboard: error rate.
- App Store Connect: crash reports, ratings.
- Google Play: ANR rate, crash-free %.
- Backend metrics: `/api/notifications/register-device` rate (должен соответствовать installs), IAP verify success rate.

### Task 80: Post-launch retro

- Документ `docs/superpowers/retro-2026-XX-XX-mobile-launch.md`: что прошло хорошо, что плохо, что отложили на Phase 7.

---

## Self-Review (выполняется после написания плана)

### 1. Spec coverage

| Spec раздел | Tasks |
|---|---|
| §2 Архитектура / стек | Tasks 1-12 (Phase 0) |
| §3.1 Pages — 16 страниц | Tasks 9, 16, 20-22, 27, 30-32, 34-35, 37, 42-43, 49-50, 56 |
| §3.2 Widgets — 14 виджетов | Tasks 16-19, 43, 45 |
| §3.3 Features — 31 фич | Tasks 27-32, 36, 38, 41, 44, 46-48, 50, 58, 60, 66-67 |
| §3.4 Entities — 14 entities | Task 11 (типы) + Tasks 13-14, 22, 33, 39-42 (api) |
| §3.5 shared/ui | Tasks 15, 67, 68 |
| §3.6 Composables → Hooks | Tasks 7, 8, 22, 51 |
| §4 Phase 0-6 | Все 80 tasks |
| §5 Risks | Митигации встроены: NativeTabs за фасадом (Task 9), IAP контракт (Task 57), Tailwind аудит (Task 4) |
| §6 Testing | Maestro (Task 72), Jest на отдельные хуки (не выделен — добавлять inline по мере роста) |
| §7 Out of scope | iPad / Watch / Apple Pay — корректно НЕ упомянуты в tasks |
| §8 Success criteria | Tasks 72-80 (build, submit, monitor) |

### 2. Placeholder scan

- ✅ Нет "TBD" / "TODO" / "implement later"
- ✅ Tasks 17-19, 25-26, 29-32, 36-50 — описаны как **шаблонные дельты** к ранее показанному паттерну (Task 27, 33), что соответствует DRY: повторение кода уже показанного — лишний шум.
- ⚠️ Tasks 33-50 — короткие описания. Для реализации каждой потребуется развернуть аналогично Tasks 13-14 и 27 (TDD-цикл, файлы, код). При выполнении плана subagent должен использовать паттерны из Phase 0-2 как референс.

### 3. Type consistency

- ✅ `User`, `Transaction`, `Account` интерфейсы определены в Tasks 8, 14, 13 — используются согласованно.
- ✅ `transactionKeys`, `accountKeys`, `debtKeys` фабрики query keys согласованы (Tasks 13, 14, 33).
- ✅ `invalidateTransactionRelated` / `invalidateDebtRelated` (Task 23) переиспользуются всюду.
- ✅ `cn()` — единая утилита (Task 10/15).

### 4. Сжатость в Phase 3-6

Tasks 33-80 написаны компактно осознанно — каждый из них при исполнении должен раскрываться в полноценный TDD-цикл по шаблону из Phase 0-2 (write test → fail → implement → pass → commit). Если выбран subagent-driven подход — каждая task будет уточняться отдельным subagent'ом с примерами кода из Tasks 13-32.

---

## Total estimate

- **80 tasks**.
- **Phase 0** (foundation): ~1.5 недели.
- **Phase 1** (read screens): ~2 недели.
- **Phase 2** (mutations): ~2.5 недели.
- **Phase 3** (domain features): ~4 недели — самая объёмная фаза.
- **Phase 4** (native MVP): ~2.5 недели.
- **Phase 5** (polish): ~2 недели.
- **Phase 6** (submission): ~1-2 недели + ожидание review.

**Итого: ~15-17 недель solo / 8-10 недель в паре.**
