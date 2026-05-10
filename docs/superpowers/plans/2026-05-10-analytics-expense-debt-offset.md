# Analytics: исправление totalExpense для split/receipt-расходов — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать `totalExpense` и `expenseByCurrency` в `getAnalyticsStats` согласованными с `categoryBreakdown` и `getDailyStats` — учитывать возвраты по долгам, исходно созданным со ссылкой на обычную expense-транзакцию (split-expense, scan-receipt).

**Architecture:** Один новый параллельный SQL-запрос (`regularExpenseOffsetsQuery`) внутри `TransactionRepository.getAnalyticsStats`, симметричный существующему `categoryOffsetsQuery`, плюс блок применения офсетов с cap `Math.max(0, …)`. Регрессионная защита — integration-test против реальной dev-БД (новый файл, использует существующий `jest-e2e.json`).

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Jest. Postgres локально через `docker compose up -d postgres`.

**Spec:** `docs/superpowers/specs/2026-05-10-analytics-expense-debt-offset-design.md`

---

## Файлы

- **Modify:** `backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts` — расширение метода `getAnalyticsStats` (строки 514–792).
- **Create:** `backend/test/analytics-stats.e2e-spec.ts` — integration-test, использующий уже сконфигурированный `jest-e2e.json`.
- **Create:** `backend/test/helpers/analytics-test-db.ts` — хелперы для подъёма AppModule + сидинга/чистки тестовых данных.

---

## Task 1: Подготовить test-helpers и каркас integration-теста

**Files:**
- Create: `backend/test/helpers/analytics-test-db.ts`
- Create: `backend/test/analytics-stats.e2e-spec.ts`

**Зачем:** До бизнес-фикса нужна failing regression — тест, который воспроизводит баг на реальной БД. Хелперы вынесены, чтобы основной spec был читаемым и сидинг не дублировался между сценариями.

- [ ] **Step 1: Создать helper-файл с базовой инфраструктурой**

Содержимое `backend/test/helpers/analytics-test-db.ts` целиком:

```typescript
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { TransactionOrmEntity } from '../../src/modules/accounting/infrastructure/persistence/typeorm/transaction.orm-entity';
import { AccountOrmEntity } from '../../src/modules/accounting/infrastructure/persistence/typeorm/account.orm-entity';
import { DebtOrmEntity } from '../../src/modules/debt/infrastructure/persistence/typeorm/debt.orm-entity';
import { ProfileOrmEntity } from '../../src/modules/identity/infrastructure/persistence/typeorm';
import { TRANSACTION_REPOSITORY } from '../../src/modules/accounting/domain/repositories/transaction.repository.interface';
import type { ITransactionRepository } from '../../src/modules/accounting/domain/repositories/transaction.repository.interface';
import { DEBT_CATEGORY_IDS } from '../../src/modules/accounting/domain/constants/default-categories';
import { randomUUID } from 'crypto';

export interface AnalyticsTestContext {
  app: INestApplication;
  dataSource: DataSource;
  repository: ITransactionRepository;
  userId: string;
  accountId: string;
  // Convenience IDs
  closeAndCleanup: () => Promise<void>;
}

export async function setupAnalyticsTestContext(): Promise<AnalyticsTestContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  const dataSource = app.get(DataSource);
  const repository = app.get<ITransactionRepository>(TRANSACTION_REPOSITORY);

  const userId = randomUUID();
  const accountId = randomUUID();

  // Seed minimal profile + account so foreign keys are satisfied
  await dataSource.getRepository(ProfileOrmEntity).insert({
    id: userId,
    email: `analytics-test-${userId}@test.local`,
    fullName: 'Analytics Test User',
  } as Partial<ProfileOrmEntity>);

  await dataSource.getRepository(AccountOrmEntity).insert({
    id: accountId,
    userId,
    name: 'Test Account',
    balance: 0,
    currency: 'UZS',
    icon: 'wallet',
    color: '#000000',
    type: 'basic',
    order: 0,
  } as Partial<AccountOrmEntity>);

  const closeAndCleanup = async () => {
    // Delete in FK order: transactions → debts → accounts → profile
    await dataSource.getRepository(TransactionOrmEntity).delete({ userId });
    await dataSource.getRepository(DebtOrmEntity).delete({ userId });
    await dataSource.getRepository(AccountOrmEntity).delete({ userId });
    await dataSource.getRepository(ProfileOrmEntity).delete({ id: userId });
    await app.close();
  };

  return { app, dataSource, repository, userId, accountId, closeAndCleanup };
}

export interface SeedExpenseInput {
  ctx: AnalyticsTestContext;
  amount: number;
  categoryId: string;
  date: Date;
  currency?: string;
  isDebtRelated?: boolean;
  debtId?: string | null;
  accountId?: string;
}

export async function seedExpense(input: SeedExpenseInput): Promise<string> {
  const { ctx, amount, categoryId, date, currency = 'UZS', isDebtRelated = false, debtId = null } = input;
  const id = randomUUID();
  await ctx.dataSource.getRepository(TransactionOrmEntity).insert({
    id,
    userId: ctx.userId,
    accountId: input.accountId ?? ctx.accountId,
    categoryId,
    amount,
    currency,
    type: 'expense',
    description: null,
    date,
    isDebtRelated,
    debtId,
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
  } as Partial<TransactionOrmEntity>);
  return id;
}

export interface SeedDebtInput {
  ctx: AnalyticsTestContext;
  totalAmount: number;
  remainingAmount: number;
  debtType: 'given' | 'taken';
  sourceTransactionId?: string | null;
  closeTransactionId?: string | null;
  isClosed?: boolean;
  currency?: string;
  accountId?: string;
  personName?: string;
}

export async function seedDebt(input: SeedDebtInput): Promise<string> {
  const id = randomUUID();
  await input.ctx.dataSource.getRepository(DebtOrmEntity).insert({
    id,
    userId: input.ctx.userId,
    name: 'Test debt',
    totalAmount: input.totalAmount,
    remainingAmount: input.remainingAmount,
    debtType: input.debtType,
    personName: input.personName ?? 'Friend',
    accountId: input.accountId ?? input.ctx.accountId,
    transactionId: null,
    closeTransactionId: input.closeTransactionId ?? null,
    sourceTransactionId: input.sourceTransactionId ?? null,
    isClosed: input.isClosed ?? false,
    currency: input.currency ?? 'UZS',
    description: null,
    forgivenAmount: 0,
    isPrivate: false,
  } as Partial<DebtOrmEntity>);
  return id;
}

export interface SeedDebtReturnInput {
  ctx: AnalyticsTestContext;
  amount: number;
  date: Date;
  debtId: string;
  direction: 'to_me' | 'from_me';
  currency?: string;
  accountId?: string;
}

export async function seedDebtReturn(input: SeedDebtReturnInput): Promise<string> {
  const categoryId =
    input.direction === 'to_me'
      ? DEBT_CATEGORY_IDS.RETURN_TO_ME
      : DEBT_CATEGORY_IDS.RETURN_FROM_ME;
  return seedExpense({
    ctx: input.ctx,
    amount: input.amount,
    categoryId,
    date: input.date,
    currency: input.currency,
    isDebtRelated: true,
    debtId: input.debtId,
    accountId: input.accountId,
  });
}
```

- [ ] **Step 2: Создать e2e spec-файл с одним failing-тестом — split-expense scenario**

Содержимое `backend/test/analytics-stats.e2e-spec.ts` целиком:

```typescript
import {
  setupAnalyticsTestContext,
  seedExpense,
  seedDebt,
  seedDebtReturn,
  type AnalyticsTestContext,
} from './helpers/analytics-test-db';

const RANGE_START = new Date('2026-04-01T00:00:00Z');
const RANGE_END = new Date('2026-04-30T23:59:59Z');
const IN_RANGE = new Date('2026-04-15T12:00:00Z');

describe('TransactionRepository.getAnalyticsStats — debt-offset for regular expenses', () => {
  let ctx: AnalyticsTestContext;

  beforeEach(async () => {
    ctx = await setupAnalyticsTestContext();
  });

  afterEach(async () => {
    await ctx.closeAndCleanup();
  });

  it('subtracts debt returns from totalExpense when source is a regular expense (split scenario)', async () => {
    // Setup: 100k expense (Food), 2 given-debts × 35k linked via source_transaction_id,
    // 2 returns × 35k.
    const sourceTxId = await seedExpense({
      ctx,
      amount: 100000,
      categoryId: 'food',
      date: IN_RANGE,
    });

    const debt1 = await seedDebt({
      ctx,
      totalAmount: 35000,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: sourceTxId,
      isClosed: true,
    });
    const debt2 = await seedDebt({
      ctx,
      totalAmount: 35000,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: sourceTxId,
      isClosed: true,
    });

    await seedDebtReturn({ ctx, amount: 35000, date: IN_RANGE, debtId: debt1, direction: 'to_me' });
    await seedDebtReturn({ ctx, amount: 35000, date: IN_RANGE, debtId: debt2, direction: 'to_me' });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    expect(stats.totalExpense).toBe(30000);
    expect(stats.expenseByCurrency.UZS).toBe(30000);
    const food = stats.categoryBreakdown.find((c) => c.categoryId === 'food');
    expect(food?.amount).toBe(30000);
  });
});
```

- [ ] **Step 3: Запустить failing-тест и убедиться что он падает**

Подготовка:
```bash
cd backend
docker compose up -d postgres
bun run migration:run
```

Запуск:
```bash
bun run test:e2e -- --testPathPattern=analytics-stats
```

Expected: тест **FAIL** на ассерте `expect(stats.totalExpense).toBe(30000)`. Получено будет `100000` (баг). `categoryBreakdown[Еда].amount` будет уже `30000` (это работает).

- [ ] **Step 4: Commit**

```bash
git add backend/test/helpers/analytics-test-db.ts backend/test/analytics-stats.e2e-spec.ts
git commit -m "test(analytics): add failing regression for split-expense totalExpense"
```

---

## Task 2: Имплементация — добавить `regularExpenseOffsetsQuery`

**Files:**
- Modify: `backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts:514-792`

**Зачем:** Минимальная правка, делающая failing-тест зелёным. Симметрично существующему `categoryOffsetsQuery` (строки 671–700), но группировка по `currency` и фильтр `source_tx.type='expense' AND source_tx.category_id NOT IN (debt_ids)` — чтобы избежать двойного учёта с уже работающей формулой `max(0, debtGiven - debtReturnsToMe)`.

- [ ] **Step 1: Добавить новый запрос перед существующим `Promise.all`**

Найти в файле блок (строки ~671–700), начинающийся с комментария:

```typescript
    // Get category offsets from debt returns (debt_return_to_me → debt → source transaction → category)
    // When someone returns money to me, subtract from the original expense category
    let categoryOffsetsQuery = this.ormRepository
```

…и заканчивающийся блоком `if (accountIds && accountIds.length > 0) { categoryOffsetsQuery = categoryOffsetsQuery.andWhere(...) }`.

Сразу **после** этого блока (перед строкой `// Both queries are read-only and independent — run them in parallel`) добавить:

```typescript
    // Get total offsets from debt returns whose source is a REGULAR expense (not a debt category).
    // Mirrors categoryOffsetsQuery but groups only by currency and excludes debt_given/taken sources
    // to avoid double-counting with the `max(0, debtGiven - debtReturnsToMe)` formula.
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

- [ ] **Step 2: Расширить `Promise.all` до трёх запросов**

Найти блок:

```typescript
    // Both queries are read-only and independent — run them in parallel
    const [categoryBreakdownResult, categoryOffsetsResult] = await Promise.all([
      categoryBreakdownQuery.getRawMany<{
        categoryId: string;
        categoryName: string | null;
        categoryIcon: string | null;
        categoryColor: string | null;
        type: 'income' | 'expense';
        currency: string;
        amount: string;
      }>(),
      categoryOffsetsQuery.getRawMany<{
        categoryId: string;
        currency: string;
        offsetAmount: string;
      }>(),
    ]);
