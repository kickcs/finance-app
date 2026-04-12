# Создание долга со страницы «Новая транзакция»

**Дата:** 2026-04-12
**Тип:** feature + improvement + refactor

## Цель

Перенести фичу создания долга с отдельного drawer (`features/create-debt/ui/CreateDebtDrawer.vue`, открываемого с `DebtsListPage`) в страницу `AddTransactionPage` как 4-й режим наравне с Расходом / Доходом / Переводом. Попутно:

1. Заменить обычный `UInput variant="currency" type="number"` на общий `HeroAmount` с разделением цифр по разрядам — как в панелях транзакций.
2. Убрать полноразмерный `UTabs` «Я дал в долг / Я взял в долг» и заменить его компактным pill-сегментом под суммой.

## Не входит в скоуп

- Pre-fill направления из query-параметра (`?direction=given`) — можно добавить позже, если появится quick-action «Я дал Косте 500₽» с дашборда.
- Редизайн `DebtsListPage` помимо удаления drawer и замены обработчика кнопки «Создать долг».
- Изменения backend API, схемы БД, TanStack Query кэш-инвалидации.
- Редактирование существующего долга — продолжает использовать отдельный flow.

## Текущее состояние

- `features/create-debt/`: `CreateDebtDrawer.vue` (vaul-vue drawer), `useCreateDebt.ts` (форма + мутация create-transaction → create-debt → link-back + rollback), `DatePickerField.vue`, `ToggleRow.vue`, тесты `useCreateDebt.spec.ts`.
- Форма долга в drawer использует `UInput type="number"` без форматирования разрядов — визуальное расхождение с транзакциями, где `HeroAmount` форматирует через `formatNumberWithSpaces`.
- Направление долга выбирается через полноразмерный `UTabs` с лейблами из `DEBT_DIRECTION_LABELS` («Я дал в долг» / «Я взял в долг»).
- Drawer открывается только из `pages/debts/list/DebtsListPage.vue` (строки 8, 87, 482).
- На `AddTransactionPage` панели транзакций свайпаются через циклический `useScrollableTabs` с порядком `['expense', 'income', 'transfer']`. Каждая панель (`ExpensePanel`, `IncomePanel`, `TransferPanel`) владеет своей разметкой, но форма (`useTransactionForm`) — общая.
- `TransactionForm.vue` содержит bottom-секцию «Комментарий / Дата / Submit», единую для всех режимов.

## Решение

### 1. Архитектура и поток состояния

**4-й таб «Долг» в существующем свайпере:**

- `TRANSACTION_TYPE_ORDER` в `features/add-transaction/model/useScrollableTabs.ts` расширяется до `['expense', 'income', 'transfer', 'debt'] as const`. `CYCLIC_PANEL_ORDER` регенерируется автоматически — свайпер полиморфен по длине, дополнительных правок не нужно.
- `TransactionForm.vue`: `tabItems` получает 4-й элемент `{ id: 'debt', label: 'Долг' }`.
- `useTransactionForm.TransactionFormData['type']` расширяется до `'income' | 'expense' | 'transfer' | 'debt'`. `setType('debt')` выступает маркером активного таба — другие поля (`categoryId`, `toAccountId` и т.п.) остаются пустыми и не используются.

**Изолированное состояние долга:**

- Поля долга (`debt_type`, `person_name`, `debt_date`, `due_date`, `is_private`, `skip_transaction`) не пересекаются с `TransactionFormData`. Попытка вкорячить их в общую модель сломает `isValid` для 4 режимов и размажет rollback-логику по странице.
- `DebtPanel.vue` (новый, `features/add-transaction/ui/`) — self-contained: внутри вызывает `useDebtForm()` (переименованный `useCreateDebt`), хранит все поля долга локально, имеет свою кнопку submit, эмитит `submitted` наверх.
- `TransactionForm.vue` условно скрывает свою bottom-секцию (Комментарий / Дата / Submit) при `type === 'debt'` — у долга своя кнопка и свои поля внутри панели.

**Интеграция в `AddTransactionPage.vue`:**

