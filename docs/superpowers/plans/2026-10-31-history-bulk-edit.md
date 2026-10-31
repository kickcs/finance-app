# История: фильтры-чипы и массовая правка — план реализации

**Goal:** на «Истории» фильтруют по периоду, нескольким категориям, тегам и счетам, видят итог
выборки и разом меняют её: категория, перевод на свой счёт в той же валюте, смена счёта, тег,
удаление — с предпросмотром и отменой.

**Architecture:** сервер — единственный судья, какие строки участвуют (один предикат для списка,
итога и правки). Массовая правка — свой обработчик в одной транзакции БД с планом до записи и
сверкой с предпросмотром, по образцу `debt/application/settlement/close-all.ts`. Отмена правки —
подписанный токен; отмена удаления — отложенная отправка на клиенте.

**Tech Stack:** NestJS + CQRS + TypeORM (Postgres), Jest (unit + e2e на локальной БД); Vue 3 +
TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-history-bulk-edit-design.md` — читать целиком перед
задачей. Прототип — `docs/superpowers/specs/2026-10-31-history-bulk-edit-prototype.html`.

## Global Constraints

- Три PR, порядок обязателен: фаза 0 → фаза 1 → фаза 2. Ветки `fix/adjustment-account-change`,
  `feat/history-bulk-backend`, `feat/history-bulk-frontend` (от второй). `master` защищён — только PR.
- **Не коммитить** без явной просьбы пользователя; шаг «готово» = изменения в рабочем дереве.
- Комментарии в коде — по-русски, 1–2 строки, объясняют «почему».
- Бэкенд: новый обработчик — в `application/commands/index.ts` (или `queries/index.ts`) и
  `providers` модуля, иначе падение в рантайме. QueryBuilder берёт имена свойств, не колонок.
  Схема не меняется — миграций в плане нет; если понадобилась, это сигнал пересмотреть решение.
- Строки расчёта (`settlement_id`) трогает только `debt/application/settlement` — массовая правка
  их исключает и не пишет в них.
- Фронтенд: FSD (импорты только вниз); camelCase → snake_case в `entities/transaction/api`;
  кэш транзакций правит только `entities/transaction/api/transactionCache.ts`.
- Тесты запускать через сабагента `test-runner`. `bun run build` в `backend/` и `frontend/` перед
  каждым PR.
- Changelog (`frontend/src/features/changelog/model/changelogData.ts`): патч-версия на PR с
  видимым изменением — фаза 0 и фаза 2. Сейчас последняя 1.0.95.

## Review Focus

1. Пара оплаты → перевод: оба счёта-источника и целевой счёт ровно на сумму половин, вторая
   половина не осиротела, `payment_group_id` снят у обеих. → Task 5, Task 6 (e2e).
2. Операция из Telegram пришла между предпросмотром и применением — не изменена; одну строку
   выборки удалили — 409, ничего не записано. → Task 6.
3. `type=expense`: число в `summary` равно числу строк, которые отдаст список при пролистывании до
   конца (пост-фильтр `net > 0` переехал в SQL). → Task 3, Task 4.
4. Отмена после того, как одну из строк поправили вручную, — 409 целиком, ни одна строка не
   откатилась. → Task 7.
5. Отложенное удаление и уход в фон: запрос ушёл ровно один раз (таймер и `pagehide` не дублируют),
   при ошибке строки вернулись. → Task 11.
6. Встроенные категории со slug-id (`gifts_income` и т.п.) в `categoryIds` и как цель переноса. → Task 3, Task 5.

---

## Фаза 0 — PR 1: корректировка при смене счёта

### Task 1: смена счёта у `adjustment` переносит поправку

**Files:**
- Modify: `backend/src/modules/accounting/application/commands/update-transaction/update-transaction.handler.ts` (`reverseNonTransfer`/`applyNonTransfer`, ~362–390)
- Read: `backend/src/modules/accounting/domain/services/balance-calculation.service.ts` (как знак корректировки задаёт `is_debt_related`, :24–29; верное удаление, :59–65)
- Test: `update-transaction.handler.spec.ts`
- Modify: changelog — `fix`, следующая патч-версия.

- [x] Step 1: тесты — положительная корректировка 500 со счёта A на B: A −500, B +500; отрицательная — зеркально; смена суммы корректировки на том же счёте меняет баланс на разницу; смена знака (`isDebtRelated`) разворачивает поправку.
- [x] Step 2: увидеть падение.
- [x] Step 3: правило знака вынесено в `BalanceCalculationService.nonTransferDirection`, им пользуются сервис и `moveNonTransfer` обработчика.
- [x] Step 4: тесты зелёные (accounting 304/304), `bun run build` в `backend/` зелёный. Changelog не добавлен: интерфейс корректировку не правит («Коррекции можно только удалить»), баг достижим только через API.

---

## Фаза 1 — PR 2: бэкенд

### Task 2: предикат участия и `bulkLocked` в списке

**Files:**
- Create: `backend/src/modules/accounting/infrastructure/persistence/repositories/bulk-eligibility.ts` (SQL-фрагмент предиката)
- Modify: `transaction.repository.ts` (список), ответ транзакции (`to-transaction-response` или где собирается DTO), `frontend/src/shared/api/database.types.ts` (`Transaction.bulk_locked`) — фронтовую часть можно отложить до Task 8
- Test: спека репозитория/обработчика списка

**Interfaces — Produces:**
- `lockedForBulkSql(alias: string): string` — истина, если строка вне правки (§4 спеки): `is_informational`, `type = 'adjustment'`, `debt_id`/`settlement_id` не null, id в `debts.transaction_id | source_transaction_id | fee_transaction_id`.
- Ответ строки списка: `bulkLocked: boolean`.

- [x] Step 1: e2e `backend/test/history-filters.e2e-spec.ts` (через HTTP, хелпер `backend/test/helpers/history-test-db.ts`) — каждый признак из §4, строка комиссии и строка чека-источника без флагов; юнит `bulk-eligibility.spec.ts` и спека обработчика ленты.
- [x] Step 2: `lockedForBulkSql` — три отдельных `EXISTS`. `EXPLAIN` локально: `IDX_debts_transaction_id` и `IDX_debts_source_transaction_id` используются (при малой `debts` планировщик берёт Seq Scan/hashed SubPlan — быстрее); индекса на `debts.fee_transaction_id` нет — Seq Scan, миграцию не добавлял.
- [x] Step 3: тесты зелёные.

### Task 3: новые фильтры `GET /transactions`

**Files:**
- Modify: `backend/src/modules/accounting/presentation/dto/pagination.dto.ts`, `transaction.repository.ts` (~268–305, 366–373), контроллер `presentation/controllers/transactions.controller.ts`
- Test: спека репозитория, e2e списка

**Interfaces — Produces:**
- Query: `categoryIds[]` (`IsString`, не UUID), `accountIds[]` (UUID), `tags[]`, `startDate`, `endDate` (календарные даты, включительно, как в `analytics-query.dto.ts`). Старые `categoryId`/`accountId` работают как раньше.
- `TransactionFilter` — общий тип фильтра для списка, итога и правки (Task 4–6 его потребляют).

- [x] Step 1: e2e через HTTP — несколько категорий/счетов (повтор параметра, одно значение, через запятую), входящий перевод, `#кафе`/`#кафе2`/`#Кафе,`, спецсимволы тега (`c++`), период в часовом поясе профиля (обе границы), slug-категория; DTO — `pagination.dto.spec.ts`. Форма `categoryIds[]=` не разбирается (Express 5, простой парсер query) — клиент шлёт повтор параметра или список через запятую, как `accountIds` у аналитики.
- [x] Step 2: тест на странице по 2 (полная, без возвращённой строки) + пары оплаты (возврат 100/70/30 на половины 60+40) + сверка «`type=expense` = лента без фильтра, где `net > 0`».
- [x] Step 3: `TransactionFilter` рядом с `PaginationOptions`, один приватный `applyFilter` в репозитории; тег — `~* ANY(...)` с границей как в `getHashtags`; `net > 0` — `net-amount-sql.ts` (см. отчёт).
- [x] Step 4: тесты зелёные.

