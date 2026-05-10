# Analytics: исправление tot­alExpense для split/receipt-расходов

**Дата:** 2026-05-10
**Статус:** Design approved
**Scope:** backend, аналитика, query handler

## Проблема

В аналитике (`/api/transactions/analytics-stats`) показатель «Сумма расходов» (`totalExpense` и `expenseByCurrency`) **не учитывает** возвраты по долгам, созданным через split-expense или scan-receipt. В то же время:

- Разрез по категориям (`categoryBreakdown`) — учитывает.
- Дневной график (`getDailyStats`) — учитывает.

В результате круговая диаграмма «Топ категорий», дневной график и общий тотал расходятся: total в шапке больше, чем сумма по категориям.

### Воспроизведение

1. Создать expense на 100 000 в категории «Еда» (через scan-receipt или add-transaction).
2. Создать N долгов `given` с `source_transaction_id` = id созданной транзакции (это делает split-expense / scan-receipt автоматически).
3. Принять полные возвраты (categories `debt_return_to_me`, `is_debt_related = true`).
4. Открыть аналитику за период.

**Ожидание:** total expense = 100 000 − сумма возвратов.
**Факт:** total expense = 100 000.

### Корень

`backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts:614`:

```typescript
const netExpense = regularExpense + Math.max(0, debtGiven - debtReturnsToMe);
```

`regularExpense` — все expense без `is_debt_related` и не из debt-категорий. Сюда попадают split/receipt расходы. `debtReturnsToMe` вычитается только из `debtGiven` (категория `debt_given`), но не из `regularExpense`. Возвраты по split/receipt-долгам никуда не вычитаются на уровне total.

`categoryBreakdown` уже корректен: отдельный JOIN-запрос `categoryOffsetsQuery` (строки 671–700) находит исходную категорию через `Debt.source_transaction_id` и вычитает возвраты.

`getDailyStats` тоже корректен: `debtReturnsQuery` (строки 818–839) атрибутирует возврат к дате исходной транзакции и отнимает от expense.

## Решение

Добавить третий параллельный запрос в `getAnalyticsStats` — `regularExpenseOffsetsQuery`. По структуре близок к существующему `categoryOffsetsQuery`, но:

- Группируется только по `currency` (не по `category_id`).
- Добавляет фильтр `source_tx.type = 'expense' AND source_tx.category_id NOT IN (debt_ids)` — чтобы не возникало двойного учёта с уже работающей формулой `max(0, debtGiven - debtReturnsToMe)`.

Применить полученные суммы как офсет к `regularExpense` и `regularExpenseByCurrency` с cap `Math.max(0, x - offset)`.

## Семантика после фикса

«Сумма расходов» = фактически потраченное = `(regular expense − всё, что мне вернули по долгам со ссылкой на эти расходы)` + `(прямые долги − возвраты по ним)`.

Эта семантика уже работает в `categoryBreakdown` и `getDailyStats`. Фикс делает их согласованными с total.

### Edge case: возврат больше исходного расхода

Cap `Math.max(0, regularExpense - offset)` гарантирует неотрицательность. Поведение симметрично существующему: в `categoryBreakdown` категория с офсетом ≥ amount удаляется (`transaction.repository.ts:779-781`), в `getDailyStats` тот же `Math.max(0, ...)` (`transaction.repository.ts:912-915`).

## Архитектура

**Файл:** `backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts`, метод `getAnalyticsStats` (строки 514–792).

**Что меняется:**

1. Добавляется `regularExpenseOffsetsQuery` (~25 строк) перед существующим `Promise.all`.
2. `Promise.all` расширяется до трёх элементов.
3. После цикла парсинга `rows` (строки 567–610) добавляется блок агрегации `regularExpenseOffsetsResult` в `regularExpenseOffsetsByCurrency` + `regularExpenseOffsetsTotal` (~6 строк).
4. Меняется формула `netExpense` (строка 614) — добавляется `Math.max(0, regularExpense - regularExpenseOffsetsTotal)`.
5. В цикле `for (const currency of allCurrencies)` (строки 629–647) `expenseVal` заменяется на `Math.max(0, expenseVal - offset)`.
6. `allCurrencies` (строка 617) дополняется ключами из `regularExpenseOffsetsByCurrency`.

