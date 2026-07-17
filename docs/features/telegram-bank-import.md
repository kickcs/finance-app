# Telegram-импорт банковских уведомлений

Инженерный справочник по фиче. Описывает, как устроен импорт банковских уведомлений из Telegram в транзакции приложения, где какие файлы лежат, какие контракты между фронтом и бэком, и куда вносить изменения.

> Связанные документы:
> - Дизайн-спека: `docs/superpowers/specs/2026-06-12-telegram-bank-import-design.md`
> - План реализации: `docs/superpowers/plans/2026-06-13-telegram-bank-import.md`

---

## 1. Что это и зачем

Пользователь форвардит уведомления своего банка (HUMO/UZS) **общему боту приложения** `@ouro_parser_robot`. Бот парсит сообщение, кладёт операцию в инбокс «На подтверждение», а пользователь в приложении проходит флоу подтверждения (счёт → категория → опционально долг/сплит/перевод/чек) и операция становится транзакцией.

**Ключевые свойства:**
- **Мультипользовательский** — один общий бот, привязка аккаунта по одноразовому deep link.
- **Бесплатный** — НЕ за премиумом.
- **С ревью** — импорт не создаёт транзакцию автоматически, всё проходит подтверждение.
- **Webhook-режим** — бот не поллит Telegram, Telegram сам шлёт апдейты на наш `/api/telegram-import/webhook`.

### Почему именно ручной форвард
Полностью автоматический перехват чужого бота невозможен без userbot (MTProto), Telegram Business или перехвата уведомлений устройства — все отклонены на этапе брейншторма. Ручной форвард — единственный устойчивый вариант без зависимости от устройства. MTProto-ридер (v2) отложен; pipeline (parser → ingest → inbox) к нему уже готов — достаточно подменить источник сообщений.

---

## 2. Поток данных (end-to-end)

```
[Банк-бот] → пользователь форвардит сообщение → [@ouro_parser_robot]
   → Telegram POST → /api/telegram-import/webhook (secret-token проверка)
   → TelegramBotService.handleUpdate → grammY обработчик message:text
   → IngestBankMessageCommand
        → парсер (HumoMessageParser) → ParsedBankMessage | null
        → dedup-hash → insertIfNew → imported_transactions (status=pending)
   → ReplyAggregator (debounce 3с) → бот отвечает сводкой «✅ Импортировано: N»

[Frontend] инбокс поллится раз в 30с → баннер на Истории + страница инбокса
   → ImportConfirmPage: prefill формы из импорта
   → submitAndWait (создаёт транзакцию) → confirmImported(id, {transactionId, accountId, toAccountId?})
        → markConfirmed + upsert card→account mapping + поиск встречного перевода
   → транзакция появляется в Истории (оптимистично)
```

### Привязка аккаунта (deep link)
```
Профиль → «Подключить Telegram» → POST /link-token → { deepLink: https://t.me/<bot>?start=<token> }
   → window.open → бот ловит /start <token> → LinkTelegramAccountCommand
        → атомарно consume(token) → создаёт telegram_links (userId ↔ telegramUserId)
   → пользователь жмёт «Проверить подключение» → GET /link → { linked: true }
```

### Вход через Telegram Mini App (TMA)
```
Бот присылает кнопку (web_app) / menu button «Инбокс» → открывается /tma внутри Telegram
   → Telegram передаёт initData через SDK → POST /tma-auth (initData)
        → если Telegram уже привязан к аккаунту → JWT (accessToken + refresh-cookie) → инбокс сразу
        → если не привязан → форма обычного входа внутри Mini App → после входа POST /tma-link
             → LinkTelegramViaTmaCommand привязывает Telegram к текущему аккаунту → инбокс
```
URL мини-приложения строится из `PUBLIC_APP_URL` (`<PUBLIC_APP_URL>/tma`) и прописывается в web_app-кнопках бота и в menu button.

---

## 3. Backend

