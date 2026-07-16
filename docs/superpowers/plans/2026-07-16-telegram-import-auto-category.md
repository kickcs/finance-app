# Автоподбор категории в Telegram-импорте — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pending-операции Telegram-импорта получают `suggestedCategoryId` из персональной истории «мерчант → категория» (порог: 3 подтверждения с одной категорией), фронт автоподставляет её в форму подтверждения.

**Architecture:** Расширение существующего конвейера `findPendingWithSuggestions → GetInbox → transformImported → prefill` по образцу `suggestedAccountId`. Логика выбора категории — чистая доменная функция (тестируется без БД), SQL-агрегация — один дополнительный запрос без N+1. Никаких новых таблиц/миграций/эндпоинтов.

**Tech Stack:** NestJS + TypeORM QueryBuilder (backend), Vue 3 + vitest + msw (frontend).

**Spec:** `docs/superpowers/specs/2026-07-16-telegram-import-auto-category-design.md`

## Global Constraints

- Порог подсказки: категория выбиралась для мерчанта **≥ 3 раза** (константа `CATEGORY_SUGGESTION_MIN_COUNT = 3`).
- Тип импорта матчится с типом транзакции; `balance_change` подсказку не получает.
- Переводы исключены: `t.type IN ('expense','income')`.
- TypeORM QueryBuilder: property-имена для сущностей (`it.userId`), raw snake_case в JOIN-условиях с raw-таблицами (существующий стиль файла).
- Backend camelCase → frontend snake_case (`suggestedCategoryId` → `suggested_category_id`).
- **Без коммитов** — пользователь коммитит сам (правило no-auto-commits). Чекбокс-шаги «Commit» заменены на верификацию.
- Работа в изолированном git worktree (в репо параллельно работает другой агент), ветка `feat/telegram-import-auto-category`.

---

### Task 1: Доменная функция выбора категории (backend)

**Files:**
- Create: `backend/src/modules/telegram-import/domain/category-suggestion.ts`
- Test: `backend/src/modules/telegram-import/domain/category-suggestion.spec.ts`

**Interfaces:**
- Produces: `CATEGORY_SUGGESTION_MIN_COUNT: number`; `MerchantCategoryRow { merchant: string; type: 'expense' | 'income'; categoryId: string; cnt: number }`; `buildCategorySuggestionMap(rows: MerchantCategoryRow[]): Map<string, string>` (ключ — `suggestionKey(merchant, type)`); `suggestionKey(merchant: string, type: string): string`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/modules/telegram-import/domain/category-suggestion.spec.ts
import {
  buildCategorySuggestionMap,
  suggestionKey,
  type MerchantCategoryRow,
} from './category-suggestion';

const row = (partial: Partial<MerchantCategoryRow>): MerchantCategoryRow => ({
  merchant: 'YandexGO Taxi UB OPL',
  type: 'expense',
  categoryId: 'cat-transport',
  cnt: 5,
  ...partial,
});

