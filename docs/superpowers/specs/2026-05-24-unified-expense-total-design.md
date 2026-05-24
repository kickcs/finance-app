# Единая формула «Мой расход» во всех виджетах

**Дата:** 2026-05-24
**Статус:** Design approved
**Scope:** backend (analytics + budget), frontend (analytics page, dashboard)
**Связанные:** [2026-05-10-analytics-expense-debt-offset-design.md](./2026-05-10-analytics-expense-debt-offset-design.md) (предыдущий шаг, покрыл `getAnalyticsStats`, оставил `getMonthlyStats` и асимметрию cap'ов в out-of-scope)

## Проблема

Пользователь видит **разные суммы «общих расходов» на одном экране**:

| Виджет | Цифра | Источник |
|---|---|---|
| Аналитика → StatCard «Расходы» | **−4,89 млн UZS** | `getAnalyticsStats.expenseByCurrency` |
| Аналитика → Норма сбережений «Расходы» | **−4,89 млн UZS** | то же |
| Аналитика → Топ категорий, центр пончика «Всего» | **5,14 млн UZS** | `sum(getAnalyticsStats.categoryBreakdown)` |
| Дашборд → Бюджет на месяц «потрачено» | **7,49 млн UZS** | `getMonthlyStats.expenseByCurrency` |

Плюс:
- **Норма сбережений = +1,19 млн UZS** при доходах 200к и расходах 4,89 млн — это `availableBalance` (остаток счетов), а не сбережения периода. Семантический баг.

Пользователь не может опереться ни на одну цифру как на «достоверную сумму, которую он потратил».

## Корень

### Баг 1: асимметрия cap'ов между `totalExpense` и `categoryBreakdown`

`backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts:516–818`

- `categoryBreakdown` применяет офсет с **cap по категории**: `Math.min(offsetAmount, category.amount)` (строка 793).
- `totalExpense` применяет общий `regularExpenseOffsetsTotal` к `regularExpense` **без cap по категории**: `Math.max(0, regularExpense − regularExpenseOffsetsTotal)` (строка 706).

Случай: возврат 100к на категорию, где осталось 60к → пончик уменьшится на 60к, а `totalExpense` — на 100к. Разница 40к «теряется». Воспроизводимо, когда возвраты приходят с лагом относительно расходов и периода фильтра.

### Баг 2: `getMonthlyStats` не учитывает split-возвраты

`transaction.repository.ts:400–514` — формула `netExpense = regularExpense + max(0, debtGiven − debtReturnsToMe)`. **Нет** `regularExpenseOffsetsTotal`. → Бюджет на дашборде показывает раздутую сумму. Это явный out-of-scope из [предыдущей спеки](./2026-05-10-analytics-expense-debt-offset-design.md).

### Баг 3: `SavingsGauge` показывает остаток счетов как «сбережения»

`frontend/src/widgets/analytics/savings-gauge/ui/SavingsGauge.vue` принимает `availableBalance` (текущий остаток счетов) и показывает его как «Сбережения +1,19 млн». При отрицательном балансе периода это вводит в заблуждение.

## Решение

### Принцип: «Total = sum(категории)» — алгебраическая идентичность

`totalExpense` определяется **как сумма** `categoryBreakdown` плюс синтетическая категория «Долги невозвращённые» (если есть невозвращённое сальдо). Backend больше не вычисляет `totalExpense` отдельной формулой — он его **получает** из уже посчитанных категорий.

```
expenseByCurrency[c] =
    Σ over categories: max(0, category.amount[c] - categoryOffset[c])
  + max(0, debtGiven[c] - debtReturnsToMe[c])

totalExpense = Σ over c: expenseByCurrency[c] (после конверсии в base currency)
```

Это автоматически устраняет:
- Баг 1 — нет асимметрии, total и sum(категорий) идентичны по построению.
- Расхождение между Аналитикой и Бюджетом (см. ниже).

### Синтетическая категория «Долги невозвращённые»

Если `max(0, debtGiven[c] - debtReturnsToMe[c]) > 0`, в `categoryBreakdown` добавляется псевдо-категория:

```ts
{
  categoryId: '__unreturned_debt__',
  categoryName: 'Невозвращённые долги',
  categoryIcon: 'handshake',
  categoryColor: '#9CA3AF',
  type: 'expense',
  amount: max(0, debtGiven - debtReturnsToMe),
  amountByCurrency: { [c]: max(0, debtGiven[c] - debtReturnsToMe[c]), ... },
}
```

Пончик показывает её наравне с обычными категориями. Цвет нейтральный серый, чтобы визуально отличаться от расходных категорий.

### Унификация `getMonthlyStats` → удалить, использовать `getAnalyticsStats`

`getMonthlyStats` дублирует `getAnalyticsStats` с урезанной формулой. Удалить метод и переписать `GetBudgetForMonthHandler` так, чтобы он вызывал `getAnalyticsStats(userId, { startDate, endDate })` с границами финансового месяца. Один источник истины → бюджет автоматически согласован с аналитикой.

**Диапазон дат:** `getAnalyticsStats` использует `t.date <= endDate` (inclusive), `getMonthlyStats` — `<` (exclusive). При переходе делаем inclusive: `endDate = lastDayOfFinancialMonth`.

### Frontend: удалить `SavingsGauge`

Виджет «Норма сбережений» имеет сломанную семантику (показывает остаток счетов, а не сбережения периода). Удаляем:
- Файл `frontend/src/widgets/analytics/savings-gauge/ui/SavingsGauge.vue` + skeleton.
- Экспорт из `widgets/analytics/index.ts`.
- Импорт и использование в `pages/analytics/AnalyticsPage.vue`.
- `availableBalance` computed в `AnalyticsPage.vue` (становится мёртвым — удалить, если не используется ещё где-то).

`IncomeExpenseBar` остаётся — он уже показывает корректные «Доходы / Расходы / Баланс».

## Архитектура

### Backend изменения

**Файл:** `backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts`

1. **`getAnalyticsStats` (строки 516–818):**
   - Удалить вычисление `regularExpenseOffsetsTotal` и его применение к `regularExpense` / `expenseByCurrency` (строки 695–706 и 731–736).
   - Перенести `Promise.all` так, чтобы `categoryOffsetsResult` всё ещё применялся к `categoryMap` (как сейчас, строки 783–809).
   - После применения `categoryOffsets` пересчитать `expenseByCurrency` и `totalExpense` **из `categoryMap` + долгового сальдо**:
     ```ts
     const expenseByCurrency: Record<string, number> = {};
     for (const cat of categoryMap.values()) {
       if (cat.type !== 'expense') continue;
       for (const [c, amt] of Object.entries(cat.amountByCurrency)) {
         expenseByCurrency[c] = (expenseByCurrency[c] ?? 0) + amt;
       }
     }
     // Добавить невозвращённое сальдо долгов
     for (const c of allCurrencies) {
       const unreturned = Math.max(0, (debtGivenByCurrency[c] ?? 0) - (debtReturnsToMeByCurrency[c] ?? 0));
       if (unreturned > 0) {
         expenseByCurrency[c] = (expenseByCurrency[c] ?? 0) + unreturned;
       }
     }
     const totalExpense = ... (после конверсии)
     ```
   - Добавить синтетическую категорию `__unreturned_debt__` в `categoryMap`, если есть невозвращённое сальдо.
   - Аналогично для `incomeByCurrency` / `totalIncome` (там тоже есть `debtTaken − debtReturnsFromMe` — не trogаем формулу, но переносим её внутрь категорийной модели; income категорий-офсетов сейчас нет, так что просто перенос).

2. **`getMonthlyStats` (строки 400–514):**
   - **Удалить метод** из интерфейса `ITransactionRepository` и реализации.
   - Все callers (`GetBudgetForMonthHandler` и любые другие — проверить grep) переписать на `getAnalyticsStats`.

**Файл:** `backend/src/modules/planning/application/queries/get-budget-for-month/get-budget-for-month.handler.ts`

```ts
// Было:
const stats = await this.transactionRepository.getMonthlyStats(
  query.userId, query.year, query.month, query.startDay,
);

// Стало:
const { start, end } = getFinancialMonthBounds(query.year, query.month, query.startDay);
const endInclusive = new Date(end.getTime() - 1);
const stats = await this.transactionRepository.getAnalyticsStats(query.userId, {
  startDate: toLocalISODate(start),
  endDate: toLocalISODate(endInclusive),
});
```

`spent`, `remaining`, `percentage` считаются как сейчас (`convertExpensesToCurrency(stats.expenseByCurrency, budget.currency, ...)`).

**Контракт API:** не меняется. `AnalyticsStats` и `BudgetForMonthResponse` — те же поля.

### Frontend изменения

**Файл:** `frontend/src/pages/analytics/AnalyticsPage.vue`

- Удалить импорт `SavingsGauge`.
- Удалить `<SavingsGauge ... />` блок (строки 474–480 в текущем файле).
- `availableBalance` computed (строки 124–140) — **оставить**, его использует `DailyStatsCards` (props `available-balance`, строка 485 в AnalyticsPage.vue → `DailyStatsCards.vue:25-26`).

**Файл:** `frontend/src/widgets/analytics/savings-gauge/` — **удалить всю директорию**.

**Файл:** `frontend/src/widgets/analytics/index.ts` — убрать экспорт `SavingsGauge`.

**Файл:** `frontend/src/features/analytics-filters/model/mapCategoryBreakdown.ts` — без изменений, синтетическая категория `__unreturned_debt__` будет обработана как обычная (имеет `category_name`, `category_icon`, `category_color`).

**Дашборд (`useDashboardData.ts`, `BudgetSection.vue`):** изменений не требует. `useBudget` дёргает тот же `/api/budgets/...`, бэк просто возвращает корректное число.

## Поток данных (после фикса)

```
getAnalyticsStats:
  ├─ 1 aggregate SQL (regular/debt totals by type/category/currency)
  └─ Promise.all (2 queries):
       ├─ categoryBreakdownQuery
       └─ categoryOffsetsQuery
  → categoryMap with offsets applied (capped per category)
  → expenseByCurrency = Σ categoryMap[expense] + max(0, debtGiven − debtReturnsToMe) (per currency)
  → categoryBreakdown = [...categoryMap.values(), __unreturned_debt__?]
  → return { totalIncome, totalExpense, incomeByCurrency, expenseByCurrency, categoryBreakdown }

Удалён: regularExpenseOffsetsQuery (из spec 2026-05-10) — больше не нужен,
                                                      идентичность достигается через categoryMap.

GetBudgetForMonthHandler:
  → вызывает getAnalyticsStats (а не getMonthlyStats)
  → spent = convert(expenseByCurrency, budget.currency)
```

## Edge cases

| Сценарий | Поведение |
|---|---|
| Split: расход 200к, долг 120к, возврат 80к | «Кафе» = 200−80 = **120к**. Невозвращённый долг = 120−80 = 40к → попадает в «Кафе» (capped offset). ✓ |
| Split: расход 200к, долг 120к, возврат **150к** (больше долга) | категория «Кафе» = max(0, 200−150) = **50к** (overshoot обнуляет категорию через cap). Это уже текущее поведение `categoryOffsets`. ✓ |
| Прямой `debt_given` 1000, возврат 200 | синтетическая «Невозвращённые долги» = **800**, в пончике как отдельный сегмент. ✓ |
| Полный возврат прямого долга | синтетическая категория не добавляется. ✓ |
| Период без активности | `categoryBreakdown = []`, `totalExpense = 0`. ✓ |
| Бюджет за прошлый финансовый месяц | `getAnalyticsStats(startOfPrevFM, endOfPrevFM)` — корректные границы из `getFinancialMonthBounds`. ✓ |

## Тесты

### Backend

**Файл:** `backend/src/modules/accounting/application/queries/get-analytics-stats/get-analytics-stats.handler.spec.ts`

Добавить тесты:

1. **Идентичность total и sum(categoryBreakdown).** Расход 100к (Еда) + расход 50к (Транспорт) + долг 70к, возврат 30к. Ожидаем `totalExpense === sum(categoryBreakdown.amount)` (в base currency). Поломается, если кто-то снова разведёт формулы.
2. **Синтетическая категория «Невозвращённые долги».** Прямой `debt_given` 1000, возврат 200. Ожидаем в `categoryBreakdown` запись с `categoryId === '__unreturned_debt__'`, `amount === 800`.
3. **Синтетическая категория отсутствует при полном возврате.** Прямой `debt_given` 500, возврат 500. Ожидаем, что в `categoryBreakdown` нет `__unreturned_debt__`.
4. **Capped offset на split-расходе.** Расход 100к (Еда), 2 долга по 70к (всего 140к — overshoot), 2 возврата по 70к. Ожидаем «Еда» = max(0, 100−140) = 0, total = 0.
5. **Регрессия из spec 2026-05-10** (тесты 1–7) должны продолжать проходить.

**Файл:** `backend/src/modules/planning/application/queries/get-budget-for-month/get-budget-for-month.handler.spec.ts`

1. Обновить моки: вместо `getMonthlyStats` мокать `getAnalyticsStats`.
2. Добавить тест «бюджет учитывает split-возвраты» — расход 100к, возврат 30к → `spent === 70к` (раньше был 100к).

**Удалить:** `get-monthly-stats.handler.spec.ts` (если есть отдельный handler) или соответствующие тесты в репозитории.

### Frontend

Snapshot UI тестов нет. Ручная проверка:

1. Открыть Аналитику. Сравнить «Расходы» в StatCard и «Всего» в центре пончика — **должны совпадать**.
2. Открыть Дашборд. Сравнить «потрачено в бюджете» с «Расходы» в Аналитике за тот же финансовый месяц — **должны совпадать**.
3. Убедиться, что `SavingsGauge` исчез со страницы Аналитики.
4. Создать split-расход, оформить частичный возврат — проверить «Кафе» уменьшилось на сумму возврата, в пончике есть «Невозвращённые долги» только если долг ещё открыт.

## Миграции / data backfill

Не требуется. Изменения только в read-path. Синтетическая категория `__unreturned_debt__` — это runtime-конструкция, в БД не сохраняется.

## Контракт API

Без breaking changes:
- `AnalyticsStats` поля те же.
- `BudgetForMonthResponse` поля те же.
- `categoryBreakdown` теперь **может** содержать запись с `categoryId === '__unreturned_debt__'`. Frontend `mapCategoryBreakdown` обработает её как любую другую категорию (она имеет name/icon/color). Никакого special-case на фронте.

## Out of scope

- **`SaveSpendSection` / другие виджеты дашборда** — отдельная задача. Сейчас они используют `useAnalyticsStats` за финансовый месяц, после фикса автоматически получат корректные цифры.
- **Income side**: симметричная нормализация для `totalIncome` через `categoryBreakdown` дохода. Income-категории сейчас не имеют offsets (нет UX-флоу split-income), поэтому формула `totalIncome = regularIncome + max(0, debtTaken − debtReturnsFromMe)` остаётся как есть. Если будущая фича добавит split-income, нужно будет применить тот же подход.
- **Performance**: один SQL-запрос меньше (удалили `regularExpenseOffsetsQuery`), `Promise.all` теперь из 2 элементов.
- **Renaming `getAnalyticsStats`**: метод теперь покрывает и бюджет, и аналитику. Можно переименовать в `getExpenseStats` для ясности, но это косметика — отдельная задача.

## Риски

- **Регрессия в `getBudget`.** Покрыто новым тестом + ручной проверкой.
- **Performance `getBudgetForMonth`.** Был 2 SQL-запроса (`getMonthlyStats`: scalar + by-currency), станет 3 (`getAnalyticsStats`: aggregate + categoryBreakdown + categoryOffsets — последние два параллельно через `Promise.all`). По данным prod ожидаемая дельта p95 < 10 мс. `getAnalyticsStats` после фикса стал на один запрос **легче** (удалён `regularExpenseOffsetsQuery` из spec 2026-05-10) — общий бюджет на запросы аналитики снизился.
- **Синтетическая категория ломает frontend.** Защищено выбором безопасных полей: `__unreturned_debt__` имеет валидный name/icon/color, `mapCategoryBreakdown` не делает switch по id. Покрыто ручной проверкой #4.
- **Дашборд `useDashboardData` уже использует `getAnalyticsStats`** — для top-categories. После фикса категорий в нём появится `__unreturned_debt__`. Это ожидаемо и полезно: на дашборде в «Топ расходы» юзер увидит «невозвращённые долги» наравне с обычными категориями.