Модуль: `backend/src/modules/telegram-import/`. Стек: NestJS + DDD + CQRS, grammY, TypeORM/PostgreSQL.

### 3.1. HTTP-эндпоинты

Глобальный префикс `/api`. Оба контроллера — `@Controller('telegram-import')`.

**Webhook** (`presentation/controllers/telegram-webhook.controller.ts`):

| Метод | Путь | Auth | Поведение |
|---|---|---|---|
| POST | `/api/telegram-import/webhook` | `@Public()` + `@SkipThrottle()` + HMAC | Проверяет заголовок `x-telegram-bot-api-secret-token` через `crypto.timingSafeEqual`. 503 если `botService.enabled=false`, 401 если секрет не совпал, иначе `handleUpdate` → `{ ok: true }` |

**REST API** (`presentation/controllers/telegram-import.controller.ts`) — все под JWT, `userId = @CurrentUser('sub')`:

| # | Метод | Путь | Тело | Ответ |
|---|---|---|---|---|
| 1 | POST | `/link-token` | — | `{ deepLink }` |
| 2 | GET | `/link` | — | `{ linked, telegramUsername }` |
| 3 | DELETE | `/link` | — | `{ success }` |
| 4 | GET | `/inbox` | — | `{ items: InboxItem[], count }` |
| 5 | POST | `/inbox/:id/confirm` | `{ transactionId, accountId, toAccountId? }` | `{ success, counterpartId\|null }` |
| 6 | POST | `/inbox/:id/dismiss` | — | `{ success }` |
| 7 | GET | `/cards` | — | `{ cards: { cardMask, accountId, lastSeenAt }[] }` |
| 8 | PUT | `/cards/:cardMask` | `{ accountId }` | `{ success }` |
| 9 | DELETE | `/cards/:cardMask` | — | `{ success }` |
| 10 | POST | `/tma-auth` | `{ initData }` | `@Public()` + throttle 10/min. `{ linked: false }` либо `{ linked: true, accessToken, user }` + refresh-cookie |
| 11 | POST | `/tma-link` | `{ initData }` | JWT. Привязывает Telegram к текущему аккаунту; `already_linked_other` → 409 |

`:cardMask` декодируется через `decodeURIComponent` (маски содержат `*`). Эндпоинты 5/6 — `@HttpCode(200)`.

`InboxItem`: `id, type, amount, currency, merchant, cardMask, occurredAt|null, balanceAfter, status, transactionId, suggestedAccountId, suggestedCategoryId, createdAt`.

### 3.2. Telegram-бот

`infrastructure/telegram/telegram-bot.service.ts`:
- **Webhook-режим**, никакого long-poll.
- **Enabled-флаг:** `enabled = Boolean(TELEGRAM_IMPORT_BOT_TOKEN)`. Нет токена → `bot=null`, модуль disabled (warn в лог). Если `bot.init()` бросает → форсит `enabled=false` (устойчивость к падению сети при старте).
- **Установка webhook:** в `onApplicationBootstrap`, если есть `bot + WEBHOOK_URL + WEBHOOK_SECRET` → `bot.api.setWebhook(url, { secret_token })`. **Бот сам регистрирует webhook при каждом старте** — отдельного шага в деплое нет.
- **TMA-кнопки:** сводка импорта и приветствие содержат inline-кнопку `web_app` (`InlineKeyboard.webApp`), открывающую `<PUBLIC_APP_URL>/tma`; в `onApplicationBootstrap` также ставится `setChatMenuButton` (menu button «Инбокс», `type: 'web_app'`) — обе точки входа ведут в Mini App.
- **Обработчики** (только `chatType('private')`):
  - `/start <token>` → `LinkTelegramAccountCommand`; без токена — приветствие.
  - `message:text` → `IngestBankMessageCommand`; `not_linked` → мгновенный reply, иначе исход в `ReplyAggregator`.
- `bot.catch()` логирует ошибки обработчиков.