describe('buildCategorySuggestionMap', () => {
  it('возвращает категорию мерчанта по ключу (merchant, type)', () => {
    const map = buildCategorySuggestionMap([row({})]);
    expect(map.get(suggestionKey('YandexGO Taxi UB OPL', 'expense'))).toBe('cat-transport');
  });

  it('при нескольких категориях мерчанта выбирает самую частую', () => {
    const map = buildCategorySuggestionMap([
      row({ categoryId: 'cat-transport', cnt: 7 }),
      row({ categoryId: 'cat-food', cnt: 3 }),
    ]);
    expect(map.get(suggestionKey('YandexGO Taxi UB OPL', 'expense'))).toBe('cat-transport');
  });

  it('при равных count берёт детерминированный tiebreak (меньший categoryId)', () => {
    const map = buildCategorySuggestionMap([
      row({ categoryId: 'cat-b', cnt: 3 }),
      row({ categoryId: 'cat-a', cnt: 3 }),
    ]);
    expect(map.get(suggestionKey('YandexGO Taxi UB OPL', 'expense'))).toBe('cat-a');
  });

  it('разные типы одного мерчанта не смешиваются', () => {
    const map = buildCategorySuggestionMap([
      row({ type: 'expense', categoryId: 'cat-transport' }),
      row({ type: 'income', categoryId: 'cat-refund' }),
    ]);
    expect(map.get(suggestionKey('YandexGO Taxi UB OPL', 'expense'))).toBe('cat-transport');
    expect(map.get(suggestionKey('YandexGO Taxi UB OPL', 'income'))).toBe('cat-refund');
  });

  it('пустой вход → пустая map', () => {
    expect(buildCategorySuggestionMap([]).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bun run test -- --testPathPattern=category-suggestion`
Expected: FAIL — `Cannot find module './category-suggestion'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/modules/telegram-import/domain/category-suggestion.ts

/** Минимум подтверждений одной категорией, чтобы предлагать её для мерчанта. */
export const CATEGORY_SUGGESTION_MIN_COUNT = 3;

export interface MerchantCategoryRow {
  merchant: string;
  type: 'expense' | 'income';
  categoryId: string;
  cnt: number;
}

export function suggestionKey(merchant: string, type: string): string {
  return `${merchant}\u0000${type}`;
}

/**
 * Строит map «(merchant, type) → categoryId» из агрегированных строк истории.
 * Самая частая категория побеждает; при равенстве — меньший categoryId
 * (стабильность подсказки важнее свежести).
 */
export function buildCategorySuggestionMap(rows: MerchantCategoryRow[]): Map<string, string> {
  const best = new Map<string, MerchantCategoryRow>();
  for (const r of rows) {
    const key = suggestionKey(r.merchant, r.type);
    const cur = best.get(key);
    if (!cur || r.cnt > cur.cnt || (r.cnt === cur.cnt && r.categoryId < cur.categoryId)) {
      best.set(key, r);
    }
  }
  return new Map([...best].map(([key, r]) => [key, r.categoryId]));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && bun run test -- --testPathPattern=category-suggestion`
Expected: PASS (5 тестов)

---

### Task 2: Прокладка suggestedCategoryId через репозиторий и GetInbox (backend)

**Files:**
- Modify: `backend/src/modules/telegram-import/domain/repositories/imported-transaction.repository.interface.ts` (интерфейс `InboxItem`)
- Modify: `backend/src/modules/telegram-import/infrastructure/persistence/repositories/imported-transaction.repository.ts` (`findPendingWithSuggestions`)
- Modify: `backend/src/modules/telegram-import/application/queries/get-inbox/get-inbox.handler.ts` (`toResponse`)
- Modify: `docs/features/telegram-bank-import.md` (описание `InboxItem` в §3.1)

**Interfaces:**
- Consumes: `buildCategorySuggestionMap`, `suggestionKey`, `CATEGORY_SUGGESTION_MIN_COUNT`, `MerchantCategoryRow` из Task 1.
- Produces: `InboxItem.suggestedCategoryId: string | null`; JSON-ответ GET `/api/telegram-import/inbox` с полем `suggestedCategoryId`.

- [ ] **Step 1: Расширить InboxItem**

В `imported-transaction.repository.interface.ts`:

```typescript
export interface InboxItem extends ImportedTransaction {
  suggestedAccountId: string | null;
  /** Категория, которую пользователь выбирал для этого мерчанта ≥3 раз (самая частая) */
  suggestedCategoryId: string | null;
}
```

- [ ] **Step 2: Дополнить findPendingWithSuggestions вторым запросом**

В `imported-transaction.repository.ts` — импорт и новый приватный метод + использование:

```typescript
import {
  buildCategorySuggestionMap,
  CATEGORY_SUGGESTION_MIN_COUNT,
  suggestionKey,
  type MerchantCategoryRow,
} from '../../../domain/category-suggestion';
```

```typescript
  async findPendingWithSuggestions(userId: string): Promise<InboxItem[]> {
    const rows = await this.repo
      .createQueryBuilder('it')
      .leftJoin(
        'card_account_mappings',
        'cm',
        'cm.user_id = it.user_id AND cm.card_mask = it.card_mask',
      )
      .addSelect('cm.account_id', 'suggested_account_id')
      .where('it.userId = :userId', { userId })
      .andWhere('it.status = :status', { status: 'pending' })
      .andWhere("it.type != 'unparsed'")
      .orderBy('it.occurredAt', 'DESC')
      .getRawAndEntities();

    const merchants = [
      ...new Set(
        rows.entities.map((e) => e.merchant).filter((m): m is string => m !== null && m !== ''),
      ),
    ];
    const categorySuggestions = await this.findCategorySuggestions(userId, merchants);

    return rows.entities.map((orm, i) => ({
      ...toDomain(orm),
      suggestedAccountId: (rows.raw[i] as { suggested_account_id: string | null })
        .suggested_account_id,
      suggestedCategoryId:
        orm.merchant && (orm.type === 'expense' || orm.type === 'income')
          ? (categorySuggestions.get(suggestionKey(orm.merchant, orm.type)) ?? null)
          : null,
    }));
  }

  /**
   * Персональная история «мерчант → категория» по подтверждённым импортам.
   * Живые transactions (не снапшот) — правки категории задним числом учитываются.
   * Один запрос на все мерчанты инбокса; порог CATEGORY_SUGGESTION_MIN_COUNT в HAVING.
   */
  private async findCategorySuggestions(
    userId: string,
    merchants: string[],
  ): Promise<Map<string, string>> {
    if (merchants.length === 0) return new Map();
    const raw = await this.repo
      .createQueryBuilder('it')
      .select('it.merchant', 'merchant')
      .addSelect('t.type', 'type')
      .addSelect('t.category_id', 'categoryId')
      .addSelect('COUNT(*)', 'cnt')
      .innerJoin('transactions', 't', 't.id = it.transaction_id')
      .where('it.userId = :userId', { userId })
      .andWhere("it.status = 'confirmed'")
      .andWhere('it.merchant IN (:...merchants)', { merchants })
      .andWhere("t.type IN ('expense', 'income')")
      .groupBy('it.merchant')
      .addGroupBy('t.type')
      .addGroupBy('t.category_id')
      .having('COUNT(*) >= :minCount', { minCount: CATEGORY_SUGGESTION_MIN_COUNT })
      .getRawMany<{ merchant: string; type: string; categoryId: string; cnt: string }>();

    return buildCategorySuggestionMap(
      raw.map(
        (r): MerchantCategoryRow => ({
          merchant: r.merchant,
          type: r.type as MerchantCategoryRow['type'],
          categoryId: r.categoryId,
          cnt: Number(r.cnt),
        }),
      ),
    );
  }
```

- [ ] **Step 3: Пробросить в ответ GetInbox**

В `get-inbox.handler.ts`, `toResponse`, после `suggestedAccountId`:

```typescript
    suggestedCategoryId: item.suggestedCategoryId,
```

- [ ] **Step 4: Обновить доку**

В `docs/features/telegram-bank-import.md` §3.1 строку про `InboxItem` дополнить полем `suggestedCategoryId` (после `suggestedAccountId`).

- [ ] **Step 5: Verify**

Run: `cd backend && bun run build && bun run test -- --testPathPattern=telegram-import`
Expected: build OK, все тесты модуля PASS (тип `InboxItem` в моках существующих спеков может потребовать добавления поля — добавить `suggestedCategoryId: null` там, где TS этого потребует).

---

### Task 3: Frontend entity — тип и transform

**Files:**
- Modify: `frontend/src/entities/imported-transaction/model/types.ts`
- Modify: `frontend/src/entities/imported-transaction/api/importedTransactionsApi.ts`
- Test: `frontend/src/entities/imported-transaction/api/useImportedTransactions.spec.ts` (расширить)

**Interfaces:**
- Consumes: JSON-поле `suggestedCategoryId` из Task 2.
- Produces: `ImportedTransaction.suggested_category_id: string | null`.

- [ ] **Step 1: Расширить existing spec (failing)**

В `useImportedTransactions.spec.ts`: в `INBOX_RESPONSE.items[0]` добавить `suggestedCategoryId: 'cat-1'`, в assertion `toMatchObject` добавить `suggested_category_id: 'cat-1'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bun run test -- useImportedTransactions`
Expected: FAIL — `suggested_category_id: undefined`

- [ ] **Step 3: Implementation**

`model/types.ts`, интерфейс `ImportedTransaction`, после `suggested_account_id`:

```typescript
  suggested_category_id: string | null;
```

`importedTransactionsApi.ts`: в `ImportedTransactionResponse` после `suggestedAccountId`:

```typescript
  suggestedCategoryId: string | null;
```

в `transformImported` после `suggested_account_id`:

```typescript
    suggested_category_id: item.suggestedCategoryId ?? null,
```

(`?? null` — защита от старого бэкенда без поля.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && bun run test -- useImportedTransactions`
Expected: PASS

---

### Task 4: Frontend prefill категории в ImportConfirmPage

**Files:**
- Create: `frontend/src/pages/import-inbox/model/categoryPrefill.ts`
- Test: `frontend/src/pages/import-inbox/model/categoryPrefill.spec.ts`
- Modify: `frontend/src/pages/import-inbox/confirm/ImportConfirmPage.vue`

**Interfaces:**
- Consumes: `suggested_category_id` из Task 3; `expenseCategories`/`incomeCategories` из `useCategories`; `formData`/`updateField` из `useTransactionForm`.
- Produces: `decideCategoryPrefill(params): 'apply' | 'skip' | 'wait'`.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/pages/import-inbox/model/categoryPrefill.spec.ts
import { describe, it, expect } from 'vitest';
import { decideCategoryPrefill } from './categoryPrefill';

const pool = [{ id: 'cat-transport' }, { id: 'cat-food' }];

describe('decideCategoryPrefill', () => {
  it('apply: подсказка есть, категория в списке, поле пустое', () => {
    expect(
      decideCategoryPrefill({ suggestedCategoryId: 'cat-transport', currentCategoryId: '', pool }),
    ).toBe('apply');
  });

  it('skip: подсказки нет', () => {
    expect(
      decideCategoryPrefill({ suggestedCategoryId: null, currentCategoryId: '', pool }),
    ).toBe('skip');
  });

  it('skip: пользователь уже выбрал категорию', () => {
    expect(
      decideCategoryPrefill({
        suggestedCategoryId: 'cat-transport',
        currentCategoryId: 'cat-food',
        pool,
      }),
    ).toBe('skip');
  });

  it('skip: категория удалена (нет в списке)', () => {
    expect(
      decideCategoryPrefill({ suggestedCategoryId: 'cat-deleted', currentCategoryId: '', pool }),
    ).toBe('skip');
  });

  it('wait: категории ещё не загружены', () => {
    expect(
      decideCategoryPrefill({
        suggestedCategoryId: 'cat-transport',
        currentCategoryId: '',
        pool: [],
      }),
    ).toBe('wait');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bun run test -- categoryPrefill`
Expected: FAIL — `Cannot find module './categoryPrefill'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// frontend/src/pages/import-inbox/model/categoryPrefill.ts

export type CategoryPrefillDecision = 'apply' | 'skip' | 'wait';

/**
 * Решение об автоподстановке предложенной категории в форму подтверждения.
 * 'wait' — категории ещё грузятся, решение отложено до следующего срабатывания watch.
 */
export function decideCategoryPrefill(params: {
  suggestedCategoryId: string | null;
  currentCategoryId: string;
  pool: Array<{ id: string }>;
}): CategoryPrefillDecision {
  const { suggestedCategoryId, currentCategoryId, pool } = params;
  if (!suggestedCategoryId) return 'skip';
  if (pool.length === 0) return 'wait';
  if (currentCategoryId !== '') return 'skip';
  if (!pool.some((c) => c.id === suggestedCategoryId)) return 'skip';
  return 'apply';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && bun run test -- categoryPrefill`
Expected: PASS (5 тестов)

- [ ] **Step 5: Wire into ImportConfirmPage**

В `ImportConfirmPage.vue`:

Импорт (рядом с `useInboxSortOrder`):

```typescript
import { decideCategoryPrefill } from '../model/categoryPrefill';
```

Сразу ПОСЛЕ существующего prefill-watch (порядок важен: сначала reset формы, потом категория):

```typescript
// Категория из истории мерчанта: отдельный watch, т.к. категории грузятся
// асинхронно и могут прийти позже item. Решение принимается один раз на item
// (categoryPrefilledId), 'wait' оставляет попытку до загрузки категорий.
let categoryPrefilledId: string | null = null;
watch(
  [item, expenseCategories, incomeCategories],
  ([current]) => {
    if (!current || current.id === categoryPrefilledId) return;
    const pool =
      formData.value.type === 'income' ? incomeCategories.value : expenseCategories.value;
    const decision = decideCategoryPrefill({
      suggestedCategoryId: current.suggested_category_id,
      currentCategoryId: formData.value.categoryId,
      pool,
    });
    if (decision === 'wait') return;
    categoryPrefilledId = current.id;
    if (decision === 'apply') {
      updateField('categoryId', current.suggested_category_id!);
    }
  },
  { immediate: true },
);
```

- [ ] **Step 6: Verify**

Run: `cd frontend && bun run test && bun run build`
Expected: все тесты PASS, type-check + build OK.

---

### Task 5: Changelog + финальная верификация

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

- [ ] **Step 1: Запись в changelog**

Bump patch-версии (посмотреть текущую верхнюю запись в `CHANGELOG_ENTRIES`, +1 к patch). Запись в начало массива, тип `improvement`, описание на русском, например:

```typescript
  {
    version: '<bumped>',
    date: '<сегодня YYYY-MM-DD>',
    type: 'improvement',
    title: 'Умная категория в Telegram-импорте',
    description:
      'При подтверждении операции из Telegram категория подставляется автоматически, если вы уже несколько раз выбирали её для этого продавца.',
  },
```

(Точную форму объекта взять из существующих записей файла.)

- [ ] **Step 2: Full verify**

Run: `cd backend && bun run lint && bun run build && bun run test -- --testPathPattern=telegram-import`
Run: `cd frontend && bun run test && bun run build`
Expected: всё зелёное.

- [ ] **Step 3: Отчёт пользователю**

Без коммита. Сообщить путь worktree, ветку, список изменённых файлов, результаты верификации; коммит/PR — по явной просьбе пользователя.
