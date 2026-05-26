# Vue → Expo Migration Design

**Date**: 2026-05-25
**Status**: In progress — Phase 0–3 shipped on `feature/mobile-migration`, Phase 4 code-complete on 2026-05-26 (51-62 written; on-device + Apple/Google secrets needed to verify)
**Author**: Generated via /goal brainstorming session
**Last sync**: 2026-05-26 (Phase 4 — Tasks 56-59 close, code-complete state)

---

## 1. Цель и контекст

Перенести существующее финтех-приложение `finance-app` (Vue 3 PWA, ~32k LOC, FSD) на **Expo SDK 56** для публикации нативных приложений в **App Store** и **Google Play**.

**Ключевые решения, зафиксированные с пользователем:**

| Решение | Значение |
|---|---|
| Целевая платформа | Только iOS + Android (web — отдельный продукт, остаётся на Vue PWA) |
| Подход | Greenfield rewrite — новый Expo-проект в `mobile/`, Vue PWA продолжает жить в проде до фича-парити |
| Стек | Expo SDK 56, RN 0.85, React 19.2.3, TS 6.0.3, Expo Router 6 (независим от React Navigation) |
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

1. ✅ Все 16 страниц портированы и работают на iOS 16.4+ (минимум SDK 56) и Android 8+.
2. ✅ Все 14 виджетов и 31 фич перенесены (минус 2 удалённых: install-pwa, select-navbar-style).
3. ✅ Push-уведомления работают на iOS и Android.
4. ✅ Receipt OCR работает через native камеру.
5. ✅ Премиум-подписки доступны через App Store и Google Play (IAP).
6. ✅ Приложение опубликовано в TestFlight и Google Play Internal Testing.
7. ✅ Приложение прошло App Store Review и Google Play Review (production).
8. ✅ Cold start < 2s на iPhone 12, < 3s на mid-range Android.
9. ✅ Crash-free sessions > 99.5% за первые 2 недели после релиза.

---

## Implementation status (sync 2026-05-26)

Этот раздел отражает **фактическое** состояние ветки `feature/mobile-migration` относительно дизайна выше. Источник правды — commit history; здесь — выжимка для будущих сессий.

### Phase 0 — Foundation ✅
Все 12 задач закоммичены. Расхождения с дизайном:
- NativeWind v5 + Tailwind v4 — **CSS-first без `tailwind.config.js` и babel-плагина** (см. SDK 56 caveats в плане). Токены живут в `mobile/src/global.css` `@theme` блоке.
- Структура — `mobile/src/app/` (а не `mobile/app/`); expo-router находит автоматом. Зафиксировано в `mobile/AGENTS.md`.
- NativeTabs использует compound API (`NativeTabs.Trigger.Icon sf="…"`). `md=` prop для Material Symbols на Android **не добавлен** — TODO в Phase 5 polish.
- `globalClassNamePolyfill` оказался включён по умолчанию в `withNativewind()`, поэтому **обёртки `tw.tsx` через `useCssElement` НЕ нужны** — `className` на сырых RN-компонентах работает. Это упрощение vs. план.

### Phase 1 — Core read screens ✅
Tasks 13–22 + 21a. Все экраны работают: Dashboard (BalanceCard + SaveSpendSection + AccountStack + RecentTransactions), History (SectionList + infinite scroll + group-by-date), Accounts list + detail, Profile.
- **Disabled-query keys leak fix:** все hooks используют `'__disabled__'` sentinel вместо `…Keys.all` — иначе несколько disabled hook'ов схлопывались на один ключ и `invalidateQueries(.all)` будил их разом.
- **Account keys hierarchy:** добавлены discriminators (`'list' | 'detail' | 'with-balances'`) для предотвращения коллизий слота `[2]` между UUID и string-keyed подзапросами.

### Phase 2 — Core mutations ✅
Tasks 23–32. Полный набор: AddTransaction formSheet + AdjustBalance + CreateAccount + EditTransaction + invalidation helpers.
- **HIGH-фиксы из code-review (применены):**
  - `TransactionForm` **preserves `initialDate` on edit** вместо `new Date().toISOString()`. Иначе редактирование старой транзакции переносит её на сегодня — ломает month grouping, cursor pagination и analytics buckets.
  - `editableType` coercion (transfer/adjustment → expense) **заменён** на guard branch — раньше тап на transfer открывал форму, сохранение **rewrite'ило** `to_account_id`/`is_informational` и корруптило долговые цепочки.
  - Tap-to-edit во всех трёх местах (History, AccountDetail, RecentTransactions) гейтится `tx.type === 'income' || tx.type === 'expense'`.