`infrastructure/telegram/reply-aggregator.ts` — `ReplyAggregator`:
- Копит `{ imported, duplicates, unparsed }` по `chatId`, `DEBOUNCE_MS = 3000`.
- Каждый новый `add()` сбрасывает таймер. После 3с тишины — одна сводка. Цель: не спамить при форварде пачки.
- **Важно:** дебаунс задерживает только ответ бота, НЕ запись в БД (она синхронная).

### 3.3. Парсер

`domain/parsers/humo-message.parser.ts` — `HumoMessageParser implements BankMessageParser`.

**3 формата** (распознаются по первой строке):

| Маркер | type |
|---|---|
| «Оплата» | `expense` |
| «Пополнение» | `income` |
| «Счет по карте изменен» | `balance_change` (зарплата/изменение баланса; `amount=null`) |

**Фолбэк по знаку суммы.** Если маркер на первой строке не найден, тип берётся из строки суммы (ищется среди первых двух строк — перед суммой может стоять только заголовок): `➖` → `expense`, `➕` → `income`. Это покрывает два реальных случая HUMO:
- **headerless** — заголовка нет вовсе, первая строка сразу «➖ 36.000,00 UZS»;
- **нейтральный заголовок** — «💸 Операция», который сам по себе о направлении операции ничего не говорит.

`balance_change` через фолбэк недостижим: его строка суммы начинается с `💸`, а не с `➖`/`➕`, — он распознаётся только по маркеру.

**Извлечение:**
- `cardMask` — `💳…(\*\d+)` → `*1234`.
- `occurredAt` — `HH:MM DD.MM.YYYY`, **таймзона жёстко `+05:00`** (Ташкент).
- `merchant` — строка с `📍`.
- `amount` — строка с `➖`/`➕`, regex `([\d.]+,\d{2})\s*([A-Z]{3})`.
- `balanceAfter` — строка с `💰` (expense/income) или `💸` (balance_change).
- `currency` — из той же regex-группы что и сумма (а не из первого попавшегося кода в тексте — это был баг, исправлен).
- **Формат чисел узбекский:** `.` = разряды, `,` = дробь. `parseUzAmount("12.543.101,08") → 12543101.08`.

`parser-registry.ts` — `ParserRegistry`, список `[HumoMessageParser]`, возвращает первый успешный или `null`. **Точка расширения для новых банков** (см. §7).

`parsed-bank-message.ts` — тип `ParsedBankMessage { type, amount|null, currency, merchant|null, cardMask, occurredAt: Date, balanceAfter|null }`.

`dedup-hash.ts`:
- `computeDedupHash(parsed)` = SHA-256(`cardMask|type|occurredAt.toISOString()|amount|balanceAfter`).
- `computeUnparsedDedupHash(rawText)` = SHA-256(`rawText.trim()`).

### 3.4. CQRS

**Команды** (`application/commands/`):

| Команда | Логика |
|---|---|
| `IngestBankMessage` | Найти link по telegramUserId (иначе `not_linked`); распарсить; для `balance_change` вычислить **дельту зарплаты**: `amount = balanceAfter − findLatestBalance(userId, cardMask, occurredAt)` (null если предыдущего баланса нет); `insertIfNew` (идемпотентно по dedup). Возвращает `imported\|duplicate\|unparsed\|not_linked` |
| `LinkTelegramAccount` | Атомарно `consume(token)`; коллизия с другим userId → `already_linked_other`; чистит старые связи по userId И telegramUserId (перелинковка); создаёт связь |
| `CreateLinkToken` | 24 байта `base64url`, TTL 15 мин, `deepLink = https://t.me/<BOT_USERNAME>?start=<token>` |
| `ConfirmImported` | Проверка владения (userId), статус pending; **`assertAccountOwnership` для accountId и toAccountId** (через `ACCOUNT_REPOSITORY`); `markConfirmed(id, transactionId)`; upsert card→account; если `toAccountId` задан — `findTransferCounterpart` (обратный тип, та же сумма, ±15 мин, карта замаплена на counter-account) и тоже подтвердить. Возвращает `{ success, counterpartId }` |
| `DismissImported` | Проверка владения + pending → `markDismissed` |
| `UnlinkTelegram` | `deleteByUserId` |
| `SetCardMapping` | Проверка владения аккаунтом → upsert `(userId, cardMask, accountId)` |
| `DeleteCardMapping` | `delete(userId, cardMask)` |