### Task 4: `GET /transactions/summary`

**Files:**
- Create: `accounting/application/queries/get-transactions-summary/` (query + handler), метод репозитория
- Modify: контроллер, `queries/index.ts`, `providers`
- Test: спека обработчика

**Interfaces — Produces:** ответ `{ count, eligibleCount, lockedCount, totals: [{ currency, amount }], asOf }`; `asOf` — `now()` сервера.

- [x] Step 1: e2e через HTTP — смешанные валюты, знаки (корректировка, перевод 0, информационная 0), `lockedCount`, пара = две строки, пустая выборка, `count` = лента, пролистанная до конца (7 фильтров, в том числе `type=expense` с возвратами и парой); юнит обработчика.
- [x] Step 2: `getSummary` — один `GROUP BY currency` через тот же `applyFilter`; `asOf` — часы приложения (`created_at` пишет домен, не БД) и ограничивает саму выборку итога (`created_at <= asOf`).
- [x] Step 3: тесты зелёные.

### Task 5: план массовой правки (чистые функции)

**Files:**
- Create: `accounting/application/commands/bulk-update-transactions/bulk-plan.ts` + `bulk-plan.spec.ts`

**Interfaces — Produces:**
- `planBulk(rows, action, ctx) → { writes, skipped: [{ reason, count }], balanceDeltas: [{ accountId, currency, delta }] }`, где `rows` уже сгруппированы по `payment_group_id` (пара — одна позиция).
- Причины пропуска — коды (`locked`, `wrong_type`, `same_account`, `pair_on_target`, `already_tagged`, `transfer_not_movable`), тексты — на клиенте.