- `onMounted` уже обрабатывает `route.query.type`. Добавляется ветка `if (typeParam === 'debt') setType('debt')`. Pre-select `categoryId`/`accountId` для долга не применяется.
- `handleSubmit()` получает ранний выход: `if (formData.value.type === 'debt') return;` — субмит долга происходит внутри `DebtPanel`.
- `TransactionForm` эмитит новое событие `@debt-submitted`, страница по нему вызывает `navigateBack()`. Событие приходит из `DebtPanel` через проброс в `TransactionForm`.

### 2. DebtPanel — layout и компоненты

`DebtPanel.vue` рендерит сверху вниз в контейнере `.space-y-2`:

1. **`HeroAmount`** — тот же компонент из `features/add-transaction/ui/HeroAmount.vue`. Обеспечивает `formatNumberWithSpaces`, мульти-валютный popover, автофокус по `autofocusAmount`. Привязан к `debtForm.amount` / `debtForm.currency`.

2. **`DebtDirectionPill.vue` (новый мини-компонент)** — сразу под `HeroAmount`, центрирован. Pill-сегмент `rounded-full` с двумя кнопками: `↗ Дал` / `↘ Взял`. Активная — `bg-card-light dark:bg-card-dark` + `shadow-sm`, неактивная — прозрачная + `text-text-secondary`. Высота ~32-36px. Tap → `trigger('selection')` + update `debt_type`. Иконки через `UIcon` (`arrow_outward` / `south_east` или подходящий маппинг в `iconMap.ts`).

3. **`PersonSelector`** из `@/entities/person`. Label переключается: `given` → «Кому дали в долг», `taken` → «У кого взяли в долг». Использует существующие `usePeople` + `createPerson`.

4. **`AccountSelector`** из `@/entities/account` — тот же, что в других панелях (для симметрии). Уходим от `SelectChips`, который был в drawer. Label: `given` → «С какого счёта», `taken` → «На какой счёт». `handleAccountChange` синхронизирует `debtForm.currency` с первой валютой выбранного счёта, если текущая несовместима (логика из drawer).

5. **Ряд дат (`grid grid-cols-2 gap-2`):**
   - «Дата долга» (`debt_date`, обязательна, дефолт `getTodayISO()`) — `DatePickerField`.
   - «Срок возврата» (`due_date`, `clearable`, placeholder «Без срока») — `DatePickerField`.

6. **`UInput` «Комментарий (необязательно)»** — обычный, без hashtag-suggestions.

7. **`ToggleRow` × 2:**
   - «Скрыть сумму» → `is_private`.
   - «Не списывать с баланса» / «Не добавлять на баланс» (label зависит от `debt_type`) → `skip_transaction`.

8. **Info-box** (условный, `v-if="!skip_transaction && account_id"`) — то же инфо-сообщение про списание/зачисление, что в drawer.

9. **Submit-кнопка `UButton` «Создать долг»** — отдельная, т.к. внешняя bottom-секция скрыта. `:loading="isSubmitting"`, `:disabled="!isValid"`, `full-width`, `size="lg"`. Ошибка `error` выводится над кнопкой.

**Новые файлы:** только `DebtPanel.vue` + `DebtDirectionPill.vue`. Всё остальное — переиспользование существующего.

### 3. Routing и удаление drawer

**`DebtsListPage.vue` (`pages/debts/list/`):**

- Удаляется импорт `CreateDebtDrawer` (строка 8).
- Удаляется реактивная переменная `showCreateDrawer` (строка 87).
- Удаляется рендер `<CreateDebtDrawer v-model:open="showCreateDrawer" :accounts="accounts" />` (строка 482).
- Кнопка, ранее открывавшая drawer, меняется на `router.push({ name: ROUTE_NAMES.NEW_TRANSACTION, query: { type: 'debt' } })`. Имя роута проверяется в `src/app/router/index.ts` / `routeNames.ts`.

**`AddTransactionPage.vue`:**

- Добавляется handling `?type=debt` в существующем `onMounted`.
- `handleSubmit` получает ранний выход для debt.
- Добавляется слушатель `@debt-submitted` на `<TransactionForm>` → `navigateBack()`.

### 4. Перенос файлов и очистка