**Запросы** (`application/queries/`):

| Запрос | Логика |
|---|---|
| `GetLinkStatus` | `findByUserId` → `{ linked, telegramUsername }` |
| `GetInbox` | `findPendingWithSuggestions` — pending (без `unparsed`), LEFT JOIN маппингов для `suggestedAccountId`, `suggestedCategoryId` из истории «мерчант → категория» (≥3 подтверждений одной категорией, самая частая; `domain/category-suggestion.ts`), сортировка `occurredAt DESC` |
| `GetCards` | `listCards` — DISTINCT карты из imported_transactions + LEFT JOIN маппингов |

### 3.5. Домен и хранилище

`domain/models.ts`:
```
ImportedTransactionType   = expense | income | balance_change | unparsed
ImportedTransactionStatus = pending | confirmed | dismissed
```

**Репозитории** (интерфейс в `domain/repositories/`, реализация в `infrastructure/persistence/repositories/`, инжект по символьному токену):

| Токен | Главные методы |
|---|---|
| `TELEGRAM_LINK_REPOSITORY` | findByUserId, findByTelegramUserId, save, deleteByUserId |
| `LINK_TOKEN_REPOSITORY` | create, **consume** (атомарный `UPDATE … SET used_at=now() WHERE used_at IS NULL AND expires_at>now() RETURNING user_id`) |
| `IMPORTED_TRANSACTION_REPOSITORY` | insertIfNew, findById, findPendingWithSuggestions, countPending, markConfirmed, markDismissed, **findLatestBalance**, **findTransferCounterpart** |
| `CARD_MAPPING_REPOSITORY` | findByUserAndCard, upsert, delete, listCards |

**ORM-сущности** (`infrastructure/persistence/typeorm/`):

| Таблица | Ключевые индексы / колонки |
|---|---|
| `imported_transactions` | **UNIQUE (user_id, dedup_hash)** — дедуп; INDEX (user_id, status); `amount`/`balance_after` = `numeric(18,2)` (читается строкой → `Number()`) |
| `telegram_links` | UNIQUE user_id; UNIQUE telegram_user_id; `telegram_user_id` = `bigint` (строка из pg) |
| `telegram_link_tokens` | UNIQUE token |
| `card_account_mappings` | UNIQUE (user_id, card_mask); `account_id` FK → accounts ON DELETE CASCADE |

Все таблицы: FK → `profiles(id) ON DELETE CASCADE`.

**Миграция:** `src/database/migrations/1781308800000-CreateTelegramImport.ts` — создаёт все 4 таблицы с FK/индексами; `down()` дропает их.

### 3.6. Регистрация модуля

`telegram-import.module.ts` импортирует `CqrsModule`, `ConfigModule`, **`AccountingModule`** (даёт `ACCOUNT_REPOSITORY` для проверки владения счётом в Confirm/SetCardMapping), `TypeOrmModule.forFeature([4 сущности])`. Провайдеры: 4 репозитория (токены) + `TelegramBotService` + CommandHandlers + QueryHandlers.

Подключён в `app.module.ts` (массив `imports`).

⚠️ **ORM-сущности зарегистрированы в ДВУХ местах** (иначе «No metadata for X»):
- `src/config/data-source.ts` — для CLI/миграций
- `src/app.module.ts` `TypeOrmModule.forRootAsync({ entities })` — для runtime

### 3.7. ENV-переменные