```

Заменить целиком на:

```typescript
    // All three queries are read-only and independent — run them in parallel
    const [categoryBreakdownResult, categoryOffsetsResult, regularExpenseOffsetsResult] =
      await Promise.all([
        categoryBreakdownQuery.getRawMany<{
          categoryId: string;
          categoryName: string | null;
          categoryIcon: string | null;
          categoryColor: string | null;
          type: 'income' | 'expense';
          currency: string;
          amount: string;
        }>(),
        categoryOffsetsQuery.getRawMany<{
          categoryId: string;
          currency: string;
          offsetAmount: string;
        }>(),
        regularExpenseOffsetsQuery.getRawMany<{
          currency: string;
          offsetAmount: string;
        }>(),
      ]);
```

- [ ] **Step 3: Агрегировать офсеты в total + per-currency**

Найти строку (около 614 в исходном файле):

```typescript
    // Debt returns only offset their corresponding debt amounts, not regular transactions
    const netIncome = regularIncome + Math.max(0, debtTaken - debtReturnsFromMe);
    const netExpense = regularExpense + Math.max(0, debtGiven - debtReturnsToMe);
```

Заменить **только** строку `const netExpense = ...` (оставив `netIncome` без изменений) и **перед** ней добавить агрегацию офсетов. ВАЖНО: блок агрегации офсетов должен идти ПОСЛЕ Step 2 (после получения `regularExpenseOffsetsResult`), но в текущем коде эти строки идут **до** `Promise.all` — потому что вычисление `netExpense` находится в самом начале метода после первого aggregate-цикла. Нужно переместить вычисление `netExpense` (и `netIncome`) **ниже**, после `Promise.all`.

Конкретно:

1. **Удалить** строки:
   ```typescript
       // Debt returns only offset their corresponding debt amounts, not regular transactions
       const netIncome = regularIncome + Math.max(0, debtTaken - debtReturnsFromMe);
       const netExpense = regularExpense + Math.max(0, debtGiven - debtReturnsToMe);
   ```
   (это строки 612–614 в исходном файле, до `// Calculate NET by currency`).

2. **Также удалить** блок `for (const currency of allCurrencies)` (строки ~629–647) — мы его перепишем ниже после офсетов.

   Конкретный блок к удалению:
   ```typescript
       const incomeByCurrency: Record<string, number> = {};
       const expenseByCurrency: Record<string, number> = {};

       for (const currency of allCurrencies) {
         const incomeVal = regularIncomeByCurrency[currency] ?? 0;
         const expenseVal = regularExpenseByCurrency[currency] ?? 0;
         const givenVal = debtGivenByCurrency[currency] ?? 0;
         const takenVal = debtTakenByCurrency[currency] ?? 0;
         const returnsToMe = debtReturnsToMeByCurrency[currency] ?? 0;
         const returnsFromMe = debtReturnsFromMeByCurrency[currency] ?? 0;

         // Debt returns only offset debt amounts, never regular income/expense
         const netIncomeForCurrency = incomeVal + Math.max(0, takenVal - returnsFromMe);
         const netExpenseForCurrency = expenseVal + Math.max(0, givenVal - returnsToMe);

         if (netIncomeForCurrency > 0) {
           incomeByCurrency[currency] = netIncomeForCurrency;
         }
         if (netExpenseForCurrency > 0) {
           expenseByCurrency[currency] = netExpenseForCurrency;
         }
       }
   ```

3. **Сохранить** только построение `allCurrencies` (строки ~617–624). Оно остаётся, но мы его расширим ниже.

4. После `Promise.all` (после `regularExpenseOffsetsResult` доступен), сразу **перед** `// Process category breakdown - aggregate by categoryId and type`, вставить:

```typescript
    // Aggregate regular-expense offsets (returns whose source is a non-debt expense)
    const regularExpenseOffsetsByCurrency: Record<string, number> = {};
    let regularExpenseOffsetsTotal = 0;
    for (const row of regularExpenseOffsetsResult) {
      const amount = Number(row.offsetAmount ?? 0);
      regularExpenseOffsetsByCurrency[row.currency] = amount;
      regularExpenseOffsetsTotal += amount;
    }

    // Compute scalar totals — apply regular-expense offsets with cap to avoid negative
    const adjustedRegularExpense = Math.max(0, regularExpense - regularExpenseOffsetsTotal);
    const netIncome = regularIncome + Math.max(0, debtTaken - debtReturnsFromMe);
    const netExpense = adjustedRegularExpense + Math.max(0, debtGiven - debtReturnsToMe);

    // Compute per-currency NET — extend allCurrencies with offset keys so we don't miss any
    const allCurrencies = new Set([
      ...Object.keys(regularIncomeByCurrency),
      ...Object.keys(regularExpenseByCurrency),
      ...Object.keys(debtGivenByCurrency),
      ...Object.keys(debtTakenByCurrency),
      ...Object.keys(debtReturnsToMeByCurrency),
      ...Object.keys(debtReturnsFromMeByCurrency),
      ...Object.keys(regularExpenseOffsetsByCurrency),
    ]);

    const incomeByCurrency: Record<string, number> = {};
    const expenseByCurrency: Record<string, number> = {};

    for (const currency of allCurrencies) {
      const incomeVal = regularIncomeByCurrency[currency] ?? 0;
      const expenseVal = regularExpenseByCurrency[currency] ?? 0;
      const givenVal = debtGivenByCurrency[currency] ?? 0;
      const takenVal = debtTakenByCurrency[currency] ?? 0;
      const returnsToMe = debtReturnsToMeByCurrency[currency] ?? 0;
      const returnsFromMe = debtReturnsFromMeByCurrency[currency] ?? 0;
      const offset = regularExpenseOffsetsByCurrency[currency] ?? 0;

      // Cap regular expense offset to avoid negative
      const adjustedExpenseForCurrency = Math.max(0, expenseVal - offset);
      const netIncomeForCurrency = incomeVal + Math.max(0, takenVal - returnsFromMe);
      const netExpenseForCurrency = adjustedExpenseForCurrency + Math.max(0, givenVal - returnsToMe);

      if (netIncomeForCurrency > 0) {
        incomeByCurrency[currency] = netIncomeForCurrency;
      }
      if (netExpenseForCurrency > 0) {
        expenseByCurrency[currency] = netExpenseForCurrency;
      }
    }
```

5. Также удалить старое объявление `const allCurrencies = new Set([...])` (строки ~617–624), которое теперь дублируется новым блоком выше. Если оно уже удалено вместе с блоком в шаге 2 — пропустить.

- [ ] **Step 4: Запустить failing-тест из Task 1 — должен пройти**

```bash
cd backend
bun run test:e2e -- --testPathPattern=analytics-stats
```

Expected: PASS. Все три ассерта зелёные:
- `stats.totalExpense === 30000`
- `stats.expenseByCurrency.UZS === 30000`
- `food.amount === 30000`

- [ ] **Step 5: Запустить полный backend test suite (unit) — ничего не должно сломаться**

```bash
cd backend
bun run test
```

Expected: все существующие тесты проходят. Если какой-то падает с сообщением, что `getAnalyticsStats` возвращает другие числа — проверить, не закреплял ли тест старое поведение бага. Если да — обновить ассерт с пометкой в commit-сообщении.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts
git commit -m "fix(analytics): subtract debt returns from totalExpense when source is a regular expense"
```

---

## Task 3: Регрессионные тесты — частичный возврат

**Files:**
- Modify: `backend/test/analytics-stats.e2e-spec.ts`

**Зачем:** Покрыть промежуточный случай, когда вернули не всё.

- [ ] **Step 1: Добавить тест в существующий `describe`**

Сразу после первого `it(...)` блока добавить:

```typescript
  it('subtracts only the partially-returned amount from totalExpense', async () => {
    const sourceTxId = await seedExpense({
      ctx,
      amount: 100000,
      categoryId: 'food',
      date: IN_RANGE,
    });

    const debt = await seedDebt({
      ctx,
      totalAmount: 70000,
      remainingAmount: 40000,
      debtType: 'given',
      sourceTransactionId: sourceTxId,
    });

    await seedDebtReturn({ ctx, amount: 30000, date: IN_RANGE, debtId: debt, direction: 'to_me' });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    expect(stats.totalExpense).toBe(70000);
    expect(stats.expenseByCurrency.UZS).toBe(70000);
  });