**Не меняется:**

- `categoryBreakdown` логика (строки 649–783) — уже корректна.
- `getDailyStats` — уже корректен.
- `getMonthlyStats` — баг там тоже есть, но scope текущей задачи — аналитика. См. Out of scope.
- Контракт API (`AnalyticsStats` interface) — без изменений.
- Frontend (`useAnalyticsStats`, `mapCategoryBreakdown`, виджеты) — без изменений.
- Income side (`totalIncome`, `incomeByCurrency`) — без изменений (см. Out of scope).

## Поток данных

```
[1 SQL aggregate query] → regular* + debt* sums per type/category/currency
[3 parallel SQL queries]:
  ├─ categoryBreakdown        (existing)
  ├─ categoryOffsets          (existing — для breakdown)
  └─ regularExpenseOffsets    (NEW — для total)
↓
apply: cat offsets → categoryMap                       (existing)
apply: regularExpenseOffsets → regularExpense + per-currency  (NEW)
↓
return { totalIncome, totalExpense, incomeByCurrency, expenseByCurrency, categoryBreakdown }
```

## SQL нового запроса

```typescript
let regularExpenseOffsetsQuery = this.ormRepository
  .createQueryBuilder('return_tx')
  .innerJoin(
    DebtOrmEntity,
    'd',
    '(return_tx.debt_id IS NOT NULL AND return_tx.debt_id = d.id) OR (return_tx.debt_id IS NULL AND d.close_transaction_id = return_tx.id)',
  )
  .innerJoin(
    TransactionOrmEntity,
    'source_tx',
    'source_tx.id = COALESCE(d.source_transaction_id, d.transaction_id)',
  )
  .where('return_tx.user_id = :userId', { userId })
  .andWhere('return_tx.date >= :startDate', { startDate })
  .andWhere('return_tx.date <= :endDate', { endDate })
  .andWhere('return_tx.category_id = :returnToMeId', {
    returnToMeId: DEBT_CATEGORY_IDS.RETURN_TO_ME,
  })
  .andWhere('return_tx.is_debt_related = true')
  .andWhere("source_tx.type = 'expense'")
  .andWhere('source_tx.category_id NOT IN (:...debtIds)', { debtIds: ALL_DEBT_CATEGORY_IDS })
  .select('source_tx.currency', 'currency')
  .addSelect('SUM(return_tx.amount)', 'offsetAmount')
  .groupBy('source_tx.currency');

if (accountIds && accountIds.length > 0) {
  regularExpenseOffsetsQuery = regularExpenseOffsetsQuery.andWhere(
    'return_tx.account_id IN (:...accountIds)',
    { accountIds },
  );
}
```

## Применение офсетов

```typescript
// После цикла parsing rows (после строки 610)
const regularExpenseOffsetsByCurrency: Record<string, number> = {};
let regularExpenseOffsetsTotal = 0;
for (const row of regularExpenseOffsetsResult) {
  const amount = Number(row.offsetAmount ?? 0);
  regularExpenseOffsetsByCurrency[row.currency] = amount;
  regularExpenseOffsetsTotal += amount;
}

// Меняем (было строка 614):
const adjustedRegularExpense = Math.max(0, regularExpense - regularExpenseOffsetsTotal);
const netExpense = adjustedRegularExpense + Math.max(0, debtGiven - debtReturnsToMe);

// Расширяем allCurrencies (строка 617): добавить
//   ...Object.keys(regularExpenseOffsetsByCurrency)

// В цикле for (const currency of allCurrencies) (строки 629–647):
const offset = regularExpenseOffsetsByCurrency[currency] ?? 0;
const adjustedExpense = Math.max(0, expenseVal - offset);
const netExpenseForCurrency = adjustedExpense + Math.max(0, givenVal - returnsToMe);
```