| Переменная | Где | Назначение |
|---|---|---|
| `TELEGRAM_IMPORT_BOT_TOKEN` | `TelegramBotService` (`get`) | Токен BotFather. Нет → модуль disabled |
| `TELEGRAM_IMPORT_BOT_USERNAME` | `CreateLinkTokenHandler` (`getOrThrow`) | Username без `@` для deepLink |
| `TELEGRAM_IMPORT_WEBHOOK_URL` | `TelegramBotService` (`get`) | Публичный URL для setWebhook |
| `TELEGRAM_IMPORT_WEBHOOK_SECRET` | `TelegramBotService` + webhook-контроллер | Секрет для `x-telegram-bot-api-secret-token` |

> Неймспейс `TELEGRAM_IMPORT_*` намеренно отделён от `TELEGRAM_BOT_TOKEN` существующего CI-бота деплой-уведомлений — не путать.

---

## 4. Frontend

FSD. Стек: Vue 3, TanStack Vue Query, Tailwind v4 (семантические токены).

### 4.1. Entity `imported-transaction`

`src/entities/imported-transaction/`:

- **`model/types.ts`** — snake_case. `ImportedTransaction { id, type, amount|null, currency, merchant|null, card_mask, occurred_at: string|null, balance_after|null, status, transaction_id|null, suggested_account_id|null, suggested_category_id|null, created_at }`. Также `TelegramLinkStatus`, `TelegramCard`.
  - ⚠️ `occurred_at` **nullable** — бэкенд может не распарсить дату. Все потребители имеют null-guard.
- **`api/importedTransactionsApi.ts`** — HTTP-функции; `transformImported()` маппит camelCase → snake_case (`cardMask→card_mask` и т.д.), `amount`/`balanceAfter` через `Number()`.
- **`api/queryKeys.ts`** — `all=['imported-transactions']`, `inbox(userId)`, `link(userId)`, `cards(userId)`. Инвалидация по `all` сбрасывает всё.
- **Composables:**
  - `useImportedTransactions(userId)` → `items`, `pendingCount`, `confirmImported`, `dismissImported`. **Поллинг `refetchInterval: 30_000` + `staleTime: 15_000`** (только активная вкладка). Один query на баннер и инбокс.
  - `useTelegramLink(userId)` → `status`, `refetchStatus`, `createLinkToken`, `unlink`. Без поллинга.
  - `useTelegramCards(userId)` → `cards`, `setCardAccount`, `deleteCardMapping`.

### 4.2. Feature `link-telegram`

`src/features/link-telegram/ui/`:
- **`TelegramSection.vue`** — 4 состояния: loading / connected (`@username`, «Отвязать») / waiting («Проверить подключение» → `refetchStatus`) / not-linked («Подключить» → `createLinkToken` → `window.open(deepLink)`). Бренд-цвет `#229ED9` (вне дизайн-системы). В connected-состоянии рендерит `TelegramCardsList`.
- **`TelegramCardsList.vue`** — аккордеон карт; `AccountSelector` → `setCardAccount`; корзина → `deleteCardMapping`. Карты появляются после первого импорта.

Встроена в **ProfilePage** (между «Уведомления» и «Данные»).

### 4.3. Pages `import-inbox`

