# Vue → Expo Migration Design

**Date**: 2026-05-25
**Status**: Draft (awaiting user review)
**Author**: Generated via /goal brainstorming session

---

## 1. Цель и контекст

Перенести существующее финтех-приложение `finance-app` (Vue 3 PWA, ~32k LOC, FSD) на **Expo SDK 56** для публикации нативных приложений в **App Store** и **Google Play**.

**Ключевые решения, зафиксированные с пользователем:**

| Решение | Значение |
|---|---|
| Целевая платформа | Только iOS + Android (web — отдельный продукт, остаётся на Vue PWA) |
| Подход | Greenfield rewrite — новый Expo-проект в `mobile/`, Vue PWA продолжает жить в проде до фича-парити |
| Стек | Expo SDK 56, RN 0.81, React 19, TS 5.7, Expo Router 6 |
| UI | Гибрид NativeWind v5 (основной layer) + Expo UI SwiftUI/Compose (там, где нужен maximal-native look) |
| MVP-фичи native | Push (expo-notifications), Camera/OCR (expo-camera v17), Haptics (expo-haptics + RNGH), IAP (expo-iap) |
| Backend | Минорные доработки — APNs/FCM push, App Store Server Notifications / Google RTDN webhooks, server-side receipt validation |

**Vue PWA остаётся в проде** как самостоятельная версия — её не трогаем. После релиза Expo в сторах решим: либо PWA → "lite" версия, либо два продукта параллельно.

---

## 2. Архитектура и стек

### Структура проекта

Добавляем `mobile/` как третий root рядом с `frontend/` и `backend/`:

```
finance-app/
  backend/        # NestJS (минорные доработки)
  frontend/      # Vue PWA (заморожена на момент миграции — только critical bug fixes)
  mobile/         # NEW — Expo SDK 56 app
```

### Внутри `mobile/`

```
mobile/
  app/                          # expo-router — ТОЛЬКО routes
    _layout.tsx                 # Root: providers + <NativeTabs />
    (tabs)/
      _layout.tsx               # <NativeTabs />
      index.tsx                 # Dashboard
      history.tsx
      analytics.tsx
      profile.tsx
    transactions/
      new.tsx                   # presentation: formSheet
      [id].tsx
      [id]/edit.tsx
    accounts/...
    debts/...
    subscriptions/...
    settings/...
    auth/
      sign-in.tsx
      sign-up.tsx
    onboarding/...
  src/                          # FSD-подобная структура
    app/                        # providers (QueryClientProvider, AuthProvider, Toaster)
    entities/                   # account, transaction, debt, goal, person, subscription, category, currency, account-balance, budget, quick-action, recurring-subscription, push-subscription
    features/                   # add-transaction, split-expense, scan-receipt, partial-payment, close-debt, ... (31 фич из Vue)
    widgets/                    # BalanceCard, AccountStack, RecentTransactions, DebtsSection, GoalsSection, ...
    shared/
      ui/                       # Button, Card, Modal (Sheet), Tabs, Input, Badge, Icon (expo-image sf:), Spinner, ProgressBar, Toggle, ...
      api/                      # http.ts, queryClient.ts, invalidation.ts, composables/ (useAuth, useProfile, useExchangeRates)
      lib/
        format/                 # formatCurrency, formatMasked, formatDate, ...
        date/
        haptics/                # useHaptics() обёртка над expo-haptics
        utils.ts                # cn() — clsx + twMerge (NativeWind-compatible)
      config/                   # colors, navigation, storageKeys
      hooks/                    # useCurrentUser, useAsyncOperation, useUserCurrency, useDebouncedValue, ...
  assets/
    fonts/                      # Inter Variable
    icons/                      # tab icons
    splash.png
  app.config.ts                 # config plugins (notifications, camera, IAP)
  eas.json
  babel.config.js
  metro.config.js
  global.css                    # Tailwind directives (NativeWind)
  tailwind.config.js
  tsconfig.json
```

### Технологический стек