## Обработка ошибок

Read-only запрос без сайд-эффектов.

- **Пустой результат** → `regularExpenseOffsetsTotal = 0`, поведение идентично текущему.
- **NULL суммы** → `Number(row.offsetAmount ?? 0)`.
- **SQL-ошибка в JOIN** → пробрасывается через `Promise.all`, обработка идентична существующим запросам в этом методе (NestJS exception filter → 500).
- **Отрицательный результат** → cap `Math.max(0, ...)` на total и per-currency.

## Тесты

Файл: `backend/src/modules/accounting/application/queries/get-analytics-stats/get-analytics-stats.handler.spec.ts`.

1. **Базовый split-расход (regression).** Expense 100 000 (Еда), 2 долга `given` × 35 000 с `source_transaction_id`, 2 возврата `debt_return_to_me` × 35 000 с `is_debt_related = true`. Ожидаем `totalExpense === 30 000`, `expenseByCurrency.UZS === 30 000`, `categoryBreakdown[Еда].amount === 30 000`. **Все три значения согласованы.**

2. **Частичный возврат.** Expense 100 000, долг 70 000, возврат 30 000. Ожидаем `totalExpense === 70 000`.

3. **Возврат больше исходного расхода (cap).** Expense 50 000 (Еда), возврат 80 000 на эту же категорию. Ожидаем `totalExpense === 0`, `expenseByCurrency.UZS` отсутствует или `0`, `categoryBreakdown` без «Еды».

4. **Прямой `debt_given` НЕ дабл-офсетится.** Транзакция `debt_given` 50 000 (создана прямым debt без `source_transaction_id`), возврат 50 000. Ожидаем `totalExpense === 0`, **не** `−50 000`. Критический тест от двойного учёта.

5. **Multi-currency.** USD expense 100 + UZS expense 100 000, USD возврат 30 на USD source. Ожидаем `expenseByCurrency.USD === 70`, `expenseByCurrency.UZS === 100 000`.

6. **Account filter.** Expense на счёте A 100 000, возврат на счёте B 50 000. С `accountIds = [A]`: ожидаем `totalExpense === 100 000` (возврат не попадает по фильтру `return_tx.account_id IN [A]`).

7. **Возврат вне периода.** Expense в марте, возврат в апреле, фильтр на март. Ожидаем `totalExpense === expense` (возврат не входит по `return_tx.date BETWEEN ...`).

Существующие тесты должны продолжать проходить. Если найдётся тест, опирающийся на старое поведение «split не вычитается из total» — обновить с комментарием.

## Out of scope

- **`getMonthlyStats`** (используется в дашборде через `useMonthlyStats`). Тот же баг есть и там, но scope задачи — вкладка аналитики. Отдельная задача.
- **Income side** (`totalIncome`, `incomeByCurrency`). Возвраты `debt_return_from_me` теоретически могут быть привязаны к обычной income-транзакции через `source_transaction_id`, но в текущей кодовой базе нет UX-флоу, который бы это создавал (split-expense только для расходов, scan-receipt только для расходов). Не трогаем.
- **Frontend.** Контракт API не меняется, frontend изменений не требует.
- **Migration / data backfill.** Не требуется — изменение только в read-path.

## Риски

- **Performance.** Один дополнительный JOIN-запрос с двумя innerJoin. Выполняется параллельно с двумя другими через `Promise.all`. Аналогичный по сложности `categoryOffsetsQuery` уже работает в этом же методе. Влияние на p95 ожидается минимальным.
- **Двойной учёт.** Защищён фильтром `source_tx.category_id NOT IN (debt_ids) AND source_tx.type = 'expense'`. Покрыт тестом #4.
- **Регрессия в существующих сценариях.** Покрыто тестом #4 (прямой `debt_given`) и существующими тестами в spec-файле.
