# Telegram Mini App для импорта транзакций — дизайн-спека

Дата: 2026-07-17. Статус: draft (автономный брейншторм по /goal).

> Связанные документы:
> - Справочник фичи импорта: `docs/features/telegram-bank-import.md`
> - Дизайн-спека импорта: `docs/superpowers/specs/2026-06-12-telegram-bank-import-design.md`
> - Дока Telegram Mini Apps: https://core.telegram.org/bots/webapps

---

## 1. Проблема и цель

Сейчас после форварда банковских уведомлений боту `@ouro_parser_robot` пользователь получает ответ «✅ Импортировано: N» — и на этом Telegram-часть заканчивается. Чтобы подтвердить операции, нужно выйти из Telegram, открыть `app.ouro-finance.top` (или PWA), пройти авторизацию и добраться до инбокса. Этот разрыв — главная точка потери пользователей фичи.

**Цель:** пользователь подтверждает импортированные операции, не покидая Telegram, — через Telegram Mini App (TMA), открывающийся кнопкой прямо из ответа бота.

Дополнительный выигрыш: привязка аккаунта упрощается — вместо танца с deep-link-токеном из профиля веб-приложения пользователь логинится один раз внутри TMA, и Telegram-аккаунт привязывается автоматически (личность в Telegram уже доказана через `initData`).

## 2. Выбранный подход и альтернативы

**Выбран: TMA = существующий Vue SPA со специальным входом.** Mini App открывает URL `<PUBLIC_APP_URL>/tma` — публичный роут существующего фронтенда. Страница читает `Telegram.WebApp.initData`, аутентифицируется через новый эндпоинт и редиректит на существующие `import-inbox` / `import-inbox/:id`. Весь флоу подтверждения (счёт → категория → долг/сплит/перевод/чек) переиспользуется как есть; BottomNav на этих роутах уже скрыт (`FULLSCREEN_FLOWS`).

Альтернативы, отклонены:
- **Отдельный мини-фронт для TMA** — дублирует весь флоу подтверждения (формы, категории, сплит, перевод, скан чека); стоимость поддержки несоизмерима с выигрышем в размере бандла.
- **Подтверждение inline-кнопками бота без TMA** — не вмещает выбор счёта/категории/сплита; противоречит явному запросу «используй TMA».

## 3. UX-флоу

### 3.1. Основной сценарий (пользователь привязан)
1. Пользователь форвардит уведомления → бот отвечает сводкой «✅ Импортировано: N» c inline-кнопкой **«Подтвердить операции»** (`web_app`-кнопка).
2. Тап по кнопке → открывается Mini App (`/tma`) → мгновенная авторизация по `initData` → редирект на инбокс.
3. Пользователь подтверждает операции существующим флоу. Закрывает Mini App.

### 3.2. Пользователь не привязан
1. Форвард боту → ответ «сначала привяжи аккаунт» с кнопкой **«Привязать аккаунт»** (открывает тот же `/tma`).
2. `/tma`: `tma-auth` возвращает `linked: false`:
   - если в webview уже есть валидная сессия приложения (localStorage Telegram-webview персистентен) — экран подтверждения «Привязать этот Telegram к аккаунту <email>?» с кнопкой → `tma-link` → инбокс;
   - иначе — форма входа (email + пароль) внутри TMA → `signIn` → `tma-link` → инбокс.
3. Регистрации внутри TMA нет — ссылка «Создать аккаунт» открывает сайт во внешнем браузере (`WebApp.openLink`).

### 3.3. Точки входа в Mini App
- Inline-кнопка в сводке бота (`imported > 0`) и в ответе `not_linked`.
- Inline-кнопка в приветствии `/start`.
- **Menu button** бота (кнопка рядом с полем ввода) — ставится глобально через `setChatMenuButton` при старте бота (как `setWebhook`), текст «Инбокс».

Прямые ссылки `t.me/<bot>/<app>` и «Main Mini App» в BotFather — не требуются для v1 (кнопки `web_app` работают без регистрации приложения в BotFather).

## 4. Backend

Всё в модуле `telegram-import` (он владеет `telegram_links`), выдача JWT — через `TokenService` из identity.

### 4.1. Валидация initData
Новый доменный сервис `domain/tma/init-data.validator.ts`:
- Вход: сырая строка `initData` (querystring) + bot token.
- Алгоритм по доке: распарсить пары, извлечь `hash`, отсортировать остальные ключи, собрать `data-check-string` (`key=<value>` через `\n`), `secret_key = HMAC_SHA256(key="WebAppData", data=bot_token)`, сравнить `hex(HMAC_SHA256(data_check_string, secret_key))` с `hash` через `crypto.timingSafeEqual`.
- Проверка свежести: `auth_date` не старше **1 часа** (auth происходит сразу при открытии Mini App).
- Выход: `{ telegramUserId: string, username?: string } | null` (парсим поле `user` — JSON).
- Чистая функция без зависимостей NestJS → легко покрыть unit-тестами (вектор с известным токеном генерируется в тесте тем же алгоритмом + негативные кейсы: битый hash, просроченный auth_date, отсутствие user).