| Слой | Vue (сейчас) | Expo (станет) |
|---|---|---|
| Framework | Vue 3.5 | React 19 + RN 0.81 + Expo SDK 56 |
| Routing | vue-router 4 | expo-router 6 (file-based) |
| Главная навигация | кастомный BottomNav | `<NativeTabs />` (expo-router/unstable-native-tabs) |
| Server state | @tanstack/vue-query 5 | @tanstack/react-query 5 ✅ переиспользуем |
| Local state | Vue ref/computed, provide/inject | useState + Zustand (для глобального user/auth) |
| Styling | Tailwind v4 (Vite plugin) | NativeWind v5 (react-native-css) + inline styles + Expo UI |
| UI primitives | Reka UI (headless) | react-native-reusables (shadcn-style) + custom |
| Animations | @vueuse/motion | react-native-reanimated 4 |
| Gestures | кастомные useSwipe / usePullToRefresh | react-native-gesture-handler |
| Haptics | web-haptics (Web API) | expo-haptics |
| Icons | lucide-vue-next + Material Symbols mapping | expo-image `source="sf:name"` (SF Symbols on iOS) + lucide-react-native (Android fallback) |
| Storage | localStorage | expo-secure-store (tokens) + AsyncStorage (cache persister) |
| HTTP | fetch (custom) | ofetch или axios, JWT интерсептор через `expo-secure-store` |
| Notifications | web-push + VAPID | expo-notifications (APNs/FCM) |
| Camera/OCR | `<input type="file">` | expo-camera v17 + expo-image-picker |
| Payments | LemonSqueezy (web) | expo-iap (StoreKit 2 / Google Play Billing v7) |
| CSV import | papaparse | papaparse ✅ переиспользуем |
| Virtualization | @tanstack/vue-virtual | @shopify/flash-list |
| Forms | reactive refs | react-hook-form + zod |
| Build | Vite | Expo / Metro |
| Distribution | nginx | EAS Build → TestFlight / Internal Testing → Stores; EAS Update для JS-патчей |

### Backend изменения (минорные)

Новые endpoints в `backend/`:
1. `POST /api/notifications/register-device` — принимает `{ token, platform: 'ios'|'android', deviceId }` → сохраняет в `push_subscriptions` (рядом с web-push). На сервере определяем тип токена (Expo push token vs raw APNs/FCM).
2. `POST /api/subscription/iap/verify-receipt` — валидация чека iOS (App Store Server API) / Android (Google Play Developer API).
3. `POST /api/subscription/iap/webhooks/apple` — App Store Server Notifications V2 (HMAC + JWS).
4. `POST /api/subscription/iap/webhooks/google` — Google Real-time Developer Notifications (Pub/Sub push).
5. Расширение `subscription.entity`: добавить `source: 'lemonsqueezy' | 'apple_iap' | 'google_iap'`, `original_transaction_id`, `app_account_token`.

LemonSqueezy остаётся для web — модель Merchant of Record не противоречит IAP, просто разные источники подписки для разных платформ.

---

## 3. Маппинг компонентов (что → во что)

### 3.1. Pages (16 → 16)

| Vue Page | Expo Route | Особенности |
|---|---|---|
| `DashboardPage` | `app/(tabs)/index.tsx` | `<ScrollView contentInsetAdjustmentBehavior="automatic">` + виджеты |
| `HistoryPage` | `app/(tabs)/history.tsx` | `<FlashList>` с группами по датам (заменяет VirtualGroupedTransactionList) |
| `AnalyticsPage` | `app/(tabs)/analytics.tsx` | Donut chart через `victory-native` или `react-native-svg` |
| `ProfilePage` | `app/(tabs)/profile.tsx` | Settings rows через Expo UI |
| `AccountsPage` | `app/accounts/index.tsx` | |
| `AccountDetailPage` | `app/accounts/[id].tsx` | |
| `AddTransactionPage` | `app/transactions/new.tsx` | `presentation: 'formSheet'` |
| `EditTransactionPage` | `app/transactions/[id]/edit.tsx` | |
| `DebtsListPage` | `app/debts/index.tsx` | |
| `DebtDetailPage` | `app/debts/[id].tsx` | |
| `AddDebtPage` | `app/debts/new.tsx` | |
| `SubscriptionsPage` | `app/subscriptions/index.tsx` | |
| `SubscriptionDetailPage` | `app/subscriptions/[id].tsx` | |
| `CurrencySettingsPage` | `app/settings/currency.tsx` | |
| `CategoriesPage` | `app/settings/categories.tsx` | |
| `ImportPage` | `app/settings/import.tsx` | expo-document-picker для CSV |
| `ChangelogPage` | `app/changelog.tsx` | |
| `ScanReceiptPage` | `app/scan-receipt.tsx` | expo-camera fullscreen |
| `SignInPage` / `SignUpPage` | `app/auth/sign-in.tsx` / `app/auth/sign-up.tsx` | |
| Onboarding (currency, first account, profile) | `app/onboarding/...` | groupRoute |

### 3.2. Widgets (14 → React-компоненты в `src/widgets/`)

Прямой port — те же боксы, та же логика, только разметка из `<div>` → `<View>`, классы Tailwind переезжают в NativeWind:
`AppHeader, BottomNav (→ NativeTabs), SidebarNav (выкидываем — нет на mobile), BalanceCard, AccountStack, SaveSpendSection, RecentTransactions, DebtsSection, GoalsSection, RemindersSection, BudgetSection, OnboardingProgress, CurrencyList`.

