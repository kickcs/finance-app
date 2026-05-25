# Vue → Expo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Поэтапно мигрировать Vue 3 PWA `finance-app` на Expo SDK 56 для публикации нативных приложений в App Store и Google Play.

**Architecture:** Greenfield rewrite в новом root-каталоге `mobile/` параллельно с действующим `frontend/` (Vue PWA продолжает работать в проде). Vue фичи переносятся 1:1 с сохранением FSD-структуры. Стек: Expo SDK 56, RN 0.81, React 19, Expo Router 6, NativeWind v5 + Expo UI, TanStack Query v5, react-native-reanimated 4, expo-iap (IAP), expo-notifications (push), expo-camera (OCR).

**Tech Stack:** Expo SDK 56, React Native 0.81, React 19, TypeScript 5.7, Expo Router 6, NativeWind v5 + react-native-css, react-native-reusables, @tanstack/react-query, Zustand, react-hook-form + zod, expo-secure-store, @react-native-async-storage/async-storage, react-native-reanimated 4, react-native-gesture-handler, expo-haptics, expo-notifications, expo-camera, expo-image-picker, expo-image, expo-iap, @shopify/flash-list, victory-native, papaparse, EAS Build + Submit + Update.

---

## Progress

| Phase | Tasks | Status |
|---|---|---|
| Phase 0 — Foundation | 1-12 | ✅ Done (branch `feature/mobile-migration`) |
| Phase 1 — Core read screens | 13-22 | ⏳ Pending |
| Phase 2 — Core mutations | 23-32 | ⏳ Pending |
| Phase 3 — Domain features | 33-50 | ⏳ Pending |
| Phase 4 — Native MVP | 51-62 | ⏳ Pending |
| Phase 5 — Polish & QA | 63-72 | ⏳ Pending |
| Phase 6 — Store submission | 73-80 | ⏳ Pending |

When picking up a phase: mark task header with `**Status:** 🚧 In progress`, flip step checkboxes from `- [ ]` to `- [x]` as each step lands, set header to `**Status:** ✅ Done` once committed. Keep the table above in sync.

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

### Task 3: NativeWind v5 + Tailwind config

**Status:** ✅ Done

**Files:**
- Create: `mobile/global.css`
- Create: `mobile/tailwind.config.js`
- Create: `mobile/metro.config.js`
- Create: `mobile/babel.config.js`
- Modify: `mobile/app/_layout.tsx`

- [x] **Step 1: Установить зависимости**

```bash
cd mobile
npx expo install nativewind react-native-reanimated react-native-safe-area-context
npm install -D tailwindcss@^4 @tailwindcss/postcss
```

- [x] **Step 2: Создать tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Перенесено из frontend/src/app/styles/index.css @theme block
        'background-light': '#FFFFFF',
        'background-dark': '#0A0A0A',
        'surface-light': '#F4F4F5',
        'surface-dark': '#1C1C1E',
        'primary-light': '#007AFF',
        'primary-dark': '#0A84FF',
        // ... остальные токены из DESIGN_SYSTEM.md
      },
      fontFamily: {
        sans: ['Inter'],
      },
    },
  },
};
```

> **Note:** Полный список токенов скопировать из `frontend/src/app/styles/index.css` блок `@theme`. Список должен совпадать 1:1.

- [x] **Step 3: Создать global.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [x] **Step 4: Создать metro.config.js**

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: './global.css' });
```

- [x] **Step 5: Создать babel.config.js**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

- [x] **Step 6: Подключить global.css в root layout**

Заменить `mobile/app/_layout.tsx`:

```tsx
import '../global.css';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [x] **Step 7: Создать smoke-test page**

```bash
cat > mobile/app/index.tsx <<'EOF'
import { View, Text } from 'react-native';

export default function Home() {
  return (
    <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
      <Text className="text-2xl font-bold text-primary-light">NativeWind works</Text>
    </View>
  );
}
EOF
```

- [x] **Step 8: Проверить запуск в Expo Go**

```bash
cd mobile && npx expo start --clear
```

Expected: на телефоне — синий жирный текст "NativeWind works" по центру.

- [x] **Step 9: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): NativeWind v5 + design tokens from frontend/"
```

---

### Task 4: Design tokens — портировать полный @theme из Vue

**Status:** ✅ Done

**Files:**
- Read: `frontend/src/app/styles/index.css`
- Modify: `mobile/tailwind.config.js`
- Create: `mobile/src/shared/config/colors.ts`

- [x] **Step 1: Прочитать текущие токены**

```bash
cat frontend/src/app/styles/index.css | sed -n '/@theme/,/^}/p'
```

- [x] **Step 2: Скопировать ВСЕ цвета (background, surface, text, primary, secondary, success, warning, danger, accent) и radius из @theme в `tailwind.config.js` под `theme.extend.colors` и `borderRadius`**

