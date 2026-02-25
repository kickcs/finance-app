# Backend Performance Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate hourly CPU spikes, reduce auth latency by ~100ms, and consolidate monthly stats from 12 queries to 2.

**Architecture:** Batch SQL deletes for demo cleanup, SHA-256 for refresh tokens (keep bcrypt for passwords), conditional aggregation for stats queries, new covering index, Docker resource limits.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, bcrypt, crypto (Node.js built-in)

---

### Task 1: Optimize Demo Cleanup Cron — Batch Deletes

**Files:**
- Modify: `backend/src/modules/identity/application/services/demo-cleanup.service.ts`

**Step 1: Rewrite `cleanupExpiredDemoAccounts` to batch-delete with LIMIT**

Replace the entire `cleanupExpiredDemoAccounts` and `deleteUserData` methods. The new approach:
1. Find up to 50 expired demo profiles
2. Collect their IDs
3. Delete all related records in batch using `IN (...)` queries
4. Wrap in a single EntityManager transaction

```typescript
@Cron(CronExpression.EVERY_HOUR)
async cleanupExpiredDemoAccounts(): Promise<void> {
  this.logger.log('Starting cleanup of expired demo accounts...');

  try {
    const now = new Date();

    // Find up to 50 expired demo profiles to avoid unbounded work
    const expiredProfiles = await this.profileRepository.find({
      where: {
        isDemo: true,
        demoExpiresAt: LessThan(now),
      },
      take: 50,
      select: ['id'],
    });

    if (expiredProfiles.length === 0) {
      this.logger.log('No expired demo accounts found');
      return;
    }

    const userIds = expiredProfiles.map((p) => p.id);
    this.logger.log(`Found ${userIds.length} expired demo accounts to clean up`);

    // Batch delete all related data in transaction
    await this.profileRepository.manager.transaction(async (manager) => {
      // Delete in order to respect foreign key constraints
      await manager.delete(TransactionOrmEntity, { userId: In(userIds) });
      await manager.delete(AccountOrmEntity, { userId: In(userIds) });
      await manager.delete(DebtOrmEntity, { userId: In(userIds) });
      await manager.delete(ReminderOrmEntity, { userId: In(userIds) });
      await manager.delete(ProfileOrmEntity, { id: In(userIds) });
    });

    this.logger.log(`Successfully cleaned up ${userIds.length} expired demo accounts`);
  } catch (error) {
    this.logger.error('Failed to cleanup expired demo accounts', error);
  }
}
```

Also update the import to add `In`:
```typescript
import { Repository, LessThan, In } from 'typeorm';
```

Remove the `deleteUserData` private method — no longer needed.

Update `manualCleanup` to also use the new approach (it delegates to `cleanupExpiredDemoAccounts` already, so no changes needed there).

**Step 2: Build and verify**

Run: `cd backend && bun run build`
Expected: Compiles without errors.

**Step 3: Run existing tests**

Run: `cd backend && bun run test`
Expected: All tests pass (demo cleanup may not have dedicated tests, but ensure no regressions).

**Step 4: Commit**

```bash
git add backend/src/modules/identity/application/services/demo-cleanup.service.ts
git commit -m "perf: batch-delete expired demo accounts instead of one-by-one loop

Eliminates hourly CPU spikes caused by cascading single-record deletes.
Now processes up to 50 profiles per run in a single DB transaction."
```

---

### Task 2: Replace bcrypt with SHA-256 for Refresh Tokens

**Files:**
- Modify: `backend/src/modules/identity/application/commands/login/login.handler.ts`
- Modify: `backend/src/modules/identity/application/commands/register/register.handler.ts`
- Modify: `backend/src/modules/identity/application/commands/login-anonymous/login-anonymous.handler.ts`
- Modify: `backend/src/modules/identity/application/commands/refresh/refresh.handler.ts`

**Context:** Refresh tokens are already 64-byte cryptographically random strings. bcrypt is designed for low-entropy passwords — it's redundant and expensive (~100ms) for high-entropy tokens. SHA-256 is the industry standard for hashing tokens (GitHub, Google, AWS all use this pattern). Migration is graceful: old bcrypt hashes will fail `===` comparison → user re-authenticates → new SHA-256 hash stored.

**Step 1: Create a shared hash helper**

Create NO new file — add a utility function inline or use crypto directly. The pattern is simple enough to inline:

```typescript
import { createHash } from 'crypto';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
```

**Step 2: Update `login.handler.ts` (lines 41-42)**

Replace:
```typescript
const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
```
With:
```typescript
const hashedRefreshToken = createHash('sha256').update(tokens.refreshToken).digest('hex');
```

Remove `import * as bcrypt from 'bcrypt';` — bcrypt is still needed for password comparison on line 26. Keep it.

Actually, bcrypt IS still needed for `bcrypt.compare` on line 26 (password check). So keep the bcrypt import. Only change the refresh token hashing.

**Step 3: Update `register.handler.ts` (line 56)**

Replace:
```typescript
const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
```
With:
```typescript
const hashedRefreshToken = createHash('sha256').update(tokens.refreshToken).digest('hex');
```

