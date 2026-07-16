# Автоподбор категории в Telegram-импорте

**Дата:** 2026-07-16
**Статус:** утверждён (поведение зафиксировано ответами пользователя: автоподстановка; только Telegram-импорт; порог — 3 подтверждения с одной категорией)

## Проблема

Во флоу подтверждения импорта (`ImportConfirmPage`) prefill уже подставляет тип, сумму, дату, счёт (`suggested_account_id`) и описание (merchant). Категория — единственное поле, которое пользователь всегда выбирает руками, хотя прод-данные показывают, что у повторяющихся мерчантов категория почти детерминирована (например, `YandexGO Taxi UB OPL` → 55/56 раз одна и та же категория). Агрегаторы (`CLICK OPLATA>…`) при этом размазаны по 8+ категориям — по ним угадывать нельзя.

## Решение

Персональная история «мерчант → категория»: для каждой pending-операции бэкенд считает, какую категорию этот пользователь выбирал для этого же мерчанта минимум **3 раза**, и отдаёт её как `suggestedCategoryId`. Фронт автоподставляет её в форму подтверждения; пользователь может поменять. Нет 3 совпадений — подсказки нет.

Отвергнутые альтернативы:
- **Глобальный словарь правил** — требует поддержки, не персонален, ломается на обрезанных узбекских строках.
- **LLM-fallback для новых мерчантов** — цена/латентность ради первого появления, которое и так проходит ручное подтверждение. Возможное будущее расширение.

## Backend

Меняется одно место — `findPendingWithSuggestions` в
`backend/src/modules/telegram-import/infrastructure/persistence/repositories/imported-transaction.repository.ts`.

Добавляется второй запрос (один на все pending-мерчанты, без N+1):

```sql
SELECT it.merchant, t.type, t.category_id, count(*) AS cnt
FROM imported_transactions it
JOIN transactions t ON t.id = it.transaction_id
WHERE it.user_id = :userId
  AND it.status = 'confirmed'
  AND it.merchant IN (:...merchants)
  AND t.type IN ('expense', 'income')
GROUP BY it.merchant, t.type, t.category_id
HAVING count(*) >= 3
```

Правила выбора:
- По каждой паре `(merchant, type)` берётся категория с максимальным `cnt`; при равенстве — детерминированный tiebreak (алфавитный по `category_id` при равных count — стабильность важнее «свежести»).
- Тип импорта матчится с типом транзакции (`expense→expense`, `income→income`) — расходная категория не попадёт в доход.
- `t.type IN ('expense','income')` отсекает переводы (`category_id = 'transfer'`).
- `balance_change` подсказку не получает естественным образом (`merchant IS NULL`).
- Источник — живые `transactions`, не снапшот: правки категории задним числом учитываются автоматически.

Проброс по существующему конвейеру:
- `InboxItem` (в `domain/repositories/imported-transaction.repository.interface.ts`) получает `suggestedCategoryId: string | null`.
- `toResponse` в `application/queries/get-inbox/get-inbox.handler.ts` добавляет поле в ответ.

Новых таблиц, миграций, эндпоинтов и команд — ноль.

## Frontend

- `entities/imported-transaction/model/types.ts` — поле `suggested_category_id: string | null`.
- `entities/imported-transaction/api/importedTransactionsApi.ts` — маппинг `suggestedCategoryId → suggested_category_id` в `transformImported()`.
- `pages/import-inbox/confirm/ImportConfirmPage.vue`, блок prefill — после `accountId`:
  подставить `categoryId`, только если предложенная категория существует в списке категорий пользователя для выбранного типа (защита от удалённой категории / невалидного id). Ключевание на `prefilledId` уже защищает правки пользователя от фоновых рефетчей.

## Edge-cases

| Случай | Поведение |
|---|---|
| Категория удалена пользователем | id не пройдёт проверку существования на фронте → prefill не применяется |
| Мерчант-агрегатор с разнобоем категорий | порог «3 с одной категорией» не достигнут → подсказки нет |
| Новый пользователь / первое появление мерчанта | `suggestedCategoryId = null`, поведение как сейчас |
| Переводы / `balance_change` | исключены (тип/`merchant IS NULL`) |

## Тесты

- **Backend** (`imported-transaction.repository` / query): порог 3 (2 совпадения → null, 3 → подсказка), выбор самой частой категории, матч по типу, исключение `transfer`, несколько pending с разными мерчантами за один запрос.
- **Frontend**: `transformImported` пробрасывает поле; prefill подставляет категорию при наличии и валидности, не подставляет при `null`/удалённой категории.

## Реализация

В изолированном git worktree (в основном репо параллельно работает другой агент), отдельная ветка `feat/telegram-import-auto-category`. Без коммитов в master без явной просьбы.