```js
// tailwind.config.js — после копирования будет ~50-80 цветов
colors: {
  'background-light': '#...',
  'background-dark': '#...',
  // ... (полный список из index.css)
}
```

- [x] **Step 3: Перенести `ENTITY_COLORS` из frontend/src/shared/config/colors.ts**

```bash
cp frontend/src/shared/config/colors.ts mobile/src/shared/config/colors.ts
```

Внутри файла — TS-объекты, не зависят от Vue, переносятся без изменений.

- [x] **Step 4: Verify**

```bash
cd mobile && npx tsc --noEmit
```

- [x] **Step 5: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): port design tokens and ENTITY_COLORS from frontend"
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
npm install @tanstack/react-query @tanstack/query-async-storage-persister @tanstack/query-persist-client-core zustand react-hook-form zod @hookform/resolvers
```

- [x] **Step 3: Установить UI и анимации**

```bash
npx expo install react-native-gesture-handler react-native-reanimated expo-image expo-haptics expo-blur
npm install class-variance-authority clsx tailwind-merge @shopify/flash-list
```

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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
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

persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 60 * 24 * 7,
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
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
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'finance.accessToken',
  REFRESH_TOKEN: 'finance.refreshToken',
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
    const refresh = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refresh) return null;
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) {
      await clearTokens();
      return null;
    }
    const { accessToken, refreshToken } = await res.json();
    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    return accessToken;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function setTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
}

type RequestOptions = RequestInit & { skipAuth?: boolean };

export async function http<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = opts;
  const token = skipAuth ? null : await getAccessToken();
  const doRequest = async (authToken: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
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
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  const ct = res.headers.get('content-type');
  return (ct?.includes('application/json') ? res.json() : (res.text() as unknown)) as Promise<T>;
}
```

- [x] **Step 4: Verify type-check**

```bash
cd mobile && npx tsc --noEmit
```

- [x] **Step 5: Commit**

```bash
git add mobile/src/shared/ mobile/.env.local mobile/.gitignore
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
import * as SecureStore from 'expo-secure-store';
import { http, setTokens, clearTokens } from '@/shared/api/http';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

export interface User {
  id: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  onboardingCompleted: boolean;
  currency: string | null;
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

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export async function bootstrapAuth() {
  const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
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
  const res = await http<AuthResponse>('/api/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
  await setTokens(res.accessToken, res.refreshToken);
  useAuthStore.getState().setUser(res.user);
  return res.user;
}

export async function signUp(email: string, password: string) {
  const res = await http<AuthResponse>('/api/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
  await setTokens(res.accessToken, res.refreshToken);
  useAuthStore.getState().setUser(res.user);
  return res.user;
}

export async function signInAnonymously() {
  const res = await http<AuthResponse>('/api/auth/anonymous', {
    method: 'POST',
    skipAuth: true,
  });
  await setTokens(res.accessToken, res.refreshToken);
  useAuthStore.getState().setUser(res.user);
  return res.user;
}

export async function signOut() {
  await clearTokens();
  useAuthStore.getState().setUser(null);
}

export function useAuth() {
  return useAuthStore();
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

- [x] **Step 3: Commit**

```bash
git add mobile/
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

- [x] **Step 2: NativeTabs layout**

```tsx
// mobile/app/(tabs)/_layout.tsx
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf="house.fill" />
        <Label>Главная</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Icon sf="list.bullet" />
        <Label>История</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="analytics">
        <Icon sf="chart.pie.fill" />
        <Label>Аналитика</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf="person.crop.circle" />
        <Label>Профиль</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

- [x] **Step 3: Создать stub-страницы 4 табов**

Для каждой создать одинаковый шаблон (отличается только title):

```tsx
// mobile/app/(tabs)/index.tsx
import { ScrollView, View, Text } from 'react-native';

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

Повторить для `history.tsx` ("История"), `analytics.tsx` ("Аналитика"), `profile.tsx` ("Профиль").

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
import { View, Text, TextInput, Pressable } from 'react-native';
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
import { Pressable, Text, type PressableProps } from 'react-native';
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
import { View, type ViewProps } from 'react-native';
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
import { TextInput, type TextInputProps } from 'react-native';
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
import { FlatList, View } from 'react-native';
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
          <Link href={`/accounts/${item.id}`} asChild>
            <View className="px-4 py-2">
              <AccountCard account={item} />
            </View>
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
import { queryClient } from '@/app/providers';
import { transactionKeys } from '@/entities/transaction/api/queryKeys';
import { accountKeys } from '@/entities/account/api/queryKeys';

export function invalidateTransactionRelated() {
  queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  queryClient.invalidateQueries({ queryKey: accountKeys.all });
  queryClient.invalidateQueries({ queryKey: ['account-balances'] });
  queryClient.invalidateQueries({ queryKey: ['monthly-stats'] });
}

