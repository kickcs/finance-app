# Переработка долгов — план

**Спека:** `docs/superpowers/specs/2026-08-31-debts-rework-design.md`
**Ветка:** `refactor/debts-rework`

Каждая фаза — отдельный коммит, зелёные тесты и сборка обоих пакетов до перехода к
следующей. Фазы 1–2 не меняют поведение.

## Общие ограничения

- Коммиты без трейлера `Co-Authored-By`; пуш только в `origin` (GitHub), master
  защищён — нужен PR.
- `bun run build` в `backend/` и `frontend/` перед каждым коммитом.
- Тесты — через subagent `test-runner`, массовые механические правки — `bulk-edit`.
- Changelog: обновлять по общему правилу (patch-bump) на фазе, где появляется
  видимое пользователю изменение.
- UI сохраняется: любые изменения вёрстки — только те шесть, что перечислены в
  конце спеки.

---

## Фаза 1. Домен и эндпоинт платежа (backend)

**Файлы**

- Создать: `backend/src/modules/debt/application/commands/pay-debt/{pay-debt.command.ts,pay-debt.handler.ts,pay-debt.handler.spec.ts}`
- Создать: `backend/src/modules/debt/presentation/dto/pay-debt.dto.ts`
- Править: `presentation/controllers/debts.controller.ts` (маршрут `POST :id/payments`)
- Править: `application/commands/index.ts`, `debt.module.ts`
- Править: `application/commands/offset-debts/offset-debts.handler.ts` (через `makePayment`)
- Править: `presentation/dto/get-debts-paginated.dto.ts` / `queries/get-debts` (фильтр `status`)

**Что делает handler** — форма `offset-debts.handler.ts:67`: одна
`dataSource.transaction`, внутри `CreateTransactionCommand` на сумму платежа, при
переплате вторая запись на излишек в выбранной категории, при прощении
информационная запись, затем `debt.makePayment(amount)` и, если просили,
`debt.setForgivenAmount(remainder)`, затем `debtRepository.save(debt, manager)`.
Возвращает `{ debt, transactions }`.

**Тесты (jest):** частичный платёж уменьшает остаток; платёж в полную сумму
закрывает долг и проставляет `closeTransactionId`; переплата создаёт вторую
запись; прощение остатка закрывает долг и заполняет `forgivenAmount`; сумма больше
остатка без категории излишка — 400; чужой долг — 404; всё в одной транзакции
(при падении создания транзакции долг не меняется).

**Приёмка:** `GET /debts?status=active` отдаёт только открытые; новый эндпоинт
покрыт; фронт не тронут и продолжает работать по-старому.

---

## Фаза 2. Данные фронтенда (поведение не меняется)

**Файлы**

- Править: `entities/debt/api/useDebts.ts` — параметр `{ status }`, инвалидация
  через `invalidateDebtRelated`.
- Создать: `entities/debt/api/useDebtMutations.ts` — единая точка входа
  (create/update/remove/pay/reopen/offset), каждая через `debtCache` +
  `invalidateDebtRelated`.
- Править: `entities/debt/model/types.ts` — `isDebtOverdue`, `maskDebtName`,
  `daysBetween`.
- Создать: `entities/debt/lib/foldDebtsIntoPeople.ts` — одна свёртка нетто;
  удалить `entities/person/lib/foldDebtsByPersonName.ts` и его спеку, перевести
  `PeopleListPage.vue`.
- Править: `entities/debt/api/debtShareApi.ts` — перенести snake→camel из
  `features/share-debts/model/buildSharePayload.ts:44-54`.
- Править: `features/offset-debts/model/useOffsetDebts.ts` — применять
  `result.debts` через `applyDebtUpdate`.
- Править: `features/edit-debt/model/useEditDebt.ts:29-31` — `getDebtSplit().paid`.
- Править: `features/scan-receipt/model/useSubmitStep.ts:139,223` —
  `invalidateDebtRelated`.
- Править потребителей `useDebts` на `status: 'active'`: дашборд, `DebtPanel`,
  `SplitExpenseDrawer`, `ImportConfirmPage`, `PeopleListPage`.
- Удалить дубли просрочки в `DebtCard.vue`, `DebtHero.vue`, `DebtDetailContent.vue`,
  `groupDebtsByPerson.ts`, `foldGroupsIntoPeople.ts` в пользу `isDebtOverdue`.
- Удалить `debtQueryKeys.detail` (мёртвый).

**Тесты:** спеки на `isDebtOverdue` (закрытый долг с прошедшей датой — не
просрочен), `foldDebtsIntoPeople` (перенести существующие кейсы обеих свёрток),
`useDebtMutations` (каждая мутация зовёт `invalidateDebtRelated`), зачёт применяет
ответ сервера в кэш.

**Приёмка:** существующие спеки зелёные; `debtQueryKeys.list` больше не тянет
закрытые долги там, где они не нужны.

---

## Фаза 3. Платёж на серверный эндпоинт

**Файлы**

- Править: `entities/debt/api/debtsApi.ts` — `pay(debtId, payload)`.
- Править: `features/partial-payment/model/usePartialPayment.ts` — сжать до вызова
  эндпоинта плюс оптимистичный патч; убрать различение «дошло/не дошло», оно
  больше не нужно.