- **Deferred (по решению автора):**
  - `useUpdateAccount` намеренно **не в barrel** — payload не передаёт type-specific поля (`creditLimit`, `gracePeriodDays`, `totalAmount`, `interestRate`, …). Откроется вместе с edit-account screen.
  - `transactionsApi.update` зеркалит Vue и **не отправляет** `isInformational`/`feeAmount` — паритет намеренный, не bug.
  - `useUpdateTransaction` типизация сужена до `Partial<TransactionCreateInput>` чтобы коллер не мог попытаться PATCH-нуть server-derived поля.

### Phase 3 — Domain features ✅ (с deferrals)
Tasks 33–50. Сделано: Debts (CRUD + group-by-person cursor pagination + close + partial-pay + edit), Goals (CRUD + GoalCard + progress bar), Budget API, Recurring subscriptions API, Analytics tab (period toggle + income/expense/net cards + top-10 expense categories с share %), Currency settings, CSV Import preview (Money Lover format).

**Отложено / упрощено:**
| Task | Что отложено | Почему | Когда возвращаемся |
|---|---|---|---|
| 38 | Split-expense (1 tx + N debts через `source_transaction_id`) | Rollback semantics требуют отдельного design pass (что делать если tx создалась, а debts упали) | Отдельный sub-плана после Phase 6 |
| 40 | Reminders entity целиком | В backend `planning` module нет endpoint'а (только `budgets` + `goals`) — это была aspirational ссылка из CLAUDE.md | Когда появится backend |
| 43 (DonutChart) | Визуальный donut в Analytics | Требует `react-native-svg` + `victory-native` — не критично для MVP | Phase 5 polish |
| 46–48 | Categories CRUD/reorder/custom | Drag-to-reorder требует `react-native-draggable-flatlist` + UX rework. Сейчас работают захардкоженные `EXPENSE_CATEGORIES` / `INCOME_CATEGORIES` константы | Когда появится Premium-фича «свои категории» |
| 50 | Реальный server-side bulk-import CSV | Нужен mapping категорий/счетов из CSV → существующие сущности (UI + backend endpoint) | Когда категории станут CRUD |
| — | Toggle-theme | Нет в плане как отдельной задачи, но в Phase 5 (Task 66) | Phase 5 |

**Зависимости плана vs. реальности (исправлено по ходу):**
- План говорил «vertical AccountStack горизонтальный scroll» — Vue делает вертикальный stack, мы тоже (1:1 паритет).
- План говорил «accounts/[id].tsx + accounts/[id]/adjust.tsx» — это конфликт в Expo Router. Переименовано в `[id]/index.tsx` + `[id]/adjust.tsx`.
- План говорил `account_type`/`is_hidden` в Account API — таких полей нет в backend; используется `type` + (нет `is_hidden`).
- План говорил `useProfile` после Task 22 — но BalanceCard (Task 16) от него зависит. Task 21a перетасован раньше.
- `_userId` параметр из Vue API убран — backend берёт `userId` из JWT.
- Дополнительные зависимости установлены: `expo-document-picker@~56.0.4`, `expo-file-system@~56.0.7` (для Task 50). Уже в `package.json`.

### Phase 4 — Native MVP 🚧 В работе

Закрыты задачи, которые не требуют физ.девайса/external accounts:
- **Task 51 — useHaptics** ✅ `mobile/src/shared/lib/haptics` wrapper + рефакторинг 10 файлов с raw `expo-haptics`. Поддерживаемые паттерны: `selection/success/error/warning/light/medium/heavy`.
- **Task 52 — Swipeable transaction items** ✅ `SwipeableRow` в `shared/ui` (использует `ReanimatedSwipeable` из RNGH 2.31 — Reanimated 4-compatible). Wired в History + AccountDetail. Transfer/adjustment rows не свайпятся (delete только для income/expense).
- **Task 53 — expo-notifications setup** ✅ Plugin в `app.json`, `registerForPush.ts` с typed `RegisterForPushResult.reason` enum, dynamic-import wiring в `useAuth` (signIn/signUp/anon/bootstrap → registerPush; signOut → unregisterPush). Foreground handler использует SDK 56's `shouldShowBanner`/`shouldShowList` (старый `shouldShowAlert` deprecated).
- **Task 54 — Push registration flow** ✅ Покрыт Task 53.
- **Task 55 — Backend POST /api/push-devices** ✅ Новая таблица `push_devices` параллельно с `push_subscriptions` (web-push), DDD-структура в `notification/`. После code-review применены 4 HIGH-фикса:
  - upsert не переписывает `id`/`createdAt` (через `QueryBuilder.orUpdate(['platform','device_id','updated_at'], ['user_id','token'])`) — иначе PK мутировал бы при каждом ре-регистре.
  - FK на `profiles(id) ON DELETE CASCADE` (паритет с `push_subscriptions`) — orphan rows после delete user исключены.
  - Unregister — `POST /unregister`, не `DELETE` с body (RFC 7231 + RN fetch polyfill стрипает body на DELETE).
  - `@MaxLength(512)` на token в DTO (Expo ~50, APNs 64, FCM ≤256).
  - DB-level `CHECK (platform IN ('ios','android'))`.