### 4.2. Эндпоинты (`telegram-import.controller.ts` / отдельный `tma.controller.ts`)

| Метод | Путь | Auth | Тело | Ответ |
|---|---|---|---|---|
| POST | `/api/telegram-import/tma-auth` | `@Public()` + throttle (10/min) | `{ initData }` | `{ linked: false }` либо `{ linked: true, accessToken, user }` + refresh-cookie |
| POST | `/api/telegram-import/tma-link` | JWT | `{ initData }` | `{ success: true }` |

**`TmaAuthCommand`**: валидировать initData (невалидно/просрочено → 401) → `findByTelegramUserId` → нет связи → `{ linked: false }`; есть → загрузить профиль (`PROFILE_REPOSITORY`), `tokenService.generateTokens({ sub, email, isAnonymous, isDemo })`, `profile.setRefreshToken(hash)` + save — зеркально `LoginHandler`. Ответ и cookie — в том же формате, что `/auth/login` (полная совместимость с фронтовой сессионной машинерией, включая refresh).

**`LinkTelegramViaTmaCommand`**: валидировать initData → `telegramUserId`; семантика как у `LinkTelegramAccountCommand`, но userId из JWT, без одноразового токена: почистить старую связь userId (перелинковка своего же Telegram), создать `telegram_links`. Коллизия «этот Telegram уже привязан к другому аккаунту» → отказ `already_linked_other` (409), как в существующей команде.

### 4.3. Изменения в identity
- `identity.module.ts`: добавить `TokenService` в `exports` (сейчас только `JwtModule, PassportModule, PROFILE_REPOSITORY`).
- Константы refresh-cookie (`REFRESH_TOKEN_COOKIE`, `COOKIE_OPTIONS`, demo-вариант) вынести из `auth.controller.ts` в переиспользуемый файл `identity/presentation/cookie.constants.ts` и импортировать в обоих контроллерах — без дублирования логики.
- `telegram-import.module.ts`: добавить `IdentityModule` в imports.

### 4.4. Бот (grammY)
- `infrastructure/telegram/tma-keyboard.ts` — фабрика inline-клавиатуры: `new InlineKeyboard().webApp(text, tmaUrl)`; `tmaUrl = PUBLIC_APP_URL + '/tma'` (env уже существует, новых переменных **не добавляем**).
- `ReplyAggregator`: к сводке с `imported > 0` прикладывается клавиатура «Подтвердить операции».
- Ответ `not_linked`: кнопка «Привязать аккаунт».
- `/start` без токена: кнопка «Открыть инбокс».
- `onApplicationBootstrap`: рядом с `setWebhook` — `setChatMenuButton` (type `web_app`, text «Инбокс»). Если `PUBLIC_APP_URL` не задан — кнопки/menu button не ставятся (graceful, warn в лог), бот работает как раньше.

`web_app`-кнопки допустимы только в приватных чатах — обработчики уже ограничены `chatType('private')`.

## 5. Frontend

### 5.1. Роут и страница
- Роут `/tma` без meta (публичный, по образцу `/shared/:token`), `ROUTE_NAMES.TMA_ENTRY = 'tma-entry'`.
- FSD: `pages/tma/TmaEntryPage.vue` + `features/tma-auth/` (model: композабл флоу; ui: форма входа, экран подтверждения привязки).
- Хелпер `shared/lib/telegram/loadTelegramWebApp.ts`: динамически подключает `https://telegram.org/js/telegram-web-app.js`, резолвит `window.Telegram.WebApp` (страница `/tma` — единственный потребитель; в `index.html` скрипт не добавляем, чтобы не грузить его всем пользователям SPA). Типы — минимальная декларация в `vite-env.d.ts` или локальном `.d.ts` (по паттерну LemonSqueezy).