- [x] Step 1: тесты по таблице §4 спеки, строка за строкой; пары — по списку §4; цель-категория долговая/`transfer`/`balance_adjustment`/маркер или другого типа — отказ всей операции (400), а не пропуск.
- [x] Step 2: тест — перевод пары: две записи-перевода в валюте каждой половины; дельты: счета-источники 0 (деньги уже списаны расходом), целевой +a+b.
- [x] Step 3: реализовать без доступа к БД.
- [x] Step 4: тесты зелёные.

### Task 6: `POST /transactions/bulk`

**Files:**
- Create: `bulk-update-transactions.command.ts`, `.handler.ts`, DTO в `presentation/dto/`
- Modify: контроллер, `commands/index.ts`, `providers`
- Read: `debt/application/settlement/close-all.ts` (замки, план до записи), `accounting/application/commands/bulk-import/bulk-import.handler.ts:57-158` (общая карта счетов, события после коммита)
- Test: спека обработчика, e2e `history-bulk`

**Interfaces — Produces:**
- Тело: `selection: { filter, asOf, expectedCount } | { ids }`, `action` (5 видов из §5 спеки), `dryRun?: boolean`.
- Ответ: `{ changed, skipped, balanceDeltas, undoToken? }`.

- [x] Step 1: e2e `backend/test/history-bulk.e2e-spec.ts` — фильтр «Такси, октябрь» → «Транспорт»: изменены все подходящие, долговая строка и чужой месяц не тронуты, балансы не изменились.
- [x] Step 2: e2e — строка создана после `asOf` не изменена; строка удалена между предпросмотром и применением → 409, ничего не записано.
- [x] Step 3: e2e — перевод пары (Review Focus 1); удаление пары; смена счёта с пропуском `pair_on_target`; slug-категории и своя категория (Review Focus 6).
- [x] Step 4: e2e — `dryRun` ничего не пишет и отдаёт те же `skipped`/`balanceDeltas`, что применение (все 5 действий); > 2000 строк → 400.
- [x] Step 5: реализовано: `POST /transactions/bulk` отвечает 200 (не 201: ничего не создаётся). Выборка — `ITransactionRepository.findForBulk` через `applyFilter`, замки `FOR UPDATE OF t` по id (проверено пробой `NOWAIT` с чужого соединения); вторые половины пар запираются отдельным запросом. Отступления: (1) массовые операции одного пользователя идут по очереди через `pg_advisory_xact_lock` (`bulk-user-lock.ts`) — два запроса замков иначе могли бы взять пару в разном порядке; (2) копилка остатков вынесена из `planBulk` в `balance-ledger.ts`, чтобы отмена считала дельты тем же способом; (3) в репозитории добавлен `deleteMany`.
- [x] Step 6: тесты зелёные (отдельной спеки обработчика нет: его покрывает e2e).

