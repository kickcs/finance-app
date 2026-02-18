# Design: Рефакторинг features/add-transaction

**Дата:** 2026-02-18
**Подход:** Полная декомпозиция (Подход Б)

## Проблемы

- `TransactionForm.vue` ~700 строк — scroll-snap логика, конвертация валют, 3 панели смешаны в одном файле
- Expense и Income панели — почти идентичный код (дублирование)
- `useAddTransaction.ts` делает слишком много: форм-стейт + валидация + API + cache
- Scroll-snap логика не выделена — захламляет компонент
- Hardcoded `border-indigo-500` вместо семантических токенов в Transfer-панели
- `disabled` логика кнопки Submit дублирует `isValid` computed

## Финальная структура

```
features/add-transaction/
├── index.ts
├── model/
│   ├── useTransactionForm.ts     (новый: стейт + валидация)
│   ├── useSubmitTransaction.ts   (из useAddTransaction: только API)
│   └── useScrollableTabs.ts      (новый: scroll-snap логика)
└── ui/
    ├── TransactionForm.vue       (~150 строк, тонкий оркестратор)
    ├── ExpensePanel.vue          (новый)
    ├── IncomePanel.vue           (новый)
    ├── TransferPanel.vue         (новый)
    ├── AmountInput.vue           (без изменений)
    └── AccountSelector.vue       (без изменений)
```

## Composables

### `useTransactionForm.ts` (новый)

Отвечает только за форм-стейт и валидацию.

**Возвращает:**
- `formData: Ref<TransactionFormData>`
- `isValid: ComputedRef<boolean>`
- `updateField(field, value)`
- `setType(type)`
- `setCurrency(currency)`
- `setTransferTarget(toAccountId, toCurrency)`
- `setToAmount(amount)`
- `resetForm()`

**Экспортирует:** интерфейс `TransactionFormData`

### `useSubmitTransaction.ts` (из useAddTransaction.ts)

Отвечает только за отправку данных.

**Сигнатура:** `submit(userId: string, formData: TransactionFormData): Promise<string | null>`

**Возвращает:**
- `isSubmitting: Ref<boolean>`
- `error: Ref<string | null>`
- `submit`

**Внутри:** cache invalidation + toast уведомления

### `useScrollableTabs.ts` (новый)

Отвечает за scroll-snap синхронизацию между табами и панелями.

**Принимает:**
- `type: Ref<string>` — текущий тип транзакции
- `onTypeChange: (type: string) => void` — колбэк при смене типа через свайп

**Возвращает:**
- `scrollContainer: Ref<HTMLElement | null>`
- `handleTabClick(type: string)` — клик по табу → scroll
- `handleScrollEnd()` — определение панели после scroll
- `handleScroll()` — дебаунсированный fallback

**Внутри:** `onMounted` позиционирование, `onUnmounted` cleanup, `watch` на внешний type

## Компоненты

### `TransactionForm.vue` (~150 строк)

Тонкий оркестратор. Использует `useScrollableTabs`.

**Props:** без изменений (v-model:formData, accounts, categories, userCurrency, isSubmitting, error, splitData, splitValidationError, autofocusAmount)

**Рендерит:**
- `UTabs` с handleTabClick из useScrollableTabs
- Scroll-контейнер с `ref="scrollContainer"`
- `<ExpensePanel>`, `<IncomePanel>`, `<TransferPanel>` как слайды
- Общие поля: дата, комментарий, кнопка Submit

### `ExpensePanel.vue`

**Props:** `formData`, `accounts`, `categories`, `splitData?`, `splitValidationError?`, `autofocus?`
**Emits:** `update:formData`, `addParticipant`, `removeParticipant`, `updateParticipantAmount`, `updateParticipantName`, `setSplitMethod`, `setMyShare`, `setSplitEnabled`
**Содержит:** `AmountInput` + `AccountSelector` + CategoryGrid + `SplitExpenseSection`

### `IncomePanel.vue`

**Props:** `formData`, `accounts`, `categories`
**Emits:** `update:formData`
**Содержит:** `AmountInput` + `AccountSelector` + CategoryGrid (без Split)

### `TransferPanel.vue`

**Props:** `formData`, `accounts`, `userCurrency`
**Emits:** `update:formData`
**Содержит:** source `AmountInput` + `AccountSelector` (Со счёта) + стрелка + target account buttons + target currency selector + target amount field
**Логика:** `calculateConvertedAmount`, `handleAccountChange`, `handleTargetAccountChange`, `handleToCurrencyChange`, `handleToAmountChange`, watch на пересчёт суммы
**Fix:** hardcoded `border-indigo-500` → `border-primary` (семантические токены)

## Изменения в AddTransactionPage.vue

```ts
// Было:
const { formData, isSubmitting, error, addTransaction, setType, updateField } = useAddTransaction()
// handleSubmit: addTransaction(userId.value)

// Станет:
const { formData, setType, updateField, resetForm } = useTransactionForm()
const { isSubmitting, error, submit } = useSubmitTransaction()
// handleSubmit: submit(userId.value, formData.value)
```

Логика `rollbackTransaction`, `useSplitExpense`, query-param обработка — без изменений.

## Что НЕ меняется

- `AmountInput.vue`, `AccountSelector.vue` — без изменений
- Публичный API `index.ts` — `TransactionForm` + `TransactionFormData` экспортируются
- Поведение для пользователя — идентично текущему
- `AddTransactionPage.vue` — только замена импортов/вызовов