- Переименовать: `features/close-debt` → `features/delete-debt` (+
  `DeleteDebtModal`) и `features/reopen-debt` (+ `ReopenDebtModal`).
- Переместить: `useCloseAllDebts`, `CloseAllDebtsDrawer`, `sortDebts` →
  `features/pay-debt`; убрать `skipInvalidation`-координацию.
- Править: `backend` — сузить `UpdateDebtDto` (убрать `remainingAmount`,
  `isClosed`, `forgivenAmount`, `closeTransactionId`).
- Перевести на новый эндпоинт остальные пути погашения: `debtRepayment.ts`
  (import-inbox), `useSubmitStep.ts` (scan-receipt), split-expense.

**Тесты:** существующие спеки `usePartialPayment` и `useCloseAllDebts`
переписываются под новый контракт (те же сценарии, другой транспорт); добавить
спеку на `features/offset-debts`.

**Приёмка:** ни одно место фронта не пишет производные поля долга.

---

## Фаза 4. Форма долга

**Файлы**

- Создать: `entities/debt/model/useDebtFormModel.ts` — поля, валидация,
  направление→категория/тип, комиссия.
- Править: `features/add-transaction/model/useDebtForm.ts` и
  `features/edit-debt/model/useEditDebt.ts` — тонкие адаптеры над моделью.
- Править: `features/edit-debt/ui/EditDebtDrawer.vue` — на `UOverlay`, контракт
  `v-model`; `PersonPicker` вместо `UInput`; поле комиссии.
- Править места вызова `EditDebtDrawer` (контракт `open` → `modelValue`).

**Дополнено при исполнении.** «Комиссия редактируется» упиралась в бэкенд: её
расход заводил `POST /transactions`, связи с долгом не оставалось, и найти эту
запись было нечем. Поэтому комиссия стала полем самого долга: колонка
`debts.fee_transaction_id`, `DebtFeeService` (создать / поправить / убрать
расход), `feeAmount` в `PATCH /debts/:id`, и создание долга заводит комиссию
само. У долгов постарше связи нет — там поле не показывается.

**Тесты:** спека `useDebtFormModel` (валидация, направление→категория, комиссия);
спека `DebtFeeService` (создание, правка, удаление, отказы);
существующие `useDebtForm.spec` и `useEditDebt.spec` зелёные; новая спека
`EditDebtDrawer` (открытие/закрытие, комиссия сохраняется).

**Приёмка:** комиссия редактируется; обе формы используют один выбор человека.

---

## Фаза 5. Экраны

**Файлы**

- Создать: `pages/debts/model/useDebtsPage.ts` (из `useDebtsPageState.ts`) и
  `pages/debts/model/useDebtDetail.ts`.
- Переместить: `entities/debt/ui/DebtDetailPanel.vue` → `pages/debts/detail/`,
  убрать из него запросы.
- Править: `pages/debts/detail/DebtDetailPage.vue`, `pages/debts/list/DebtsListPage.vue`.
- Удалить: `pages/debts/new/AddDebtPage.vue` и строки в
  `app/router/prefetchTargets.ts:27,75`.
- Фильтры и выделение — через `useRouteQuery` (`@vueuse/router`).

**Дополнено при исполнении.** Действия над одним долгом собраны в
`pages/debts/model/useDebtDetail.ts`: он же раздаёт себя вниз по дереву, так что
`DebtDetailOverlays.vue` (все шторки долга) и `DebtDetailBody.vue` (тело экрана)
одни на страницу и на панель. Панель осталась без своих запросов: долг приходит
из уже загруженной ленты, а плоский список поднимается только под ссылку на
долг, которого в ленте нет. Фильтр едет с переходом на экран долга в адресе и
возвращается оттуда — иначе закрытый платежом долг уводил в общий список.
Попутно вскрылась ошибка `UOverlay`: `contentEl` отдавал якорный комментарий
фрагмента, и портал календаря внутрь десктопной шторки падал.

**Тесты:** обе существующие спеки страниц зелёные; новые кейсы — редактирование с
десктопа открывает шторку, а не навигацию; возврат после платежа сохраняет
фильтр; зачёт покрыт на уровне страницы.

**Приёмка:** одно место обработки каждого действия.

---

## Фаза 6. Компоненты

**Файлы**

- Слить `ClosedDebtCard` в `DebtCard` (состояние + слот подвала), обновить
  потребителей.
- `PersonDebtRow` — `InitialAvatar` в неградиентной ветке.
- `DebtsSummaryCard`, `MutualDebtCard` — `UProgressBar`/`DebtProgressMeter` вместо
  ручных полос; хенд-роллед пилюли → `UBadge`.
- Хаптика: убрать из композаблов, оставить в UI, добавить удалению/отмене/зачёту,
  снять двойной вызов в `DebtsListPage`.
- `DebtPaymentFields` — принимать вычисленные значения, не пересчитывать.
- Вынести общий ряд пресетов из `PaymentDrawer`/`CloseAllDebtsDrawer`.
- `DebtDetailPage.vue:163` — убрать `lg:pb-8`.

**Тесты:** спека объединённой `DebtCard` (открытый и закрытый вид); спеки на
`useDebtPaymentForm`, `PaymentDrawer`, `DeleteDebtModal`, `ReopenDebtModal`.

**Приёмка:** визуально те же экраны, кроме шести оговорённых исправлений.