### Task 7: отмена правки

**Files:**
- Create: `bulk-undo.token.ts` (подпись/проверка), `undo-bulk-update.command.ts`, `.handler.ts`
- Modify: контроллер (`POST /transactions/bulk/undo`), Task 6 — выдача токена
- Test: спека токена, e2e

**Interfaces — Produces:** токен — подписанный сервером (секрет из конфигурации, не JWT доступа), срок 10 минут, `userId`, по строке прежние и новые значения изменённых полей, включая `payment_group_id` и поля перевода. Для удаления и `dryRun` не выдаётся.

- [x] Step 1: спека токена (`bulk-undo.token.spec.ts`) и e2e `backend/test/history-bulk-undo.e2e-spec.ts` — подделанный, мусорный и просроченный токен → 400; чужой `userId` → 403.
- [x] Step 2: e2e — перенос → отмена возвращает категории; перевод пары → отмена восстанавливает пару, `payment_group_id` и все балансы; смена счёта и тег; после ручной правки одной строки → 409, ничего не откатилось; повторная отмена тем же токеном → 409.
- [x] Step 3: реализовано; сравнение по полям (`sameRowState`). Отступление: в состояние строки токена добавлен `isDebtRelated` — перевод сбрасывает признак, и без него отмена не вернула бы его расходу, где он был. `Transaction.update` принимает `description: string | null`, чтобы вернуть пустое описание.
- [x] Step 4: тесты зелёные, `bun run build` в `backend/` зелёный.

**Итог фазы 1 (2026-10-31):** unit 1124/1124, e2e history-filters/bulk/bulk-undo/debt-settlement 139/139, build и eslint зелёные. Сверх плана: предикат «вне правки» смотрит и `debts.close_transaction_id`, а пара оплаты закрыта целиком, если закрыта одна половина (иначе «Изменить все N» обещало бы больше, чем изменится); тело токена отмены сжато (`deflateRaw`, 2000 строк < 300 КБ); массовые операции пользователя сериализуются `pg_advisory_xact_lock`. Для Task 8: списки в query — через запятую или повтором параметра (`categoryIds[]=` Express 5 не разбирает).

---

## Фаза 2 — PR 3: фронтенд

### Task 8: API и типы

**Files:**
- Modify: `frontend/src/entities/transaction/api/transactionsApi.ts`, `frontend/src/shared/api/database.types.ts`, `frontend/src/shared/api/queryKeys.ts`
- Test: спека маппинга

- [x] Step 1: тесты маппинга `summary`, `bulk`, `undo`, `bulk_locked`, новых параметров фильтра (camelCase ↔ snake_case).
- [x] Step 2: реализовать; `bulk` принимает опцию `keepalive` (для Task 11) — проверить, что `shared/api/http.ts` её пробрасывает в `fetch`. *Ключ итога — в `entities/transaction/api/queryKeys.ts`, `shared/api/queryKeys.ts` не понадобился; `bulk_locked` — необязательное поле.*
- [x] Step 3: тесты зелёные.

### Task 9: фильтры-чипы

**Files:**
- Modify: `frontend/src/pages/history/model/useHistoryFilters.ts`, `frontend/src/pages/history/HistoryPage.vue`
- Create: чипы и шторки выбора в `frontend/src/pages/history/ui/`
- Delete: `frontend/src/pages/history/ui/HistoryFiltersSheet.vue` (когда чипы его заменят)
- Test: `useHistoryFilters` спека, `HistoryPage.spec.ts`

- [x] Step 1: тест — старая форма из `sessionStorage` (`categoryId`/`accountId`) читается как массивы, без падения.
- [x] Step 2: тесты — мультивыбор, сброс «×», смена вкладки типа сбрасывает несовместимые категории; пять вкладок на 360 px не переносятся. *Ширину вкладок jsdom не измерит — проверено в Chromium: на 360 px не переносятся, а скроллятся («Долги» видны частично), как разрешает спека §3.*
- [x] Step 3: реализовать по прототипу (вариант B). *Отступления: поиск — отдельный режим (чипы и вкладки скрыты, сервер ищет без фильтров); период — пресеты + свой диапазон; в шторках фильтров нет счётчиков на опциях.*
- [x] Step 4: тесты зелёные.