Analytics: `StatCard, DonutChart, DailyStatsCards, TopCategories, SavingsGauge`.

### 3.3. Features (31 → 31)

Тот же список фич, по одной в папке `src/features/<name>/`:

`add-transaction, adjust-balance, analytics-filters, changelog, close-debt, configure-financial-period, configure-quick-action, create-account, create-debt, create-subscription, demo-mode, edit-account, edit-debt, edit-profile, edit-subscription, edit-transaction, feature-hints, import-data, install-pwa (УДАЛИТЬ), manage-categories, manage-push-notifications, manage-subscription, partial-payment, scan-receipt, search-transactions, select-currency, select-navbar-style (УДАЛИТЬ — NativeTabs не настраивается так), select-primary-color, set-budget, split-expense, toggle-theme, upgrade-to-premium`.

**Удаляются**: `install-pwa`, `select-navbar-style`.
**Добавляются**: `apple-pay-sheet` (если IAP-flow требует), `request-notification-permission`.

### 3.4. Entities (14 — переносим типы 1:1)

`account, account-balance, budget, category, currency, debt, goal, person, push-subscription, quick-action, recurring-subscription, subscription, transaction` — TS-типы и константы (EXPENSE_CATEGORIES, CURRENCIES, ENTITY_COLORS) переносятся без изменений.

### 3.5. Shared UI Library

| Vue (Reka UI based) | Expo (NativeWind / RNR / Expo UI) |
|---|---|
| `UButton` | `Button` (NativeWind, CVA-вариантами) |
| `UInput` | `Input` (NativeWind + TextInput) |
| `UCard` | `Card` (View + boxShadow) |
| `UModal` | `Modal` — `<Stack.Screen options={{ presentation: 'modal' }} />` |
| `UTabs` (pills) | `Tabs` (NativeWind, кастомный) |
| `UIcon` (Material Symbols → Lucide) | `Icon` — expo-image `source={{ uri: 'sf:gear' }}` на iOS, lucide-react-native на Android |
| `UProgressBar` | `ProgressBar` (View с анимацией Reanimated) |
| `USpinner` | `Spinner` (ActivityIndicator) |
| `UToggle` | RN `Switch` (нативный) |
| `UColorPicker` | Кастомный grid из NativeWind |
| `UIconSelector` | Grid + SF Symbols preview |
| `PullToRefresh` | RN `RefreshControl` |
| `SwipeableItem` | react-native-gesture-handler `Swipeable` |
| `SectionHeader` | Простой View + Text |
| `EmptyState` | Простой компонент |
| `ConfirmDeleteModal` | Stack.Screen presentation: 'formSheet' с small detent |
| `VirtualGroupedTransactionList` | `<SectionList>` или `<FlashList>` с stickyHeaders |

### 3.6. Composables → Hooks

| Vue | React |
|---|---|
| `useAuth` (singleton) | `useAuth` (Zustand store + хук) |
| `useProfile(userId)` | `useProfile(userId)` (TanStack Query) |
| `useExchangeRates` | `useExchangeRates` |
| `useSubscription(userId)` | `useSubscription(userId)` |
| `usePremiumFeature` | `usePremiumFeature` (Zustand для модалки) |
| `useToast` | `useToast` (Zustand + portal) или sonner-native |
| `usePwaUpdate` | заменяется на `useEASUpdate` |
| `useHaptics` | `useHaptics` обёртка над expo-haptics |
| `useIsDesktop` | удалить — на mobile не нужно |
| `useInfiniteTransactions` | TanStack `useInfiniteQuery` ✅ |
| `useAccounts, useTransactions, useDebts, useGoals, useReminders, useCategories, useHashtags, ...` | Все ✅ — переносится 1:1 |

---

## 4. Фазы миграции (high-level — детальный план в plan-документе)

1. **Phase 0 — Foundation** (1-2 недели): scaffold Expo проекта, базовая навигация, design-токены, auth flow, EAS setup.
2. **Phase 1 — Core read screens** (2-3 недели): Dashboard, History (read-only), Accounts list, Profile read-only.
3. **Phase 2 — Core mutations** (2-3 недели): AddTransaction (без split), AdjustBalance, CreateAccount, EditTransaction, базовое управление категориями.
4. **Phase 3 — Domain features** (3-4 недели): Debts (CRUD, partial payments, close), Goals, Reminders/Budget, Subscriptions list/detail, Analytics.
5. **Phase 4 — Native фичи MVP** (2-3 недели): Push (expo-notifications), Camera + Receipt OCR, Haptics polish, In-App Purchases (expo-iap).
6. **Phase 5 — Polish & QA** (2 недели): анимации, accessibility (VoiceOver/TalkBack), переходы, EAS Update setup, dogfood.
7. **Phase 6 — Store submission** (1-2 недели): иконки, splash, screenshots, App Store / Google Play metadata, TestFlight / Internal Testing → Production.