### 5.2. Флоу страницы
Состояния: `loading` → (`redirect` | `confirm-link` | `login` | `not-telegram` | `error`).
1. `loadTelegramWebApp()`; нет `initData` (открыто не из Telegram) → экран «Откройте через Telegram» со ссылкой на сайт.
2. `WebApp.ready()`, `WebApp.expand()`; тема: `WebApp.colorScheme` → `setTheme('dark'|'light')` (перекрывает сохранённую тему только в localStorage Telegram-webview — на основной браузер не влияет).
3. `POST /tma-auth`:
   - `linked: true` → `applySession(accessToken, user)` → `router.replace(IMPORT_INBOX)`.
   - `linked: false` + уже есть локальная сессия (`isAuthenticated` после `initializeAuth`) → экран «Привязать Telegram к аккаунту <email>?» → `POST /tma-link` → инбокс.
   - `linked: false` без сессии → форма входа → `signIn()` → `POST /tma-link` → инбокс.
   - 401 (просроченный initData) / сеть → экран ошибки с кнопкой «Повторить».

### 5.3. Изменения в useAuth
Новый метод `applySession(accessToken, user)` в `useAuth()` (singleton): `setTokens(accessToken)` + `user.value = user` + та же пост-обработка localStorage, что делает `signIn` (выделить общий приватный хелпер, чтобы не дублировать). Refresh-cookie приходит от `tma-auth` — дальше работает штатное авто-обновление токена.

### 5.4. Что переиспользуется без изменений
`ImportInboxPage`, `ImportConfirmPage`, весь confirm-флоу, поллинг инбокса, guards (`requiresAuth`/`requiresOnboarding` — привязанный пользователь онбординг уже прошёл; если нет, штатный редирект на `FIRST_ACCOUNT` внутри TMA тоже корректен).

## 6. Безопасность

- `initData` валидируется **только на бэкенде** (HMAC c bot token, `timingSafeEqual`), `initDataUnsafe` на клиенте не используется для доверенных решений.
- Окно свежести `auth_date` — 1 час; повторное открытие Mini App генерирует новый `initData`.
- `tma-auth` — `@Public()`, но с throttle (10/min) против брутфорса hash.
- `tma-link` — под JWT; initData в теле нужен, чтобы связать доказанный Telegram-идентификатор с доказанным userId. Права на чужие ресурсы не расширяются.
- Refresh-cookie — те же опции (`httpOnly`, `sameSite: lax`, `path: /api/auth`), что и у обычного логина.
- Проверить `docker/frontend/nginx.conf` на `X-Frame-Options`/`frame-ancestors`: Telegram Web (web.telegram.org) открывает Mini Apps в iframe — заголовок `DENY`/`SAMEORIGIN`, если есть, сломает веб-версию. Мобильные клиенты используют нативный webview (не затронуты).

## 7. Не-цели (v1)

- Регистрация внутри TMA (только вход; регистрация — во внешнем браузере).
- Интеграция `MainButton`/`BackButton`/`CloudStorage`/haptics Telegram (у приложения свои кнопки и haptics).
- Регистрация приложения в BotFather (direct link `t.me/bot/app`, Main Mini App).
- Кастомная TMA-тема поверх `themeParams` (используем только `colorScheme` → существующая тёмная/светлая тема).
- Deep-link на конкретную операцию из сообщения бота.

## 8. Тестирование

- **Backend unit (Jest):** `init-data.validator` (валидный вектор, битый hash, просроченный `auth_date`, отсутствие `user`, пустая строка); `TmaAuthHandler` (linked/не linked, зеркальность login-ответа); `LinkTelegramViaTmaCommand` (создание, перелинковка обеих сторон).
- **Frontend:** type-check + build; ручная проверка состояний страницы `/tma` (в браузере initData пуст → экран «Откройте через Telegram»).
- **Прод-смоук после деплоя:** `getWebhookInfo` без ошибок; кнопка в ответе бота открывает Mini App; подтверждение операции из TMA создаёт транзакцию.

## 9. Изменяемые файлы (карта)

**Backend** (`backend/src/modules/`):
- `telegram-import/domain/tma/init-data.validator.ts` (+spec) — новый
- `telegram-import/application/commands/tma-auth/`, `link-telegram-via-tma/` — новые
- `telegram-import/presentation/controllers/tma.controller.ts` + DTO — новый
- `telegram-import/infrastructure/telegram/tma-keyboard.ts` — новый; правки `telegram-bot.service.ts`, `reply-aggregator.ts`
- `telegram-import/telegram-import.module.ts` — imports/providers
- `identity/identity.module.ts` — export `TokenService`; `identity/presentation/cookie.constants.ts` — вынос констант

**Frontend** (`frontend/src/`):
- `pages/tma/TmaEntryPage.vue`, `features/tma-auth/*` — новые
- `shared/lib/telegram/loadTelegramWebApp.ts` — новый
- `shared/api/composables/useAuth.ts` — `applySession`
- `app/router/index.ts`, `shared/config/routeNames.ts` — роут `/tma`
- `features/changelog/model/changelogData.ts` — запись, patch-бамп

Миграций БД нет. Новых env-переменных нет (`PUBLIC_APP_URL` уже существует).