```

- [ ] **Step 2: Запустить тест**

```bash
cd backend
bun run test:e2e -- --testPathPattern=analytics-stats
```

Expected: оба теста PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/test/analytics-stats.e2e-spec.ts
git commit -m "test(analytics): cover partial debt return for totalExpense"
```

---

## Task 4: Регрессионные тесты — cap edge case (возврат больше расхода)

**Files:**
- Modify: `backend/test/analytics-stats.e2e-spec.ts`

**Зачем:** Защита от отрицательных значений и согласованность с `categoryBreakdown`, где такая же cap-логика.

- [ ] **Step 1: Добавить тест**

```typescript
  it('caps offset at source expense amount — never returns negative totalExpense', async () => {
    const sourceTxId = await seedExpense({
      ctx,
      amount: 50000,
      categoryId: 'food',
      date: IN_RANGE,
    });

    const debt = await seedDebt({
      ctx,
      totalAmount: 50000,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: sourceTxId,
      isClosed: true,
    });

    // Return is bigger than the source expense (could happen via combining returns
    // from debts with different sources)
    await seedDebtReturn({ ctx, amount: 80000, date: IN_RANGE, debtId: debt, direction: 'to_me' });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    expect(stats.totalExpense).toBe(0);
    expect(stats.expenseByCurrency.UZS).toBeUndefined();
    const food = stats.categoryBreakdown.find((c) => c.categoryId === 'food');
    expect(food).toBeUndefined();
  });
```

- [ ] **Step 2: Запустить тест**

```bash
cd backend
bun run test:e2e -- --testPathPattern=analytics-stats
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/test/analytics-stats.e2e-spec.ts
git commit -m "test(analytics): cap regular-expense offset to non-negative"
```

---

## Task 5: Регрессионные тесты — прямой `debt_given` НЕ дабл-офсетится

**Files:**
- Modify: `backend/test/analytics-stats.e2e-spec.ts`

**Зачем:** Критический тест от двойного учёта. Прямой долг (категория `debt_given`) офсетится через формулу `max(0, debtGiven - debtReturnsToMe)`, и наш новый запрос НЕ должен их учитывать благодаря фильтру `source_tx.category_id NOT IN (debt_ids)`.

- [ ] **Step 1: Добавить тест**

```typescript
  it('does not double-offset direct debt_given transactions', async () => {
    // Direct debt: source_transaction_id points to a debt_given expense, not a regular one
    const debtGivenTxId = await seedExpense({
      ctx,
      amount: 50000,
      categoryId: 'debt_given',
      date: IN_RANGE,
    });

    const debt = await seedDebt({
      ctx,
      totalAmount: 50000,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: debtGivenTxId,
      isClosed: true,
    });

    await seedDebtReturn({ ctx, amount: 50000, date: IN_RANGE, debtId: debt, direction: 'to_me' });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    // Should be 0 (debtGiven 50k - returnsToMe 50k), not -50k (would happen on double-offset)
    expect(stats.totalExpense).toBe(0);
    expect(stats.expenseByCurrency.UZS).toBeUndefined();
  });
```

- [ ] **Step 2: Запустить тест**

```bash
cd backend
bun run test:e2e -- --testPathPattern=analytics-stats
```

Expected: PASS. Если FAIL с `totalExpense === -50000` — фильтр `source_tx.category_id NOT IN (debt_ids)` в Task 2 не сработал, перепроверить SQL.

- [ ] **Step 3: Commit**

```bash
git add backend/test/analytics-stats.e2e-spec.ts
git commit -m "test(analytics): assert direct debt_given is not double-offset"
```

---

## Task 6: Регрессионные тесты — multi-currency

**Files:**
- Modify: `backend/test/analytics-stats.e2e-spec.ts`

**Зачем:** Per-currency офсет применяется по валюте source-транзакции, и валюты не должны смешиваться.