- **Task 61 — Push subscription endpoint mapping** ✅ Покрыт Task 53 (lifecycle в `useAuth`).
- **Task 60 — usePremiumFeature gate** ✅ Zustand store в `mobile/src/features/upgrade-to-premium/` (`usePremiumFeature` для call sites + `usePremiumModalState` для модалки + `setPremiumStatus` helper). Источник правды — `useSubscription(user?.id)`, синкается в Zustand-mirror через `useEffect` в `_layout.tsx`. `<PremiumUpgradeModal />` отрендерен глобально рядом со Stack в `AppShell` (RN `<Modal presentationStyle="pageSheet">`). Кнопки покупки — placeholder Alert до Task 57. `PremiumBadge` — простой pill-style View+Text. Barrel `entities/subscription/index.ts` создан. Commit `101e316`.
- **Task 62 — EAS Update** ✅ expo-updates установлен (`~56.0.16`). В `app.json`: `runtimeVersion.policy = "fingerprint"` + `updates.fallbackToCacheTimeout = 0`. Workflow `.github/workflows/eas-update.yml` на push в `master` под `mobile/**` с `[skip-ota]` опт-аутом, `concurrency` группой и `--non-interactive` флагом. Channel `production` совпадает с `eas.json`. **Не сделано** (требует interactive eas-cli auth от мейнтейнера): `eas update:configure` для добавления `extra.eas.projectId` + `updates.url` в `app.json` и `EXPO_TOKEN` secret на GitHub. До этого первый запуск workflow упадёт на publish step — флаг намеренный. Commit `de46d98`.

**Real APNs/FCM delivery не проверена** — нужен EAS dev build на физическом девайсе + APNs key / FCM service account. Blocked на open question #1.