**Итого**: ~13-19 недель solo / 7-10 недель в паре.

---

## 5. Риски и митигации

| Риск | Митигация |
|---|---|
| **NativeTabs alpha** — API может поменяться | Использовать в production, но за фасадом — `src/app/navigation.tsx` обёртка. Если поломается, fallback на `<Tabs />` из expo-router. |
| **expo-iap — относительно новая библиотека** | Проверить maintenance status, подготовить контрактный слой `src/features/upgrade-to-premium/iap.ts`, чтобы можно было свапнуть на `react-native-iap` если нужно. Тестировать в TestFlight + Google Internal Testing рано. |
| **IAP webhooks → дублирование с LemonSqueezy** | Унифицировать на уровне `SubscriptionService.activatePremium({ source, externalId, periodEnd })`. |
| **OCR latency через камеру** | На Vue был file-input → сразу blob. На native: фото → resize (expo-image-manipulator) → upload. Бюджет 800ms. |
| **Drift между Vue и Expo во время миграции** | Vue заморожен на этот период — только critical bug fixes (документировать в CHANGELOG). |
| **Tailwind v4 → NativeWind v5** — не все классы поддерживаются (`grid-cols-*` другая семантика, `:hover` нет) | На старте Phase 0 — провести аудит используемых классов через `grep`. Заранее переписать неподдерживаемые. |
| **Push в iOS требует Apple Developer Account ($99/yr) + APNs key** | Получить APNs key и Google FCM service account до Phase 4. |
| **Размер бандла native > web** | Использовать EAS Update aggressively, инкрементально ставить assets через `expo-asset`. |
| **Reka UI → нет аналога в RN** | react-native-reusables — closest match; для drawer/sheet — нативные form sheets expo-router. |
| **Cursor pagination логика (transactions, debts)** | Логика на backend — клиент просто шлёт cursor; переносится без изменений в `useInfiniteQuery`. |
| **Vaul-vue (mobile drawer) на mobile native** | Заменяем на `presentation: 'formSheet'` с `sheetGrabberVisible` — это и есть нативная drawer-история iOS. |

---

## 6. Тестирование

- **Unit**: Vitest → Jest + jest-expo preset; testing-library/react-native для компонентов.
- **E2E**: Maestro flows для критических путей (sign-in → add transaction → see in history; upgrade-to-premium через sandbox IAP).
- **Manual QA**: dogfood через EAS Internal Distribution, TestFlight (iOS), Google Play Internal Testing.
- **Visual regression**: на старте — skip; через 2 месяца после релиза — добавить Chromatic-альтернативу (если нужно).
- **CI**: GitHub Actions → eas build на PR (preview), eas build + submit на merge в `main` (production-channel за feature flag).

---

## 7. Что НЕ входит в скоуп

- iPad / Android tablet optimisations (Phase 7+).
- Web билд через Expo (web остаётся на Vue PWA — отдельный продукт).
- Apple Watch / Wear OS companion.
- Виджеты iOS / Android home screen.
- Apple Pay / Google Pay для top-up (только подписки IAP).
- Face ID / Biometrics login (Phase 7+ — можно через `expo-local-authentication`).
- Offline-first sync (only TanStack Query cache persister в MVP).
- Polish анимаций уровня "delightful" — только функциональные переходы в MVP.

---

## 8. Success criteria

1. ✅ Все 16 страниц портированы и работают на iOS 16+ и Android 8+.
2. ✅ Все 14 виджетов и 31 фич перенесены (минус 2 удалённых: install-pwa, select-navbar-style).
3. ✅ Push-уведомления работают на iOS и Android.
4. ✅ Receipt OCR работает через native камеру.
5. ✅ Премиум-подписки доступны через App Store и Google Play (IAP).
6. ✅ Приложение опубликовано в TestFlight и Google Play Internal Testing.
7. ✅ Приложение прошло App Store Review и Google Play Review (production).
8. ✅ Cold start < 2s на iPhone 12, < 3s на mid-range Android.
9. ✅ Crash-free sessions > 99.5% за первые 2 недели после релиза.

---

## Open questions (для пользователя)

Они НЕ блокируют переход к плану, но стоит уточнить до Phase 4:
1. Apple Developer Program уже оплачен? Google Play Console аккаунт есть?
2. Решение по ценам IAP — оставляем те же что в LemonSqueezy (premium_monthly, premium_yearly), или меняем под App Store pricing tiers?
3. Кто будет тестером в TestFlight / Internal Testing на dogfood-этапе?
4. Нужна ли единая supabase/auth миграция, или JWT-flow остаётся как есть?
