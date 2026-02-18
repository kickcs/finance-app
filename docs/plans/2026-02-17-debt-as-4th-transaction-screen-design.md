# Долг как 4-й экран в Новой транзакции

## Решение

Перенести создание долга из отдельной страницы `/debts/new` в 4-ю свайп-панель формы создания транзакции (`/transactions/new?type=debt`).

## Табы

```
[ Расход | Доход | Перевод | Долг ]
```

Свайп (scroll-snap) работает между всеми 4 панелями. URL-параметр `?type=debt` открывает 4-ю панель.

## 4-я панель (Долг)

1. Вложенные табы «Дан в долг» / «Взял в долг» (UTabs)
2. Имя человека (UInput)
3. Сумма + валюта (AmountInput — переиспользуем)
4. Выбор счёта (AccountSelector — переиспользуем)
5. Дата (Calendar popover)
6. Описание (UInput)
7. Чекбокс «Без влияния на баланс» + пояснение

## Декомпозиция TransactionForm.vue

```
features/add-transaction/ui/
├── TransactionForm.vue      # Оркестратор: табы, свайп, общий стейт, кнопка сохранения
├── ExpensePanel.vue          # AmountInput + счёт + категории + split expense
├── IncomePanel.vue           # AmountInput + счёт + категории
├── TransferPanel.vue         # AmountInput + счёт + целевой счёт + конвертация
├── DebtPanel.vue             # тип дан/взял + имя + сумма + счёт + дата + описание
├── AmountInput.vue           # (уже есть)
└── AccountSelector.vue       # (уже есть)
```

TransactionForm.vue остаётся ответственным за:
- Табы и свайп-логику (scroll-snap)
- Общий стейт формы
- Кнопку сохранения (dispatch по типу)
- Координацию между панелями

## Кнопка сохранения

Общая кнопка внизу формы. При `type === 'debt'` вызывает `useCreateDebt`, иначе `useAddTransaction`.

## Удаляем

- Маршрут `/debts/new` и страницу `AddDebtPage.vue`
- Все навигации на `new-debt` заменяем на `new-transaction?type=debt`

## Сохраняем

- `features/create-debt/model/useCreateDebt.ts` — логику создания долга
- `features/create-debt/` — feature остаётся, UI адаптируется