- **Task 56 — Camera + Receipt OCR** ✅ MVP-scope. `expo-camera@~56.0.7` + `expo-image-picker@~56.0.13` + `expo-image-manipulator@~56.0.14`. `ScanReceiptScreen` (permission gate → CameraView fullscreen → capture/library pick → result list с items / service charge / total / hashtags) на route `/scan-receipt` как `fullScreenModal`. `useScanReceipt` делает resize 1600px + compress 0.7 перед upload чтобы держать 800ms budget. **HIGH fix:** `http.ts` инжектил `Content-Type: application/json` над multipart — починено через `body instanceof FormData` branch. Полный split-wizard (Vue's 4-step assign participants) отложен в Phase 5+. Commit `144def9`.
- **Task 57 — IAP contract layer** ✅ `expo-iap@4.3.1` (новее плана 2.9, но same OpenIAP API: `fetchProducts({skus, type:'subs'})`, `requestPurchase({request: {ios:{sku}, android:{skus:[sku]}}, type:'subs'})`). `iap.ts`: `PRODUCT_IDS` (finance_premium_monthly/yearly), `ensureIAPConnection()` (shared init promise), `shutdownIAP()` вызывается из `useAuth.signOut`. `useUpgrade` хук оборачивает `useIAP`: backend verify-receipt ДО `finishTransaction`, txn dedup через Set originalTransactionId (StoreKit replay protection), `ErrorCode.UserCancelled` silenced. Commit `5a2b9df`.
- **Task 58 — PremiumUpgradeModal IAP UI** ✅ Wired в `useUpgrade`: store-returned `displayPrice` с fallback на `PLAN_PRICES` (модалка работает в simulator до конфига App Store Connect), disabled state при empty products / loading / `Platform.OS === 'web'`, `refreshSubscription` после успешной покупки чтобы `setPremiumStatus` в `_layout.tsx` сразу подхватил entitlement. Commit `5a2b9df`.
- **Task 59 — Backend IAP receipt validation** ✅ Skeleton. `POST /api/subscription/iap/verify-receipt` authenticated. `IapService.verifyApple/Google` отказывают с BadRequest если `APPLE_IAP_SHARED_SECRET`/`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` не сконфигурированы — fail loud, чтобы не активировать премиум на unverified payload. Webhooks Apple/Google возвращают 503 пока не подключены JWS / Pub/Sub OIDC верификация. Aggregate расширен `source`/`originalTransactionId`/`appAccountToken` + migration `1773810000000` с CHECK constraint и partial unique index `(source, original_transaction_id) WHERE original_transaction_id IS NOT NULL` для идемпотентности webhook replay. Handler берёт productId из ответа store (spec §5: never trust client). Real App Store Server API / Google Play Developer API звонки — это TODO-pseudocode comments. Commit `aaf1b7c`.

Phase 4 follow-ups (требуют external secrets / accounts, не код):

| Follow-up | Что требуется |
|---|---|
| On-device push validation | Physical device + EAS dev build + APNs key / FCM service account JSON. |
| App Store Connect product setup | `finance_premium_monthly` / `finance_premium_yearly` SKUs в subscription group + localizations + App-Specific Shared Secret. |
| Google Play subscription setup | Те же SKUs в Play Console + service account JSON. |
| Apple IAP server-side validation | Wire App Store Server API в `IapService.verifyApple` (либо StoreKit2 transaction JWS via `appstore-server-library`). |
| Google IAP server-side validation | Wire `purchases.subscriptionsv2.get` в `IapService.verifyGoogle` через `googleapis` + service account JWT. |
| Apple webhook JWS verification | Apple root CA chain + X5C-header parsing → unblock `iap/webhooks/apple`. |
| Google RTDN OIDC verification | Pub/Sub subscriber service account OIDC token check via `google-auth-library` → unblock `iap/webhooks/google`. |
| `eas update:configure` | Adds `extra.eas.projectId` + `updates.url` to app.json so the `eas-update.yml` workflow publish step succeeds. |
| `EXPO_TOKEN` GitHub secret | Required by the `eas-update.yml` workflow to authenticate against EAS. |

**Внешние зависимости перед стартом Phase 4:**
- Apple Developer Program account + App Store Connect app record (open question #1 в спеке).
- Google Play Console account + Service Account JSON (для server-side receipt validation, Task 59).
- App-Specific Shared Secret из App Store Connect (Task 59).
- OPENAI_API_KEY в backend `.env` (Task 56 — `/api/receipt/scan` уже существует, проверить что работает).
- LemonSqueezy → IAP миграция: open question #2.

**SDK 56 caveats для Phase 4 (зафиксированы в плане):**
- IAP: `expo-iap` 2.9 (последняя опубликованная версия — репозиторий архивирован в апреле 2026). Использует OpenIAP-стиль API (`fetchProducts({ skus, type: 'subs' })`, `requestPurchase({ request: { sku } })`). К Phase 6 переоценить миграцию на `react-native-iap` (Nitro).
- EAS Update: `runtimeVersion.policy = 'fingerprint'` (не `appVersion`).
- `@expo/vector-icons` deprecated → `@react-native-vector-icons/*` scoped или `expo-symbols`. Сейчас используется `expo-symbols` с маппингом `material name → SF Symbol` в `src/shared/ui/icon.tsx` + текстовый fallback на Android. **Android visual polish — TODO в Phase 5**.

### Phase 5 — Polish & QA ⏳ Не начата
Tasks 63–72. Сюда же стекаются deferrals из Phase 0–3: NativeTabs `md=` prop для Android, DonutChart visual, Android Icon через vector-icons (или Material Symbols web → font).

### Phase 6 — Store submission ⏳ Не начата
Tasks 73–80. Зависит от наличия Developer аккаунтов (open question #1).

---

## Open questions (для пользователя)

Они НЕ блокируют переход к плану, но стоит уточнить до Phase 4:
1. Apple Developer Program уже оплачен? Google Play Console аккаунт есть?
2. Решение по ценам IAP — оставляем те же что в LemonSqueezy (premium_monthly, premium_yearly), или меняем под App Store pricing tiers?
3. Кто будет тестером в TestFlight / Internal Testing на dogfood-этапе?
4. Нужна ли единая supabase/auth миграция, или JWT-flow остаётся как есть?