### Task 10: плашка итога и массовая правка

**Files:**
- Create: `frontend/src/features/bulk-edit-transactions/` (модель выбора, шторка «Изменить все N», подтверждение, панель ручного выбора)
- Modify: `HistoryPage.vue`, строка ленты (замок у `bulk_locked`)
- Test: спеки фичи и страницы

- [x] Step 1: тесты — подпись плашки и число на кнопке сходятся («10 операций, 1 по долгу» / «Изменить все 9»); строка с замком не выбирается.
- [x] Step 2: тесты — подтверждение показывает `skipped` и `balanceDeltas` из `dryRun`; 409 → сообщение «Список изменился, обновили итог» и новый предпросмотр.
- [x] Step 3: тесты — тост «Отменить» зовёт `undo`; после переноса в категорию фильтр переключается на неё.
- [x] Step 4: реализовать; после правки — `invalidateTransactionRelated` + `invalidateAccountRelated`. *Отступления: панель выбора «Категория / Перевод / Счёт / Ещё» (по спеке); «Все» отмечает только загруженные строки; тег — шаг той же шторки (`fill`) с подтверждением сводкой, а не отдельная BulkTagSheet; в сводке нет «На сумму» (сервер её не отдаёт); итог на плашке компактный, на контейнере < 22rem кнопка «Изменить N»; в `UOverlay` добавлен слот `leading` под «Назад».*
- [x] Step 5: тесты зелёные.

### Task 11: отложенное удаление

**Files:**
- Create: `frontend/src/features/bulk-edit-transactions/model/useDeferredBulkDelete.ts`
- Read: `frontend/src/entities/transaction/api/transactionCache.ts` (`snapshotTransactionCaches`, `removeTransactionsFromCaches`, `restoreTransactionCaches`)
- Test: спека модели — помнить ловушку: `renderWithProviders` делает свой `QueryClient`, патчи кэша проверять на нём же

- [x] Step 1: тесты — строки пропали сразу; «Отменить» → снимок вернулся, запроса нет; таймер → один запрос; `visibilitychange: hidden` до таймера → один запрос с `keepalive`, таймер его не повторяет; ошибка → строки вернулись и тост.
- [x] Step 2: реализовать; при уходе в фон — компактная форма (фильтр со сверкой), ручной выбор > ~1500 id — частями. *Отступление: ручной выбор > 1500 id при уходе в фон уходит одним обычным запросом без `keepalive`, а не частями — куски после первого из выгруженной страницы не отправились бы, и удаление оказалось бы частичным; так сервер удалит всё или ничего.*
- [x] Step 3: тесты зелёные.

### Task 12: завершение

- [x] Step 1: `bun run build` в `backend/` и `frontend/`; `bun run check:bundle` и `bun run check:cache` в `frontend/` зелёные.
- [ ] Step 2: проверка на устройстве: шторка без внутреннего скролла, safe-area снизу, касания ≥ 44 px, светлая и тёмная тема, десктопная обёртка «Истории» не сломалась. *Пройдено в Chromium (390×844, 360×780, 1280×800, обе темы, демо + локальный бэкенд); реального устройства нет — safe-area и клавиатура в шаге тега не проверены.*
- [x] Step 3: changelog — `feature`, следующая патч-версия, по-русски простыми словами. *1.0.96.*
- [x] Step 4: обновить память `project_history_bulk_edit.md` (что в проде, follow-up).

**Итог ревью фазы 2 (2026-10-31):** исправлены находки ревью — причины `pair_split` и `already_in_category`, отложенное удаление прячет только то, что удалит сервер, итог правится только у текущего фильтра, поиск входит в охват, «Назад» 44 px, snake_case в типах правки. По сверке с прототипом: в режиме выбора нижняя навигация скрыта, тосты «Истории» сверху, в подтверждении видна исходная категория. Unit фронта 2249/2249, бэкенда 1133/1133, сборки, check:bundle 246.5/250 КБ, check:cache 140/200 и eslint зелёные. Остались раскладка по трём PR и проверка на устройстве.