- [ ] **Step 1: Добавить тест**

```typescript
  it('offsets per-currency without bleeding into other currencies', async () => {
    const usdSrc = await seedExpense({
      ctx,
      amount: 100,
      categoryId: 'food',
      date: IN_RANGE,
      currency: 'USD',
    });
    await seedExpense({
      ctx,
      amount: 100000,
      categoryId: 'food',
      date: IN_RANGE,
      currency: 'UZS',
    });

    const usdDebt = await seedDebt({
      ctx,
      totalAmount: 30,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: usdSrc,
      isClosed: true,
      currency: 'USD',
    });
    await seedDebtReturn({
      ctx,
      amount: 30,
      date: IN_RANGE,
      debtId: usdDebt,
      direction: 'to_me',
      currency: 'USD',
    });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    expect(stats.expenseByCurrency.USD).toBe(70);
    expect(stats.expenseByCurrency.UZS).toBe(100000);
    expect(stats.totalExpense).toBe(100070); // 70 USD + 100000 UZS — both in scalar total
  });
```

- [ ] **Step 2: Запустить тест**

```bash
cd backend
bun run test:e2e -- --testPathPattern=analytics-stats
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/test/analytics-stats.e2e-spec.ts
git commit -m "test(analytics): per-currency offset isolation"
```

---

## Task 7: Регрессионные тесты — accountIds-фильтр и возврат вне периода

**Files:**
- Modify: `backend/test/analytics-stats.e2e-spec.ts`

**Зачем:** Согласованность с `categoryOffsetsQuery` по поведению фильтров.

- [ ] **Step 1: Добавить второй account в helpers (если нужно)**

В `backend/test/helpers/analytics-test-db.ts` добавить экспорт-хелпер для создания дополнительного аккаунта. Найти конец файла и добавить:

```typescript
import type { AccountOrmEntity as _AccountOrmEntityForHelpers } from '../../src/modules/accounting/infrastructure/persistence/typeorm/account.orm-entity';

export async function seedExtraAccount(ctx: AnalyticsTestContext, currency = 'UZS'): Promise<string> {
  const id = randomUUID();
  await ctx.dataSource.getRepository(AccountOrmEntity).insert({
    id,
    userId: ctx.userId,
    name: 'Extra Account',
    balance: 0,
    currency,
    icon: 'wallet',
    color: '#000000',
    type: 'basic',
    order: 1,
  } as Partial<AccountOrmEntity>);
  return id;
}
```

(Удалить дублирующий import `_AccountOrmEntityForHelpers` если `AccountOrmEntity` уже импортирован выше — он уже импортирован в Step 1 Task 1, так что просто добавить функцию.)

- [ ] **Step 2: Добавить тест с account-фильтром**

В `backend/test/analytics-stats.e2e-spec.ts` обновить импорт:

```typescript
import {
  setupAnalyticsTestContext,
  seedExpense,
  seedDebt,
  seedDebtReturn,
  seedExtraAccount,
  type AnalyticsTestContext,
} from './helpers/analytics-test-db';
```

И добавить тесты:

```typescript
  it('respects accountIds filter on offsets', async () => {
    const accountB = await seedExtraAccount(ctx);

    const sourceTxId = await seedExpense({
      ctx,
      amount: 100000,
      categoryId: 'food',
      date: IN_RANGE,
      accountId: ctx.accountId, // account A
    });

    const debt = await seedDebt({
      ctx,
      totalAmount: 50000,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: sourceTxId,
      isClosed: true,
      accountId: accountB,
    });
    // Return recorded on account B
    await seedDebtReturn({
      ctx,
      amount: 50000,
      date: IN_RANGE,
      debtId: debt,
      direction: 'to_me',
      accountId: accountB,
    });

    // Filter by account A only — return on B should NOT offset A's expense
    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
      accountIds: [ctx.accountId],
    });

    expect(stats.totalExpense).toBe(100000);
    expect(stats.expenseByCurrency.UZS).toBe(100000);
  });

  it('ignores debt returns dated outside the analytics period', async () => {
    const sourceTxId = await seedExpense({
      ctx,
      amount: 100000,
      categoryId: 'food',
      date: IN_RANGE, // April
    });

    const debt = await seedDebt({
      ctx,
      totalAmount: 50000,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: sourceTxId,
      isClosed: true,
    });

    // Return is in May — outside the April range we'll query
    await seedDebtReturn({
      ctx,
      amount: 50000,
      date: new Date('2026-05-15T12:00:00Z'),
      debtId: debt,
      direction: 'to_me',
    });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    expect(stats.totalExpense).toBe(100000);
    expect(stats.expenseByCurrency.UZS).toBe(100000);
  });
```