`src/pages/import-inbox/`:
- **`ImportInboxPage.vue`** — список или `EmptyState`; клик → `IMPORT_CONFIRM`.
- **`ui/ImportInboxItem.vue`** — иконка/цвет по типу (balance_change=swap_vert/primary, income=↓/success, expense=↑/danger); «Сумма неизвестна» при `amount=null`.
- **`confirm/ImportConfirmPage.vue`** — флоу подтверждения:
  - **Prefill** (watch на item, keyed `prefilledId` чтобы рефетч не затёр правки): income→income; balance_change с `amount<0`→expense, иначе→income; expense→expense; `date = occurred_at ?? now`; `description = merchant`; `accountId = suggested_account_id`; `categoryId = suggested_category_id` (отдельный watch: ждёт загрузки категорий, не трогает уже выбранную и пропускает удалённую категорию — `model/categoryPrefill.ts`).
  - **Submit:** `submitAndWait` создаёт транзакцию → `confirmImported(id, {transactionId, accountId, toAccountId?})`.
  - **Retry-bookkeeping:** `createdTransactionId` / `splitDebtsCreated` — если confirm упал после создания транзакции, ретрай НЕ дублирует (переиспользует id, только повторяет confirm). Сброс при смене item и после успешного confirm.
  - **Split:** `createDebtsForSplit` после транзакции; при неудаче — `rollbackTransaction`.
  - **`onDebtSubmitted` (известный компромисс):** DebtPanel создаёт долг+транзакцию сам и НЕ отдаёт transactionId → импорт помечается `dismissed` (а не `confirmed`); `transaction_id` для долга не проставляется.
  - **`toScanReceipt`:** `SCAN_RECEIPT?importedId=<id>&expectedAmount=<abs(amount)>`.
  - **`:hide-scan-receipt="true"`** на `TransactionForm` — скрывает внутреннюю иконку скана (у страницы своя кнопка с контекстом импорта).

### 4.4. Widget `ImportInboxBanner`

`src/widgets/ImportInboxBanner/` — баннер «N операций на подтверждение», `pendingCount` из `useImportedTransactions` (тот же query), `v-if pendingCount>0`, клик → `IMPORT_INBOX`. Встроен в **HistoryPage** (первым элементом контента, до фильтров).

### 4.5. Роутинг

`src/shared/config/routeNames.ts`: `IMPORT_INBOX='import-inbox'`, `IMPORT_CONFIRM='import-confirm'`, `SCAN_RECEIPT='scan-receipt'`.

`src/app/router/index.ts` (под корневым layout, `requiresAuth`+`requiresOnboarding`):
- `import-inbox` → `ImportInboxPage`
- `import-inbox/:id` → `ImportConfirmPage` (name `import-confirm`)

**`MainLayout.vue`** — `FULLSCREEN_FLOWS = [SCAN_RECEIPT, IMPORT_CONFIRM, IMPORT_INBOX]`, на них скрыт BottomNav (иначе плавающий liquid-glass навбар перекрывает нижние кнопки).

### 4.6. Интеграция со скан-чеком

- `ScanReceiptPage.vue` читает query `importedId` / `expectedAmount` → `useReceiptWizard(importedId)` → `useSubmitStep(…, importedId)`.
- После успешного OCR-сабмита `useSubmitStep.ts` вызывает `importedTransactionsApi.confirm(linkedImportId, {transactionId, accountId})` напрямую (best-effort, флаг `importConfirmed` от дублей при ретрае; при ошибке — warning-toast, сабмит не фейлится) и инвалидирует `importedTransactionQueryKeys.all`.
- `Step4Summary` done-route: `importedId ? IMPORT_INBOX : DASHBOARD`.

---

## 5. Контракт FE ↔ BE

Бэкенд отдаёт **camelCase**, фронт хранит **snake_case** (трансформация в `importedTransactionsApi.ts`). Тело confirm/setCardMapping остаётся camelCase (`transactionId`, `accountId`, `toAccountId`).

| Действие | FE-функция | BE-эндпоинт |
|---|---|---|
| Создать deep link | `createLinkToken()` | POST `/link-token` |
| Статус привязки | `getLinkStatus()` | GET `/link` |
| Отвязать | `unlink()` | DELETE `/link` |
| Инбокс | `getInbox()` | GET `/inbox` |
| Подтвердить | `confirm(id, …)` | POST `/inbox/:id/confirm` |
| Отклонить | `dismiss(id)` | POST `/inbox/:id/dismiss` |
| Список карт | `getCards()` | GET `/cards` |
| Привязать карту | `setCardAccount(mask, acc)` | PUT `/cards/:cardMask` |
| Удалить привязку | `deleteCardMapping(mask)` | DELETE `/cards/:cardMask` |