export function invalidateAccountRelated() {
  queryClient.invalidateQueries({ queryKey: accountKeys.all });
  queryClient.invalidateQueries({ queryKey: ['account-balances'] });
}

export function invalidateDebtRelated() {
  queryClient.invalidateQueries({ queryKey: ['debts'] });
  queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  queryClient.invalidateQueries({ queryKey: accountKeys.all });
  queryClient.invalidateQueries({ queryKey: ['account-balances'] });
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

- [ ] **Step 1: Extend transactionApi**

```ts
// добавить в mobile/src/entities/transaction/api/transactionApi.ts
create: async (input: CreateTransactionInput): Promise<Transaction> => {
  const data = await http<TransactionBackend>('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(toBackend(input)),
  });
  return transform(data);
},
```

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

- [ ] **Step 3: Commit**

Аналогично для Update и Delete (Tasks 25, 26).

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
import { TextInput, View, Text } from 'react-native';

interface Props { value: string; onChange: (v: string) => void; currency: string }

export function HeroAmount({ value, onChange, currency }: Props) {
  return (
    <View className="items-center py-6">
      <View className="flex-row items-baseline gap-2">
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^\d.]/g, ''))}
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
import { View } from 'react-native';
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
  const { control, handleSubmit, watch, formState: { isValid } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', type: 'expense', categoryId: '', accountId: defaultAccountId, note: '' },
  });
  const create = useCreateTransaction();

  const onSubmit = handleSubmit(async (values) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

### Task 55: Backend — endpoint POST /api/notifications/register-device

**Files:**
- Modify: `backend/src/modules/identity/...`

- [ ] **Step 1:** Создать ORM entity `push_devices` (id, userId, token, platform, createdAt).
- [ ] **Step 2:** Регистрация в `data-source.ts` + `app.module.ts`.
- [ ] **Step 3:** Migration.
- [ ] **Step 4:** Controller + command handler.
- [ ] **Step 5:** Тест.
- [ ] **Step 6:** Commit.

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
import { View, Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { http } from '@/shared/api/http';

export default function ScanReceiptScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-text-light text-center mb-4">Нужен доступ к камере для сканирования чеков</Text>
        <Pressable onPress={requestPermission} className="bg-primary-light rounded-xl px-6 py-3">
          <Text className="text-white">Разрешить</Text>
        </Pressable>
      </View>
    );
  }

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
    if (!photo) { setBusy(false); return; }
    const resized = await manipulateAsync(photo.uri, [{ resize: { width: 1280 } }], { compress: 0.7, format: SaveFormat.JPEG });
    const form = new FormData();
    form.append('image', { uri: resized.uri, type: 'image/jpeg', name: 'receipt.jpg' } as never);
    const result = await fetch('/api/receipt/scan', { method: 'POST', body: form });
    const parsed = await result.json();
    router.replace({ pathname: '/transactions/new', params: parsed });
    setBusy(false);
  };

  return (
    <View className="flex-1">
      <CameraView ref={cameraRef} style={{ flex: 1 }} />
      <Pressable onPress={capture} className="absolute bottom-12 self-center bg-white w-20 h-20 rounded-full" disabled={busy} />
    </View>
  );
}
```

### Task 57: expo-iap setup

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
  getProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Purchase,
} from 'expo-iap';
import { Platform } from 'react-native';
import { http } from '@/shared/api/http';

const SKU_MONTHLY = Platform.select({ ios: 'finance_premium_monthly', android: 'finance_premium_monthly' })!;
const SKU_YEARLY = Platform.select({ ios: 'finance_premium_yearly', android: 'finance_premium_yearly' })!;

export const IAP_SKUS = [SKU_MONTHLY, SKU_YEARLY];

export async function initIAP() {
  await initConnection();
  purchaseUpdatedListener(async (purchase: Purchase) => {
    await verifyOnServer(purchase);
    await finishTransaction({ purchase, isConsumable: false });
  });
  purchaseErrorListener((err) => { console.warn('IAP error', err); });
}

export async function listProducts() {
  return getProducts(IAP_SKUS);
}

export async function purchase(sku: string) {
  return requestPurchase({ sku });
}

async function verifyOnServer(purchase: Purchase) {
  await http('/api/subscription/iap/verify-receipt', {
    method: 'POST',
    body: JSON.stringify({
      platform: Platform.OS,
      productId: purchase.productId,
      transactionReceipt: purchase.transactionReceipt,
      purchaseToken: 'purchaseToken' in purchase ? purchase.purchaseToken : undefined,
    }),
  });
}

export async function shutdownIAP() { await endConnection(); }
```

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
runtimeVersion: { policy: 'appVersion' },
```

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