- [ ] **Step 3: Запустить тесты**

```bash
cd backend
bun run test:e2e -- --testPathPattern=analytics-stats
```

Expected: все 6 тестов PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/test/helpers/analytics-test-db.ts backend/test/analytics-stats.e2e-spec.ts
git commit -m "test(analytics): account filter and out-of-period return cases"
```

---

## Task 8: Финальная валидация

**Files:** —

**Зачем:** Убедиться что весь pipe собирается, lint чистый, ручная проверка не нужна (всё закрыто тестами).

- [ ] **Step 1: Полный backend lint**

```bash
cd backend
bun run lint
```

Expected: 0 ошибок.

- [ ] **Step 2: Полный backend build**

```bash
cd backend
bun run build
```

Expected: успешная компиляция, exit 0.

- [ ] **Step 3: Все unit-тесты**

```bash
cd backend
bun run test
```

Expected: всё зелёное.

- [ ] **Step 4: Все e2e-тесты**

```bash
cd backend
bun run test:e2e
```

Expected: оба spec'а (`app.e2e-spec.ts` и `analytics-stats.e2e-spec.ts`) зелёные.

- [ ] **Step 5: Обновить changelog**

Открыть `frontend/src/features/changelog/model/changelogData.ts`. Найти текущую версию (например `1.0.16`), забампить patch до следующей (`1.0.17`).

В **начало** массива `CHANGELOG_ENTRIES` добавить запись:

```typescript
  {
    version: '1.0.17', // подставить актуальную следующую patch-версию
    date: '2026-05-10',
    items: [
      {
        type: 'fix',
        text: 'Аналитика: общая сумма расходов теперь корректно учитывает возвраты по разделённым тратам и сканированным чекам — раньше итог мог быть завышен.',
      },
    ],
  },
```

- [ ] **Step 6: Commit changelog**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "chore(changelog): bump patch — analytics total expense fix"
```

---

## Self-Review

**Spec coverage** — каждый пункт spec'а имеет таск:
- «Решение: новый запрос» → Task 2 Step 1.
- «Параллельный execute» → Task 2 Step 2.
- «Применение офсетов с cap» → Task 2 Step 3.
- «Test 1 — базовый split» → Task 1 Step 2.
- «Test 2 — частичный возврат» → Task 3.
- «Test 3 — cap edge case» → Task 4.
- «Test 4 — `debt_given` не дабл-офсет» → Task 5.
- «Test 5 — multi-currency» → Task 6.
- «Test 6 — account filter» → Task 7.
- «Test 7 — возврат вне периода» → Task 7.
- «Out of scope: monthly, income, frontend» — учтено: changelog добавлен (это для пользователя, не код frontend), monthly/income не трогаем.

**Placeholder scan** — запустил поиск глазами по плану: нет «TBD/TODO», все шаги содержат либо полный код, либо точные команды; нет «similar to Task N» — Task 5 повторяет паттерн Task 1, но с собственным кодом.

**Type consistency** — `regularExpenseOffsetsByCurrency`, `regularExpenseOffsetsTotal`, `regularExpenseOffsetsResult` используются единообразно в Task 2 Step 2/3. Generic в `getRawMany<{ currency: string; offsetAmount: string }>` совпадает в `Promise.all` и в цикле агрегации. Helper-функции (`seedExpense`, `seedDebt`, `seedDebtReturn`, `seedExtraAccount`) с одинаковыми сигнатурами по всему плану.