---

## 6. Безопасность

- **Webhook:** `@Public()`, но валидация секрета через `x-telegram-bot-api-secret-token` + `crypto.timingSafeEqual`. 503 если бот выключен.
- **Одноразовые токены:** атомарный `consume` (один conditional UPDATE…RETURNING) против TOCTOU. TTL 15 мин.
- **Дедуп:** UNIQUE (user_id, dedup_hash) + `insertIfNew` — повторный форвард того же сообщения не создаёт дубль.
- **Владение ресурсами:** Confirm/Dismiss/SetCardMapping проверяют `userId`; счёт валидируется через `ACCOUNT_REPOSITORY` (нельзя подсунуть чужой accountId).
- **Только приватные чаты:** `bot.chatType('private')`.

---

## 7. Как вносить изменения (точки расширения)

### Добавить новый банк / формат сообщения
1. Создать `domain/parsers/<bank>-message.parser.ts`, реализующий `BankMessageParser` (`canParse` + `parse → ParsedBankMessage | null`).
2. Зарегистрировать в `ParserRegistry` (`parser-registry.ts`).
3. Добавить тесты по образцу `humo-message.parser.spec.ts` (реальные примеры сообщений).
   Остальной pipeline (ingest, dedup, inbox, confirm) трогать не нужно.

### Добавить поле в импортированную операцию
1. Backend: колонка в ORM-сущности + миграция; поле в `domain/models.ts`; пробросить в `insertIfNew`, `findPendingWithSuggestions`, маппинге ответа контроллера.
2. Frontend: поле в `model/types.ts` + `transformImported()` + использование в `ImportConfirmPage`/`ImportInboxItem`.

### Изменить частоту обновления инбокса
`useImportedTransactions.ts` → `refetchInterval` / `staleTime`.

### Добавить новый эндпоинт
По паттерну CQRS: command/handler → экспорт из `application/commands/index.ts` → провайдер в модуле → метод контроллера → FE-функция в `importedTransactionsApi.ts` → composable.

### MTProto-ридер (v2, автоперехват)
Подменить источник: вместо grammY `message:text` вызывать тот же `IngestBankMessageCommand`. Парсер/дедуп/инбокс готовы.

---

## 8. Известные ограничения и edge-cases

- **Долг во флоу подтверждения** помечает импорт `dismissed`, не `confirmed` (DebtPanel не отдаёт transactionId). Транзакция-долг не линкуется к импорту.
- **Зарплата (`balance_change`)** содержит только новый баланс. Сумма = дельта от последнего известного баланса карты. **Если предыдущего баланса нет — `amount=null`**, пользователь вводит вручную (есть подсказка в UI).
- **Дата не распарсилась** → `occurred_at=null` → во флоу подставляется `now()`.
- **Баннер не появляется мгновенно** если приложение всё время открыто на Истории — обновится в пределах 30с (поллинг) или сразу при возврате фокуса/pull-to-refresh.
- **Дебаунс ответа бота 3с** — это только про сообщение бота, не про запись в БД.
- **Перевод между картами:** counterpart матчится по обратному типу + та же сумма + ±15 мин + карта замаплена на counter-account. Если карта не привязана к счёту — авто-матч не сработает.
- **Safari (web.telegram.org) блокирует 3rd-party cookies** — refresh-cookie TMA-сессии не сохраняется между визитами, сессия живёт ~15 минут (до истечения access-токена), затем нужно переоткрыть Mini App. В мобильном и десктопном Telegram (нативный WebView) деградации нет.

---

## 9. Деплой и эксплуатация

