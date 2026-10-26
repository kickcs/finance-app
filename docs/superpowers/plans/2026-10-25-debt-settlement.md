# Расчёт по долгу — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** все записи одного расчёта по долгу связаны `settlement_id`, один серверный модуль их пишет и
единственный разворачивает; «Закрыть все» — одна серверная команда с предпросмотром.

**Architecture:** колонка `transactions.settlement_id`; модуль
`backend/src/modules/debt/application/settlement/` (чистые функции плана + писатель + отмена) за
сервисом `DebtSettlementService`; обработчики долгов и `delete-transaction` зовут его. Клиент
группирует записи по `settlement_id` вместо даты.

**Tech Stack:** NestJS + CQRS + TypeORM (Postgres), Jest (unit + e2e на локальной БД); Vue 3 +
TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-debt-settlement-design.md` — читать целиком перед задачей.

## Global Constraints

- Ветка `feat/debt-settlement`. **Не коммитить** — пользователь коммитит сам; шаг «Commit» в задачах = «оставить изменения в рабочем дереве».
- Комментарии в коде — по-русски, 1–2 строки, объясняют «почему»; не пересказывать устройство чужих модулей.
- Бэкенд: схема только миграциями (`synchronize: false`); новый обработчик — в `application/commands/index.ts` и `providers` модуля; QueryBuilder берёт имена свойств, не колонок.
- Фронтенд: FSD (импорты только вниз), бэкенд camelCase → фронтенд snake_case в `entities/*/api/*Api.ts`; после любой мутации долга — `invalidateDebtRelated`.
- Деньги округляются `round2` (два знака) везде, где считается остаток.
- Порядок «старые первыми»: `createdAt ASC, id ASC`.
- Тексты ошибок для пользователя — по-русски, как в спеке.
- E2E: локальный Postgres (`docker compose up -d postgres`, миграции `bun run migration:run` в `backend/`), запуск `bun run test:e2e -- debt-settlement`. Юнит: `bun run test -- <path>` в `backend/`, `bun run test -- <path>` в `frontend/`.
- Тесты запускать через сабагента `test-runner`, если исполнитель — оркестратор; сабагент-исполнитель запускает сам.

## Review Focus

1. Платёж с переплатой на тот же счёт, затем отмена закрытия: баланс счёта ровно как до платежа (две записи на один счёт в одной транзакции БД — риск «потерянного обновления»). → тест в Task 5.
2. Закрытый долг без расчёта (старое закрытие патчем, `close_transaction_id = null`): отмена закрытия работает, остаток = `total − Σ applied`. → тест в Task 5.
3. Удаление долга, чей зачёт заблокирован более поздним платежом по встречному долгу: 409, ничего не удалено. → тест в Task 6.
4. Удаление из ленты записи зачёта: оба долга открываются, а клиент обновляет и долги, и счета. → тесты в Task 6 (e2e) и Task 8 (инвалидация).
5. Закрытие только прощением (сумма 0, `forgiveRemainder`): отмена закрытия снимает прощение и возвращает остаток. → тест в Task 5.

---

## Фаза 1

### Task 1: колонка `settlement_id` насквозь

**Files:**
- Create: `backend/src/database/migrations/1785900000000-AddTransactionSettlement.ts`
- Modify: `backend/src/modules/accounting/infrastructure/persistence/typeorm/transaction.orm-entity.ts`, aggregate `domain/aggregates/transaction/transaction.aggregate.ts`, mapper `infrastructure/persistence/mappers/transaction.mapper.ts`, `application/.../to-transaction-response.ts`, `application/commands/create-transaction/create-transaction.command.ts` и `.handler.ts`
- Modify: `frontend/src/shared/api/database.types.ts` (`Transaction`), `frontend/src/entities/transaction/api/transactionsApi.ts` (маппинг ответа)
- Test: `create-transaction.handler.spec.ts`, `transaction.mapper.spec.ts` (если есть; иначе спека маппера рядом)

**Interfaces — Produces:**
- Миграция: `ALTER TABLE transactions ADD COLUMN settlement_id uuid NULL` + `CREATE INDEX "IDX_transactions_settlement_id" ON transactions (settlement_id) WHERE settlement_id IS NOT NULL`; `down` убирает.
- `CreateTransactionCommand` — новый последний параметр `settlementId?: string` (после `secondPart`).
- `Transaction.settlementId: string | null` (геттер); задаётся только при создании и при `reconstitute`, `update()` его не меняет.
- Ответ API транзакции: поле `settlementId: string | null`; фронтенд `Transaction.settlement_id: string | null`.

- [ ] Step 1: тест `create-transaction.handler.spec`: «передаёт settlementId в созданную запись» — команда с `settlementId: 'set-1'` → сохранённый агрегат `settlementId === 'set-1'`; без него — `null`.
- [ ] Step 2: тест маппера: ORM `settlement_id` ↔ домен `settlementId` в обе стороны.
- [ ] Step 3: запустить, увидеть падение.
- [ ] Step 4: реализовать миграцию, сущность, агрегат, маппер, ответ, команду; фронтенд-тип и маппинг `settlementId → settlement_id`.
- [ ] Step 5: `bun run migration:run` в `backend/`; тесты зелёные; `bun run build` в `backend/`.

### Task 2: `DeleteTransactionCommand` во внешней транзакции

**Files:**
- Modify: `accounting/application/commands/delete-transaction/delete-transaction.command.ts`, `.handler.ts`; `accounting/domain/repositories/transaction.repository.interface.ts` и реализация `findById`
- Test: `delete-transaction.handler.spec.ts`

**Interfaces — Produces:**
- `new DeleteTransactionCommand(id: string, userId: string, skipDebtCheck = false, manager?: EntityManager)`.
- `ITransactionRepository.findById(id: string, manager?: EntityManager)`.
- С `manager` обработчик не открывает свою `dataSource.transaction`, читает запись, парную часть и счета через `manager` (`findByIdWithBalances(id, manager)`), сохраняет через него же.

- [ ] Step 1: тест «с внешним менеджером не открывает свою транзакцию и читает счёт через него»: `dataSource.transaction` не вызван; `accountRepository.findByIdWithBalances` получил `(accountId, manager)`; `transactionRepository.delete` получил `manager`.
- [ ] Step 2: тест «без менеджера — прежнее поведение» (существующие кейсы остаются зелёными).
- [ ] Step 3: красный → реализация → зелёный; `bun run build`.

### Task 3: чистые функции плана

**Files:**
- Create: `backend/src/modules/debt/application/settlement/settlement-plan.ts`
- Test: `backend/src/modules/debt/application/settlement/settlement-plan.spec.ts`

**Interfaces — Produces:**
```ts
export function round2(value: number): number;
export interface SettlementDebt { id: string; debtType: 'given' | 'taken'; remaining: number; createdAt: Date }
export interface PaymentPlan { actualPayment: number; excess: number; remainderAfter: number; forgiven: number; willClose: boolean }
export function planPayment(input: {
  remaining: number; amount: number; forgiveRemainder: boolean; settleWithWork: boolean;
  excessCategoryId?: string; workCategoryId?: string;
}): PaymentPlan; // бросает BadRequestException с текстами из pay-debt.handler.ts:81-100
export interface OffsetPlan { offsetAmount: number; direction: 'given' | 'taken'; net: number; parts: { debtId: string; amount: number }[] }
export function planOffset(debts: SettlementDebt[]): OffsetPlan; // каждая сторона гасит offsetAmount, старые первыми
export interface CloseAllPayment { debtId: string; amount: number; forgive: boolean; withExcess: boolean }
export interface CloseAllPlan { offset: OffsetPlan | null; payments: CloseAllPayment[]; excess: number; totalDebt: number }
export function planCloseAll(debts: SettlementDebt[], input: { paymentAmount?: number; forgiveRemainder: boolean }): CloseAllPlan;
```
`planCloseAll` повторяет `frontend/src/features/pay-debt/model/useCloseAllDebts.ts:79-115` после зачёта:
`amount` платежа включает переплату у последнего оплачиваемого долга (`withExcess`), долг с нулевой
долей и без прощения пропускается. `offset = null`, если сторона одна.

- [ ] Step 1: табличные тесты `planPayment`: частичный (100 из 300 → actual 100, remainderAfter 200, willClose false); ровно в ноль (willClose true); переплата 350 из 300 с категорией → excess 50; переплата без категории → «Выберите категорию для переплаты»; прощение 100 из 300 → forgiven 200, willClose; 0 без прощения → «Некорректная сумма платежа»; отработка с переплатой → «Отработка не может превышать остаток долга»; долговая категория работы → «Некорректная категория работы»; 0.1+0.2 остаток округляется.
- [ ] Step 2: тесты `planOffset`: given 300 (два долга 100 и 200, старый 100) vs taken 250 → offsetAmount 250, parts given: 100 + 150, taken: 250, direction 'given', net 50; равные стороны → net 0; порядок при равном `createdAt` — по `id`.
- [ ] Step 3: тесты `planCloseAll`: одна сторона, сумма = итог → все долги полностью; сумма больше → переплата на последнем (`withExcess`, `amount = remaining + excess`); сумма меньше без прощения → долги без доли пропущены; с прощением → `forgive: true` у недоплаченных; обе стороны → `offset` не null и платежи только по уцелевшей стороне на остатки после зачёта.
- [ ] Step 4: красный → реализация → зелёный.

### Task 4: модуль расчёта — запись (платёж, зачёт)

**Files:**
- Create: `debt/application/settlement/settlement-writer.ts`, `debt/application/settlement/debt-settlement.service.ts`, `debt/application/settlement/index.ts`
- Modify: `pay-debt.handler.ts`, `offset-debts.handler.ts` (становятся тонкими), `debt.module.ts` (provider), `debt/infrastructure/persistence/repositories/debt.repository.ts` (`findActiveByPerson` — `ORDER BY created_at, id`)
- Create: `backend/test/helpers/debt-test-db.ts` (стенд по образцу `analytics-test-db.ts`: пользователь, два счёта с балансами, хелперы `createDebt`, `balanceOf(accountId)`, `recordsOf(debtId)`), `backend/test/debt-settlement.e2e-spec.ts`
- Modify/Delete: `pay-debt.handler.spec.ts`, `offset-debts.handler.spec.ts` — кейсы правил переезжают в `settlement-plan.spec.ts`, оркестрация — в e2e; от спек обработчиков остаётся проверка делегирования.

**Interfaces:**
- Consumes: Task 1 (`settlementId` в команде), Task 3 (план).
- Produces:
```ts
export class SettlementWriter {
  readonly settlementId: string; // randomUUID()
  constructor(commandBus: CommandBus, manager: EntityManager, userId: string);
  record(input: { accountId: string; categoryId: string; amount: number; currency: string;
    type: 'income' | 'expense'; date: Date; description: string; isDebtRelated: boolean;
    debtId?: string; isInformational?: boolean }): Promise<string>; // id записи
}
@Injectable() export class DebtSettlementService {
  pay(command: PayDebtCommand): Promise<PayDebtResultDto>;          // + settlementId: string
  offset(input: { userId: string; personName: string; currency: string }): Promise<OffsetDebtsResultDto>; // + settlementId
}
```
Правила платежа и зачёта (описания, счёт отметки, `hadBalanceEffect`, `closeTransactionId`) переносятся
без изменений; меняется только то, что каждая запись идёт через `SettlementWriter`.

- [ ] Step 1: e2e «платёж с переплатой и прощением не бывает, а с переплатой — две записи одного расчёта»: долг 300, платёж 350 с категорией переплаты → записи возврата (`debt_id`) и переплаты (без `debt_id`) с одним `settlement_id`; ответ содержит этот `settlementId`.
- [ ] Step 2: e2e «частичный платёж с прощением»: 100 из 300 + прощение → возврат и `debt_forgiven` с одним `settlement_id`, долг закрыт, `forgiven_amount` 200.
- [ ] Step 3: e2e «отработка с категорией»: две записи (нога работы + возврат) одного расчёта, баланс счёта не изменился.
- [ ] Step 4: e2e «зачёт»: given 300 / taken 250 одного человека → записи `debt_offset` всех затронутых долгов с одним `settlement_id`, долги погашены старыми первыми.
- [ ] Step 5: красный → писатель, сервис, тонкие обработчики → зелёный; юнит-спеки обработчиков переписаны; `bun run build`.

### Task 5: модуль расчёта — отмена и отмена закрытия

**Files:**
- Create: `debt/application/settlement/settlement-reversal.ts`; `debt/application/commands/reverse-settlement/reverse-settlement.command.ts` + `.handler.ts`
- Modify: `debt/domain/aggregates/debt/debt.aggregate.ts` (+ spec), `debt-settlement.service.ts`, `reopen-debt.handler.ts` (тонкий), `commands/index.ts`
- Test: `debt.aggregate.spec.ts`, `debt-settlement.e2e-spec.ts`; `reopen-debt.handler.spec.ts` — переписать на делегирование

**Interfaces:**
- Consumes: Task 2 (`DeleteTransactionCommand` с `manager`), Task 4.
- Produces:
```ts
// Debt aggregate
revertSettlement(applied: number, forgiven: number): void;
// остаток = min(total, remaining + applied + forgiven); forgivenAmount = max(0, forgivenAmount − forgiven);
// при остатке > 0 — isClosed=false, closedAt=null, closeTransactionId=null
// DebtSettlementService
reverse(userId: string, settlementId: string, manager?: EntityManager): Promise<Debt[]>; // затронутые долги
reopen(userId: string, debtId: string): Promise<Debt>;
// команда для accounting
export class ReverseSettlementCommand { constructor(readonly settlementId: string, readonly userId: string, readonly manager?: EntityManager) {} }
```
Правила `applied`/`forgiven`, порядка (409 «Сначала отмените более поздний расчёт по долгу «Имя»») и
закрытого долга без расчёта — спека §5–§6. Чужой расчёт → 403, неизвестный → 404. Записи удаляются
через `DeleteTransactionCommand(id, userId, true, manager)`.

- [ ] Step 1: юнит агрегата `revertSettlement`: закрытый прощением долг (remaining 0, forgiven 200, total 300) + revert(100, 200) → remaining 300, forgiven 0, открыт, `closeTransactionId` null; частичный revert на открытом долге → остаток растёт, долг открыт; остаток не превышает total.
- [ ] Step 2: e2e «отмена закрытия после переплаты»: баланс счёта до платежа = после отмены; обе записи удалены; остаток 300, долг открыт.
- [ ] Step 3: e2e «отмена закрытия только прощением» (сумма 0 + прощение) → прощение снято, остаток восстановлен.
- [ ] Step 4: e2e «отмена закрытия отработкой с категорией» → обе ноги удалены, баланс прежний.
- [ ] Step 5: e2e «отмена зачёта с одной стороны» → оба долга открыты, остатки как до зачёта, записи зачёта удалены.
- [ ] Step 6: e2e «порядок»: зачёт given 300 / taken 100 (taken закрыт, у given остаётся 200), затем платёж 50 по given → отмена закрытия taken → 409 с именем долга given; ничего не изменилось.
- [ ] Step 7: e2e «закрытый долг без расчёта»: долг закрыт напрямую в БД (`is_closed = true`, без записей), одна старая запись возврата 100 без `settlement_id` → отмена закрытия → остаток 200, открыт.
- [ ] Step 8: красный → реализация → зелёный; `bun run build`.

### Task 6: удаление и правка записей, удаление долга, лента долга

**Files:**
- Modify: `accounting/application/commands/delete-transaction/delete-transaction.handler.ts`, `update-transaction/update-transaction.handler.ts`, `delete-debt/delete-debt.handler.ts` (тонкий), `debt-settlement.service.ts` (`removeDebt`), список транзакций с фильтром `debtId` (`accounting/infrastructure/persistence/repositories/transaction.repository.ts`)
- Test: соответствующие юнит-спеки, `debt-settlement.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 5 (`ReverseSettlementCommand`, `reverse`).
- Produces: `DebtSettlementService.removeDebt(userId: string, debtId: string): Promise<void>`.

Поведение (спека §6):
- `delete-transaction`: у записи есть `settlementId` и нет `skipDebtCheck` → `ReverseSettlementCommand` и выход. Прежние запреты по категориям (зачёт, отметка отработки, нога работы), `hasWorkLeg` и ветка «удалили прощение — переоткрыли долг» удаляются; запрет на запись зачёта/отработки/прощения **без** `settlementId` остаётся страховкой (400).
- `update-transaction`: у записи расчёта нельзя менять `amount`, `currency`, `type` и переводить категорию в долговую или из долговой → 400 «Запись расчёта по долгу меняется со стороны долга: отмените расчёт и проведите заново».
- `removeDebt`: одна транзакция БД; расчёты, где есть записи других долгов, отменяются через `reverse` (порядок проверяется); затем удаляются все записи долга (`debt_id`, записи его расчётов без `debt_id`, `transaction_id`, `close_transaction_id`, `source_transaction_id` если долг последний, `fee_transaction_id`) и сам долг.
- Фильтр `debtId` в списке транзакций: `debt_id = :debtId OR (debt_id IS NULL AND settlement_id IN (SELECT settlement_id FROM transactions WHERE debt_id = :debtId AND settlement_id IS NOT NULL))`.

- [ ] Step 1: e2e «удаление частичного платежа из ленты» → остаток и баланс как до платежа.
- [ ] Step 2: e2e «удаление из ленты записи переплаты» → снят весь расчёт.
- [ ] Step 3: e2e «удаление из ленты записи зачёта» → оба долга открыты.
- [ ] Step 4: e2e «правка суммы записи расчёта» → 400; правка описания и даты → 200.
- [ ] Step 5: e2e «удаление долга с зачётом» → встречный долг восстановлен, записи зачёта и долга удалены, баланс выдачи снят.
- [ ] Step 6: e2e «удаление долга, чей зачёт заблокирован поздним платежом по встречному» → 409, долг и все записи на месте.
- [ ] Step 7: e2e «удаление долга с комиссией» → запись комиссии тоже удалена.
- [ ] Step 8: e2e «лента долга отдаёт переплату»: `GET /api/transactions?debtId=` содержит запись переплаты расчёта.
- [ ] Step 9: красный → реализация → зелёный; юнит-спеки обработчиков приведены в соответствие; `bun run build`.

### Task 7: связка старых записей

**Files:**
- Create: `backend/src/database/migrations/1785900000001-BackfillTransactionSettlement.ts`
- Test: `backend/test/settlement-backfill.e2e-spec.ts`

Три шага `up` по спеке §8 (SQL, `gen_random_uuid()`), каждый только для `settlement_id IS NULL`:
платежи по `(debt_id, date)` с исключением записей из `debts.transaction_id/source_transaction_id/fee_transaction_id`;
зачёты по `(user_id, date, debts.currency, debts.person_name)`; переплаты — к расчёту последней записи
возврата того же пользователя, счёта и человека (`COALESCE(NULLIF(trim(person_name),''), trim(name))` =
имя из описания после `Переплата по долгу:`), созданной не позже и не раньше чем за 5 с. `down` — `UPDATE … SET settlement_id = NULL` для всех.

- [ ] Step 1: e2e: вставить «старые» записи без `settlement_id` (возврат + прощение одной даты; нога работы + возврат; два зачёта одной отметки; переплата через 1 с после возврата; запись выдачи с `debt_id`) → выполнить `up` миграции через `dataSource.createQueryRunner()` → проверить группы, что запись выдачи не связана и что повторный `up` ничего не меняет.
- [ ] Step 2: красный → миграция → зелёный; `bun run migration:run` на локальной БД.

### Task 8: клиент, фаза 1

**Files:**
- Modify: `frontend/src/entities/debt/lib/foldWorkOffRecords.ts`, `findClosingRecords.ts` (+ их спеки), поток удаления и правки транзакции из истории (найти: `features/edit-transaction/**`, удаление в `pages/history/**` или `entities/transaction/api/**`)

Поведение (спека §9):
- `foldWorkOffRecords(transactions, creationTransactionId)` — сигнатура прежняя; нога работы = запись с `debt_id` и недолговой категорией; возврат прячется, если в его `settlement_id` есть нога работы; записи без `debt_id` в ленту не попадают; сравнений по дате нет.
- `findClosingRecords(debt, transactions)` — сигнатура прежняя; все записи с `settlement_id` записи `close_transaction_id`; если у неё нет `settlement_id` — только она сама.
- Удаление записи с `settlement_id` из истории: в подтверждении текст «Это запись расчёта по долгу — удалится весь расчёт целиком, а остаток долга вернётся.»; после удаления — `invalidateDebtRelated`.
- Правка записи с `settlement_id`: поле суммы недоступно, подсказка «Сумму платежа по долгу меняют отменой расчёта на экране долга».

- [ ] Step 1: спеки `foldWorkOffRecords`: пара отработки одного расчёта → одна строка `byWork`; два платежа одной даты в разных расчётах → две строки; переплата без `debt_id` не попадает.
- [ ] Step 2: спеки `findClosingRecords`: закрытие с переплатой и прощением → все три записи; легаси без `settlement_id` → только закрывающая.
- [ ] Step 3: спека удаления: запись с `settlement_id` → показан текст про расчёт, после подтверждения вызван `invalidateDebtRelated`.
- [ ] Step 4: красный → реализация → зелёный; `bun run build` и `bun run lint` в `frontend/`.

## Фаза 2

### Task 9: «Закрыть все» на сервере

**Files:**
- Create: `debt/application/commands/close-all-debts/close-all-debts.command.ts` + `.handler.ts`; `debt/application/queries/preview-close-all/preview-close-all.query.ts` + `.handler.ts` (или в существующую папку запросов модуля); `debt/presentation/dto/close-all-debts.dto.ts`
- Modify: `debts.controller.ts` (`POST close-all`, `POST close-all/preview` — объявить до `:id`-маршрутов), `debt-settlement.service.ts`, регистрация в модуле
- Test: `debt-settlement.e2e-spec.ts`

**Interfaces — Produces:**
```ts
// DTO (camelCase)
{ debtIds: string[]; accountId: string; paymentAmount?: number; forgiveRemainder?: boolean; excessCategoryId?: string; date?: string }
// POST /debts/close-all → 201
{ settlementId: string; debts: DebtResponseDto[]; paymentTransactionIds: string[]; offsetAmount: number; excess: number }
// POST /debts/close-all/preview → 200
{ offsetAmount: number; direction: 'given' | 'taken' | null; net: number;
  offsetParts: { debtId: string; amount: number }[];
  payments: { debtId: string; amount: number; forgive: boolean; withExcess: boolean }[];
  excess: number; totalDebt: number }
DebtSettlementService.closeAll(input: CloseAllInput & { userId: string }): Promise<CloseAllResultDto>;
DebtSettlementService.previewCloseAll(input: CloseAllInput & { userId: string }): Promise<CloseAllPreviewDto>;
```
Проверки: все долги пользователя и открыты (иначе 404/409), обе стороны → одна валюта (400 «Встречные долги сводятся только в одной валюте»). Один `SettlementWriter` на зачёт и все платежи; записи платежей — теми же правилами, что `pay`.

- [ ] Step 1: e2e «закрыть все с зачётом и переплатой» → все долги закрыты, все записи с одним `settlement_id`, баланс счёта изменился на сумму платежа.
- [ ] Step 2: e2e «предпросмотр совпадает с исполнением»: `preview` → `close-all` с тем же телом → суммы зачёта и платежей по долгам равны.
- [ ] Step 3: e2e «отмена закрытия одного долга после закрыть все» → открыты все долги расчёта, баланс как до.
- [ ] Step 4: e2e «сбой посередине откатывает всё»: второй долг в списке чужого пользователя → 404/403, первый не тронут.
- [ ] Step 5: красный → реализация → зелёный; `bun run build`.

### Task 10: клиент, фаза 2

**Files:**
- Modify: `frontend/src/entities/debt/api/debtsApi.ts` (`closeAll`, `previewCloseAll` + типы snake_case), `features/pay-debt/model/useCloseAllDebts.ts`, `features/pay-debt/ui/CloseAllDebtsDrawer.vue`, `features/pay-debt/model/usePayDebt.ts` (удалить `bulk`), вызывающие места (`pages/debts/**/useDebtsPage.ts`, `pages/import-inbox/confirm/ImportConfirmPage.vue`) — только если меняется сигнатура
- Delete: `features/pay-debt/model/mutualSettlement.ts` и его спека, если после замены нет потребителей (`canSettleTogether`/`hasBothDirections` в `useDebtsPage` заменить проверкой ответа сервера или оставить в `entities/debt/lib` только то, что нужно UI до запроса)
- Test: `useCloseAllDebts.spec.ts`, `CloseAllDebtsDrawer.spec.ts`

Поведение:
- `closeAllDebts(debts, accountId, userId, options)` — публичная сигнатура и `CloseAllOptions` прежние; внутри один `debtsApi.closeAll`; `onTransactionCreated(paymentTransactionIds[0])`, если есть; кэш: `applyDebtUpdate` по каждому долгу ответа, затем `invalidateDebtRelated`; тосты прежние, «Зачёт проведён, остаток не закрыт» больше не нужен.
- Шторка: предпросмотр — `useQuery` по `previewCloseAll` с ключом из входа, дебаунс суммы 300 мс, `placeholderData: keepPreviousData`; пока нет ответа — скелет строк.

- [ ] Step 1: спека `useCloseAllDebts`: один вызов `closeAll` с телом из аргументов; `onTransactionCreated` с первым id; ошибка → тост и `false`.
- [ ] Step 2: спека шторки: показывает суммы зачёта и платежей из ответа `preview` (MSW).
- [ ] Step 3: красный → реализация → зелёный; `bun run build`, `bun run lint` в `frontend/`.

### Task 11: завершение

- [ ] Changelog `frontend/src/features/changelog/model/changelogData.ts`: версия `1.0.95`, тип `fix`, по-русски простым языком: отмена закрытия убирает и переплату; удаление платежа из истории возвращает остаток долга; долг после зачёта можно удалить; «Закрыть все» проходит целиком или не проходит вовсе.
- [ ] `backend/CLAUDE.md` → Gotchas: одна строка про `settlement_id` (записи расчёта пишет и снимает только модуль `debt/application/settlement`).
- [ ] `bun run build` в `backend/` и `frontend/`; все юнит- и e2e-тесты зелёные.