Add import: `import { createHash } from 'crypto';`

bcrypt import stays — needed for password hash on line 37.

**Step 4: Update `login-anonymous.handler.ts` (line 43)**

Replace:
```typescript
const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
```
With:
```typescript
const hashedRefreshToken = createHash('sha256').update(tokens.refreshToken).digest('hex');
```

Add import: `import { createHash } from 'crypto';`

Remove `import * as bcrypt from 'bcrypt';` — bcrypt is NOT used for anything else in this file.

**Step 5: Update `refresh.handler.ts` (lines 39 and 53)**

Line 39 — replace compare:
```typescript
const isValid = await bcrypt.compare(command.refreshToken, profile.refreshToken);
```
With:
```typescript
const hashedInput = createHash('sha256').update(command.refreshToken).digest('hex');
const isValid = hashedInput === profile.refreshToken;
```

Line 53 — replace hash:
```typescript
const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
```
With:
```typescript
const hashedRefreshToken = createHash('sha256').update(tokens.refreshToken).digest('hex');
```

Add import: `import { createHash } from 'crypto';`

Remove `import * as bcrypt from 'bcrypt';` — bcrypt is NOT used for anything else in this file.

**Step 6: Build and verify**

Run: `cd backend && bun run build`
Expected: Compiles without errors.

**Step 7: Run tests**

Run: `cd backend && bun run test`
Expected: All tests pass.

**Step 8: Commit**

```bash
git add backend/src/modules/identity/application/commands/
git commit -m "perf: use SHA-256 instead of bcrypt for refresh token hashing

Refresh tokens are already cryptographically random — bcrypt is
redundant. SHA-256 runs in microseconds vs ~100ms for bcrypt(10).
Graceful migration: old tokens fail comparison, user re-authenticates."
```

---

### Task 3: Consolidate Monthly Stats — 12 Queries → 2

**Files:**
- Modify: `backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts` (lines 339-540)

**Step 1: Rewrite `getMonthlyStats` method**

Replace the entire method (lines 339-540) with 2 queries using conditional aggregation:

```typescript
async getMonthlyStats(userId: string, year: number, month: number): Promise<MonthlyStats> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const DEBT_CATEGORIES = ['debt_given', 'debt_taken', 'debt_return_to_me', 'debt_return_from_me'];

  // Query 1: All aggregations in one query using conditional SUM
  const result = await this.ormRepository
    .createQueryBuilder('t')
    .where('t.user_id = :userId', { userId })
    .andWhere('t.date >= :startDate', { startDate })
    .andWhere('t.date < :endDate', { endDate })
    .select([
      // Regular income
      `SUM(CASE WHEN t.type = 'income' AND (t.is_debt_related = false OR t.is_debt_related IS NULL) AND t.category_id NOT IN ('debt_given','debt_taken','debt_return_to_me','debt_return_from_me') THEN t.amount ELSE 0 END)`,
      '"regularIncome"',
    ].join(' AS '))
    .addSelect([
      // Regular expense
      `SUM(CASE WHEN t.type = 'expense' AND (t.is_debt_related = false OR t.is_debt_related IS NULL) AND t.category_id NOT IN ('debt_given','debt_taken','debt_return_to_me','debt_return_from_me') THEN t.amount ELSE 0 END)`,
      '"regularExpense"',
    ].join(' AS '))
    .addSelect(`SUM(CASE WHEN t.category_id = 'debt_given' THEN t.amount ELSE 0 END)`, '"debtGiven"')
    .addSelect(`SUM(CASE WHEN t.category_id = 'debt_taken' THEN t.amount ELSE 0 END)`, '"debtTaken"')
    .addSelect(`SUM(CASE WHEN t.category_id = 'debt_return_to_me' AND t.is_debt_related = true THEN t.amount ELSE 0 END)`, '"debtReturnsToMe"')
    .addSelect(`SUM(CASE WHEN t.category_id = 'debt_return_from_me' AND t.is_debt_related = true THEN t.amount ELSE 0 END)`, '"debtReturnsFromMe"')
    .getRawOne<{
      regularIncome: string | null;
      regularExpense: string | null;
      debtGiven: string | null;
      debtTaken: string | null;
      debtReturnsToMe: string | null;
      debtReturnsFromMe: string | null;
    }>();

  const regularIncome = Number(result?.regularIncome ?? 0);
  const regularExpense = Number(result?.regularExpense ?? 0);
  const debtGiven = Number(result?.debtGiven ?? 0);
  const debtTaken = Number(result?.debtTaken ?? 0);
  const debtReturnsToMe = Number(result?.debtReturnsToMe ?? 0);
  const debtReturnsFromMe = Number(result?.debtReturnsFromMe ?? 0);

  const netIncome = Math.max(0, regularIncome + debtTaken - debtReturnsFromMe);
  const netExpense = Math.max(0, regularExpense + debtGiven - debtReturnsToMe);

  // Query 2: By-currency breakdown with same conditional logic
  const byCurrencyResult = await this.ormRepository
    .createQueryBuilder('t')
    .where('t.user_id = :userId', { userId })
    .andWhere('t.date >= :startDate', { startDate })
    .andWhere('t.date < :endDate', { endDate })
    .select('t.currency', 'currency')
    .addSelect(`SUM(CASE WHEN t.type = 'income' AND (t.is_debt_related = false OR t.is_debt_related IS NULL) AND t.category_id NOT IN ('debt_given','debt_taken','debt_return_to_me','debt_return_from_me') THEN t.amount ELSE 0 END)`, '"regularIncome"')
    .addSelect(`SUM(CASE WHEN t.type = 'expense' AND (t.is_debt_related = false OR t.is_debt_related IS NULL) AND t.category_id NOT IN ('debt_given','debt_taken','debt_return_to_me','debt_return_from_me') THEN t.amount ELSE 0 END)`, '"regularExpense"')
    .addSelect(`SUM(CASE WHEN t.category_id = 'debt_given' THEN t.amount ELSE 0 END)`, '"debtGiven"')
    .addSelect(`SUM(CASE WHEN t.category_id = 'debt_taken' THEN t.amount ELSE 0 END)`, '"debtTaken"')
    .addSelect(`SUM(CASE WHEN t.category_id = 'debt_return_to_me' AND t.is_debt_related = true THEN t.amount ELSE 0 END)`, '"debtReturnsToMe"')
    .addSelect(`SUM(CASE WHEN t.category_id = 'debt_return_from_me' AND t.is_debt_related = true THEN t.amount ELSE 0 END)`, '"debtReturnsFromMe"')
    .groupBy('t.currency')
    .getRawMany<{
      currency: string;
      regularIncome: string | null;
      regularExpense: string | null;
      debtGiven: string | null;
      debtTaken: string | null;
      debtReturnsToMe: string | null;
      debtReturnsFromMe: string | null;
    }>();

  const incomeByCurrency: Record<string, number> = {};
  const expenseByCurrency: Record<string, number> = {};

  for (const row of byCurrencyResult) {
    const incomeVal = Number(row.regularIncome ?? 0);
    const expenseVal = Number(row.regularExpense ?? 0);
    const givenVal = Number(row.debtGiven ?? 0);
    const takenVal = Number(row.debtTaken ?? 0);
    const returnsToMe = Number(row.debtReturnsToMe ?? 0);
    const returnsFromMe = Number(row.debtReturnsFromMe ?? 0);

    const netIncomeForCurrency = Math.max(0, incomeVal + takenVal - returnsFromMe);
    const netExpenseForCurrency = Math.max(0, expenseVal + givenVal - returnsToMe);

    if (netIncomeForCurrency > 0) {
      incomeByCurrency[row.currency] = netIncomeForCurrency;
    }
    if (netExpenseForCurrency > 0) {
      expenseByCurrency[row.currency] = netExpenseForCurrency;
    }
  }

  return {
    totalIncome: netIncome,
    totalExpense: netExpense,
    incomeByCurrency,
    expenseByCurrency,
  };
}
```