- **CI:** push в `master` → `.github/workflows/deploy.yml` собирает образы, деплоит по SSH, **прогоняет миграции автоматически** (`npx typeorm migration:run` при изменении backend).
- **ENV:** 4 секрета `TELEGRAM_IMPORT_*` заведены в GitHub Secrets; проброшены в `deploy.yml` (`env:` И `envs:` whitelist), `docker/env.prod.template`, `docker-compose.prod.yml`.
- **Домен/прокси:** `https://app.ouro-finance.top` → host-nginx :8080 → фронт-контейнер `docker/frontend/nginx.conf` (`location /api/` → `backend:3000`). Webhook доходит по этой цепочке.
- **Webhook ставится автоматически** ботом при старте (`setWebhook`). Отдельного шага нет.

### Быстрая диагностика
```bash
# статус webhook у Telegram
curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | python3 -m json.tool
#   ждём: url=app.ouro-finance.top/..., ip=185.120.59.179, без last_error_message

# health бэкенда
curl -s -o /dev/null -w "%{http_code}\n" https://app.ouro-finance.top/api/health        # 200

# webhook без секрета → 401 (значит модуль enabled и цепочка цела; 503 = бот выключен)
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://app.ouro-finance.top/api/telegram-import/webhook -d '{}'

# прод-БД
ssh root@185.120.59.179 "docker exec \$(docker ps -q -f name=postgres) psql -U postgres -d my_finance -c \"SELECT status, count(*) FROM imported_transactions GROUP BY status;\""
```

**Симптомы → причина:**
- Бот молчит на форвард → проверь `getWebhookInfo` (`last_error_message`), `enabled` (есть ли `BOT_TOKEN` в проде), 503 на webhook.
- «Сначала привяжи аккаунт» хотя привязан → telegram_user_id не совпал / связь удалена.
- Сообщение «не распознано» → формат не покрыт парсером (см. §7, добавить пример в тесты).
- Баннер не обновляется → поллинг 30с / фокус вкладки.

---

## 10. Карта файлов (шпаргалка)

**Backend** `backend/src/modules/telegram-import/`:
```
presentation/controllers/  telegram-webhook.controller.ts, telegram-import.controller.ts, tma.controller.ts
presentation/dto/          confirm-imported.dto.ts, set-card-mapping.dto.ts, tma-auth.dto.ts
application/commands/       ingest-bank-message, link-telegram-account, create-link-token,
                           confirm-imported, dismiss-imported, unlink-telegram,
                           set-card-mapping, delete-card-mapping, tma-auth, link-telegram-via-tma
application/queries/        get-link-status, get-inbox, get-cards
domain/parsers/            humo-message.parser.ts, parser-registry.ts, parsed-bank-message.ts, dedup-hash.ts
domain/models.ts, domain/repositories/  (4 интерфейса)
domain/tma/                init-data.validator.ts — валидация Telegram initData (HMAC)
infrastructure/telegram/   telegram-bot.service.ts, reply-aggregator.ts
infrastructure/persistence/typeorm/      (4 ORM-сущности)
infrastructure/persistence/repositories/ (4 реализации)
telegram-import.module.ts
```
Миграция: `backend/src/database/migrations/1781308800000-CreateTelegramImport.ts`

**Frontend** `frontend/src/`:
```
entities/imported-transaction/   model/types.ts, api/* (Api, queryKeys, 3 composables)
features/link-telegram/ui/        TelegramSection.vue, TelegramCardsList.vue
features/tma-auth/                model/useTmaEntry.ts, ui/TmaLoginForm.vue
pages/import-inbox/               ImportInboxPage.vue, ui/ImportInboxItem.vue, confirm/ImportConfirmPage.vue
pages/tma/                        TmaEntryPage.vue
widgets/ImportInboxBanner/        ImportInboxBanner.vue
shared/lib/telegram/              loadTelegramWebApp.ts — загрузка Telegram Web App SDK
```
Интеграция: `pages/profile/ProfilePage.vue`, `pages/history/HistoryPage.vue`, `app/layouts/ui/MainLayout.vue`, `app/router/index.ts`, `shared/config/routeNames.ts`, `features/scan-receipt/model/{useReceiptWizard,useSubmitStep}.ts`.
```