| Откуда | Куда |
|---|---|
| `features/create-debt/model/useCreateDebt.ts` | `features/add-transaction/model/useDebtForm.ts` |
| `features/create-debt/model/useCreateDebt.spec.ts` | `features/add-transaction/model/useDebtForm.spec.ts` |
| `features/create-debt/ui/DatePickerField.vue` | `features/add-transaction/ui/DatePickerField.vue` |
| `features/create-debt/ui/ToggleRow.vue` | `features/add-transaction/ui/ToggleRow.vue` |

- Hook переименовывается (`useCreateDebt` → `useDebtForm`) для консистентности с `useTransactionForm`. Внешний контракт идентичен: экспортируется `useDebtForm` + тип `DebtFormData`. Логика create-then-link-transaction (включая rollback через `transactionsApi.delete`) переносится 1-в-1. Тесты валидны с переименованным импортом.
- **Удаляется целиком:** `features/create-debt/ui/CreateDebtDrawer.vue`, `features/create-debt/index.ts`, директория `features/create-debt/`.
- **Обновляется:** `features/add-transaction/index.ts` — экспортируется `useDebtForm`, `DebtFormData`. `DebtPanel` и `DebtDirectionPill` остаются внутренними, не экспортируются.

### 5. Порядок реализации

1. Переезд `useCreateDebt` → `useDebtForm` + тесты + обновление импортов. Этап должен проходить `vue-tsc` самостоятельно после правки единственного внешнего импорта в `DebtsListPage` (временно оставить drawer до шага 7).
2. `DebtDirectionPill.vue` — изолированный UI-элемент.
3. `DebtPanel.vue` — использует `useDebtForm` + `DebtDirectionPill` + существующие компоненты (`HeroAmount`, `PersonSelector`, `AccountSelector`, `DatePickerField`, `ToggleRow`).
4. Правка `useScrollableTabs.ts` (расширение `TRANSACTION_TYPE_ORDER`) + `useTransactionForm.ts` (расширение type-union до `'debt'`).
5. Интеграция в `TransactionForm.vue`: добавление 4-го таба, рендер `DebtPanel` в swiper, условное скрытие bottom-секции при `type === 'debt'`, проброс `@debt-submitted`.
6. Правки `AddTransactionPage.vue`: handling `?type=debt`, ранний выход в `handleSubmit`, слушатель `@debt-submitted` → `navigateBack()`.
7. Удаление `CreateDebtDrawer` из `DebtsListPage` + смена обработчика кнопки на `router.push`.
8. Удаление директории `features/create-debt/`.
9. Бамп patch-версии (`frontend/src/features/changelog/model/changelogData.ts`) + запись в changelog.

### 6. Changelog (черновик)

- `feature` — «Добавлена возможность создавать долги со страницы «Новая транзакция» — новый таб «Долг» рядом с расходом и доходом».
- `improvement` — «Поле суммы в долгах теперь разделяет цифры по разрядам».

## Тесты

- Существующий `useDebtForm.spec.ts` (бывший `useCreateDebt.spec.ts`) — без изменений логики, только импорт. Покрытие create-transaction → create-debt → link-back + rollback сохраняется.
- `DebtPanel.vue` — smoke-тест не обязателен для первой итерации (панель собирается из протестированных кирпичей). Можно добавить позже, если возникнут регрессии.
- Ручное тестирование в браузере (`bun run dev`): golden path «создание долга из `AddTransactionPage` с табом `debt`», переключение направления через pill, синхронизация currency при смене счёта, rollback при ошибке создания долга, навигация назад после успеха, переход с `DebtsListPage` → `/transactions/new?type=debt`.

## Риски и открытые вопросы

- **`useScrollableTabs` ширина при 4-х табах:** горизонтальный свайпер уже поддерживает циклический порядок произвольной длины, но визуально `UTabs` на мобилке с 4-мя элементами может стать узковат. Проверяется визуально на шаге реализации; запасной план — уменьшить `px` в pill-табах или скроллящийся UTabs (уже поддерживается через `useScrollableTabs`, нужно только убедиться, что элементы помещаются).
- **Иконки стрелок направления:** зависят от наличия в `shared/ui/icon/iconMap.ts`. Если нужных маппингов (`arrow_outward` / `south_east`) нет — добавляются на шаге 2.
- **Route name `NEW_TRANSACTION`:** подтвердить точное имя в `routeNames.ts`/`router/index.ts` на шаге 7.