**Step 2: Build and verify**

Run: `cd backend && bun run build`
Expected: Compiles without errors.

**Step 3: Run tests**

Run: `cd backend && bun run test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts
git commit -m "perf: consolidate monthly stats from 12 DB queries to 2

Uses conditional aggregation (CASE WHEN) to compute all income/expense
totals and debt adjustments in a single query pass per concern."
```

---

### Task 4: Add Covering Index for Monthly Stats

**Files:**
- Create: `backend/src/database/migrations/1771781708000-AddMonthlyStatsIndex.ts`

**Step 1: Create the migration file**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMonthlyStatsIndex1771781708000 implements MigrationInterface {
  name = 'AddMonthlyStatsIndex1771781708000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Covering index for monthly stats conditional aggregation queries
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_monthly_stats
      ON transactions (user_id, date, type, is_debt_related, category_id, currency, amount)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_transactions_monthly_stats`);
  }
}
```

**Step 2: Build and verify**

Run: `cd backend && bun run build`
Expected: Compiles without errors.

**Step 3: Commit**

```bash
git add backend/src/database/migrations/1771781708000-AddMonthlyStatsIndex.ts
git commit -m "perf: add covering index for monthly stats queries

Index on (user_id, date, type, is_debt_related, category_id, currency, amount)
enables index-only scans for the consolidated stats queries."
```

---

### Task 5: Add Docker Resource Limits

**Files:**
- Modify: `docker-compose.prod.yml`

**Step 1: Add deploy.resources.limits to backend and postgres services**

For `backend` service (after line 82, before `networks`):
```yaml
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
```

For `postgres` service (after line 36, before `networks`):
```yaml
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
```

**Step 2: Commit**

```bash
git add docker-compose.prod.yml
git commit -m "perf: add memory/CPU limits to production Docker containers

Backend: 512MB RAM, 1 CPU. PostgreSQL: 1GB RAM, 1 CPU.
Prevents unbounded resource consumption and OOM cascades."
```

---

## Execution Order

Tasks 1-4 are independent — can be parallelized.
Task 5 is independent of all others.

**Critical path**: Task 1 (demo cleanup) has the highest impact — eliminates hourly CPU spikes that cause all other endpoints to slow down.
