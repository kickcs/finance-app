# Financial Month Start Day — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable financial month start day (1–31) so all monthly calculations use financial periods instead of calendar months.

**Architecture:** New `financialMonthStartDay` field on Profile (default 1). Shared utility `financial-period.ts` computes period boundaries. Backend resolves startDay from profile server-side — HTTP API unchanged. Frontend mirrors utility for formatting + composable for reactive access.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Vue 3, TanStack Vue Query, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-24-financial-month-start-day-design.md`

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `backend/src/shared/utils/financial-period.ts` | Date boundary calculations (shared utility) |
| `backend/src/shared/utils/financial-period.spec.ts` | Unit tests for above |
| `backend/src/database/migrations/1773780000000-AddFinancialMonthStartDay.ts` | DB migration |
| `frontend/src/shared/lib/utils/financialPeriod.ts` | Frontend mirror of backend utility + formatting |
| `frontend/src/shared/lib/hooks/useFinancialPeriod.ts` | Reactive composable reading from profile |
| `frontend/src/features/configure-financial-period/ui/FinancialPeriodModal.vue` | Settings modal |
| `frontend/src/features/configure-financial-period/index.ts` | Feature barrel export |

### Modified files
| File | Change |
|------|--------|
| `backend/src/modules/identity/infrastructure/persistence/typeorm/profile.orm-entity.ts` | Add column |
| `backend/src/modules/identity/domain/entities/profile.entity.ts` | Add to props + getter + updateProfile |
| `backend/src/modules/identity/infrastructure/persistence/mappers/profile.mapper.ts` | Map new field |
| `backend/src/modules/identity/application/types/index.ts` | Add to ProfileResponse |
| `backend/src/modules/identity/application/commands/update-profile/update-profile.command.ts` | Add to data type |
| `backend/src/modules/identity/application/commands/update-profile/update-profile.handler.ts` | Add to toResponse |
| `backend/src/modules/identity/application/queries/get-profile/get-profile.handler.ts` | Add to toResponse |
| `backend/src/modules/identity/presentation/dto/update-profile.dto.ts` | Add validated field |
| `backend/src/modules/accounting/domain/repositories/transaction.repository.interface.ts` | Add startDay to getMonthlyStats |
| `backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts` | Use getFinancialMonthBounds |
| `backend/src/modules/accounting/application/queries/get-monthly-stats/get-monthly-stats.query.ts` | Add startDay field |
| `backend/src/modules/accounting/application/queries/get-monthly-stats/get-monthly-stats.handler.ts` | Pass startDay |
| `backend/src/modules/accounting/application/queries/get-monthly-stats/get-monthly-stats.handler.spec.ts` | Update tests |
| `backend/src/modules/accounting/presentation/controllers/transactions.controller.ts` | Inject PROFILE_REPOSITORY, read startDay |
| `backend/src/modules/planning/application/queries/get-budget-for-month/get-budget-for-month.query.ts` | Add startDay |
| `backend/src/modules/planning/application/queries/get-budget-for-month/get-budget-for-month.handler.ts` | Pass startDay |
| `backend/src/modules/planning/application/queries/get-budget-for-month/get-budget-for-month.handler.spec.ts` | Update tests |
| `backend/src/modules/planning/application/queries/get-budget-history/get-budget-history.query.ts` | Add startDay |
| `backend/src/modules/planning/application/queries/get-budget-history/get-budget-history.handler.ts` | Use financial months |
| `backend/src/modules/planning/application/queries/get-budget-history/get-budget-history.handler.spec.ts` | Update tests |
| `backend/src/modules/planning/presentation/controllers/budgets.controller.ts` | Read startDay from profile, pass to queries |
| `frontend/src/shared/api/database.types.ts` | Add financial_month_start_day to Profile types |
| `frontend/src/shared/api/services/profileApi.ts` | Add transform + update mapping |
| `frontend/src/entities/transaction/api/queryKeys.ts` | Add startDay to monthlyStats key |
| `frontend/src/features/analytics-filters/model/useAnalyticsFilters.ts` | Use financial period for month-start |
| `frontend/src/shared/lib/date/index.ts` | Add getDaysRemainingInPeriod |
| `frontend/src/pages/profile/ProfilePage.vue` | Add financial period menu item + modal |
| `frontend/src/features/changelog/model/changelogData.ts` | Add changelog entry |

---

## Phase 1 — Backend Infrastructure

### Task 1: Database migration

**Files:**
- Create: `backend/src/database/migrations/1773780000000-AddFinancialMonthStartDay.ts`

- [ ] **Step 1: Create migration file**

```typescript
// backend/src/database/migrations/1773780000000-AddFinancialMonthStartDay.ts
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddFinancialMonthStartDay1773780000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD "financial_month_start_day" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD CONSTRAINT "chk_financial_month_start_day" CHECK ("financial_month_start_day" BETWEEN 1 AND 31)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" DROP CONSTRAINT "chk_financial_month_start_day"`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" DROP COLUMN "financial_month_start_day"`,
    );
  }
}
```

- [ ] **Step 2: Run migration**

Run: `cd backend && bun run migration:run`
Expected: Migration applied successfully.

- [ ] **Step 3: Commit**

```bash
git add backend/src/database/migrations/1773780000000-AddFinancialMonthStartDay.ts
git commit -m "feat(db): add financial_month_start_day column to profiles"
```

---

### Task 2: Shared utility — financial-period.ts + tests

**Files:**
- Create: `backend/src/shared/utils/financial-period.ts`
- Create: `backend/src/shared/utils/financial-period.spec.ts`

- [ ] **Step 1: Write the tests first**

```typescript
// backend/src/shared/utils/financial-period.spec.ts
import {
  resolveStartDay,
  getFinancialMonthBounds,
  getFinancialMonth,
  getCurrentFinancialMonth,
} from './financial-period';

describe('financial-period', () => {
  describe('resolveStartDay', () => {
    it('returns startDay when month has enough days', () => {
      expect(resolveStartDay(2026, 1, 15)).toBe(15); // Jan has 31
      expect(resolveStartDay(2026, 3, 31)).toBe(31); // Mar has 31
    });

    it('falls back to last day for short months', () => {
      expect(resolveStartDay(2026, 2, 31)).toBe(28); // Feb non-leap
      expect(resolveStartDay(2026, 2, 29)).toBe(28);
      expect(resolveStartDay(2026, 4, 31)).toBe(30); // Apr has 30
    });

    it('handles leap year February', () => {
      expect(resolveStartDay(2024, 2, 31)).toBe(29);
      expect(resolveStartDay(2024, 2, 29)).toBe(29);
    });

    it('returns 1 for startDay=1 (no-op)', () => {
      expect(resolveStartDay(2026, 2, 1)).toBe(1);
    });
  });

  describe('getFinancialMonthBounds', () => {
    it('returns calendar month for startDay=1 (backwards compat)', () => {
      const { start, end } = getFinancialMonthBounds(2026, 3, 1);
      expect(start).toEqual(new Date(2026, 2, 1));  // Mar 1
      expect(end).toEqual(new Date(2026, 3, 1));    // Apr 1 (exclusive)
    });

    it('returns correct bounds for mid-month start', () => {
      const { start, end } = getFinancialMonthBounds(2026, 3, 15);
      expect(start).toEqual(new Date(2026, 2, 15)); // Mar 15
      expect(end).toEqual(new Date(2026, 3, 15));   // Apr 15 (exclusive)
    });

    it('handles year rollover (December)', () => {
      const { start, end } = getFinancialMonthBounds(2026, 12, 15);
      expect(start).toEqual(new Date(2026, 11, 15)); // Dec 15
      expect(end).toEqual(new Date(2027, 0, 15));    // Jan 15 2027
    });

    it('handles startDay=31 with short month fallback', () => {
      // January with startDay=31: Jan 31 → Feb resolved(31)=28 → Feb 28
      const { start, end } = getFinancialMonthBounds(2026, 1, 31);
      expect(start).toEqual(new Date(2026, 0, 31)); // Jan 31
      expect(end).toEqual(new Date(2026, 1, 28));   // Feb 28 (exclusive)
    });

    it('handles February with startDay=31 (leap year)', () => {
      const { start, end } = getFinancialMonthBounds(2024, 2, 31);
      expect(start).toEqual(new Date(2024, 1, 29)); // Feb 29
      expect(end).toEqual(new Date(2024, 2, 31));   // Mar 31
    });
  });

  describe('getFinancialMonth', () => {
    it('returns current month when date >= resolvedDay', () => {
      expect(getFinancialMonth(new Date(2026, 2, 20), 15)).toEqual({ year: 2026, month: 3 });
      expect(getFinancialMonth(new Date(2026, 2, 15), 15)).toEqual({ year: 2026, month: 3 });
    });

    it('returns previous month when date < resolvedDay', () => {
      expect(getFinancialMonth(new Date(2026, 2, 5), 15)).toEqual({ year: 2026, month: 2 });
      expect(getFinancialMonth(new Date(2026, 2, 14), 15)).toEqual({ year: 2026, month: 2 });
    });

    it('handles year rollover (January before startDay)', () => {
      expect(getFinancialMonth(new Date(2027, 0, 10), 15)).toEqual({ year: 2026, month: 12 });
    });

    it('handles startDay=31 with Feb resolved=28', () => {
      // Feb 28 is >= resolved(28) → Feb financial month
      expect(getFinancialMonth(new Date(2026, 1, 28), 31)).toEqual({ year: 2026, month: 2 });
      // Feb 27 is < resolved(28) → Jan financial month
      expect(getFinancialMonth(new Date(2026, 1, 27), 31)).toEqual({ year: 2026, month: 1 });
    });

    it('returns same as calendar month for startDay=1', () => {
      expect(getFinancialMonth(new Date(2026, 2, 15), 1)).toEqual({ year: 2026, month: 3 });
      expect(getFinancialMonth(new Date(2026, 0, 1), 1)).toEqual({ year: 2026, month: 1 });
    });
  });

  describe('getCurrentFinancialMonth', () => {
    it('returns a valid year/month object', () => {
      const result = getCurrentFinancialMonth(1);
      expect(result.year).toBeGreaterThan(2000);
      expect(result.month).toBeGreaterThanOrEqual(1);
      expect(result.month).toBeLessThanOrEqual(12);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && bun run test -- --testPathPattern=financial-period`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the utility**

```typescript
// backend/src/shared/utils/financial-period.ts

/**
 * Resolve startDay for a specific month.
 * If startDay > days in month (e.g. 31 in February), returns last day.
 */
export function resolveStartDay(year: number, month: number, startDay: number): number {
  // month is 1-based. Using day=0 of next month gives last day of current month.
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.min(startDay, daysInMonth);
}

/**
 * Returns financial month boundaries.
 * start is inclusive, end is EXCLUSIVE (matches existing codebase convention).
 *
 * Example: getFinancialMonthBounds(2026, 3, 15)
 *   → { start: Mar 15 00:00, end: Apr 15 00:00 }
 *
 * For startDay=1, identical to calendar month: Mar 1 → Apr 1.
 */
export function getFinancialMonthBounds(
  year: number,
  month: number, // 1-12
  startDay: number, // 1-31
): { start: Date; end: Date } {
  const resolvedDay = resolveStartDay(year, month, startDay);
  const start = new Date(year, month - 1, resolvedDay);

  // End = start of next financial month (exclusive)
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextResolvedDay = resolveStartDay(nextYear, nextMonth, startDay);
  const end = new Date(nextYear, nextMonth - 1, nextResolvedDay);

  return { start, end };
}

/**
 * Determines which financial month a date belongs to.
 *
 * Example: getFinancialMonth(new Date('2026-03-05'), 15)
 *   → { year: 2026, month: 2 } (before the 15th → previous financial month)
 */
export function getFinancialMonth(
  date: Date,
  startDay: number,
): { year: number; month: number } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  const resolvedDay = resolveStartDay(year, month, startDay);

  if (day >= resolvedDay) {
    return { year, month };
  } else {
    // Before resolvedDay → previous financial month
    if (month === 1) {
      return { year: year - 1, month: 12 };
    }
    return { year, month: month - 1 };
  }
}

/**
 * Returns the current financial month.
 */
export function getCurrentFinancialMonth(startDay: number): { year: number; month: number } {
  return getFinancialMonth(new Date(), startDay);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && bun run test -- --testPathPattern=financial-period`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/shared/utils/financial-period.ts backend/src/shared/utils/financial-period.spec.ts
git commit -m "feat: add financial-period utility with unit tests"
```

---

### Task 3: Update Profile domain + infrastructure

**Files:**
- Modify: `backend/src/modules/identity/infrastructure/persistence/typeorm/profile.orm-entity.ts`
- Modify: `backend/src/modules/identity/domain/entities/profile.entity.ts`
- Modify: `backend/src/modules/identity/infrastructure/persistence/mappers/profile.mapper.ts`
- Modify: `backend/src/modules/identity/application/types/index.ts`
- Modify: `backend/src/modules/identity/application/commands/update-profile/update-profile.command.ts`
- Modify: `backend/src/modules/identity/application/commands/update-profile/update-profile.handler.ts`
- Modify: `backend/src/modules/identity/application/queries/get-profile/get-profile.handler.ts`
- Modify: `backend/src/modules/identity/presentation/dto/update-profile.dto.ts`

- [ ] **Step 1: Add column to ORM entity**

In `profile.orm-entity.ts`, add after `quickActionsHintDismissed`:

```typescript
  @Column({ name: 'financial_month_start_day', type: 'integer', default: 1 })
  financialMonthStartDay: number;
```

- [ ] **Step 2: Add to ProfileProps interface and domain entity**

In `profile.entity.ts`:

Add to `ProfileProps` interface (after `quickActionsHintDismissed`):
```typescript
  financialMonthStartDay: number;
```

Add private field (after `_quickActionsHintDismissed`):
```typescript
  private _financialMonthStartDay: number;
```

Add to constructor (after `this._quickActionsHintDismissed = ...`):
```typescript
    this._financialMonthStartDay = props.financialMonthStartDay;
```

Add to `createRegistered` props (after `quickActionsHintDismissed: false`):
```typescript
      financialMonthStartDay: 1,
```

Add to `createDemo` props (after `quickActionsHintDismissed: false`):
```typescript
      financialMonthStartDay: 1,
```

Add getter (after `quickActionsHintDismissed` getter):
```typescript
  get financialMonthStartDay(): number {
    return this._financialMonthStartDay;
  }
```

Add to `updateProfile` data parameter type:
```typescript
    financialMonthStartDay?: number;
```

Add handling in `updateProfile` body (after `quickActionsHintDismissed` block):
```typescript
    if (data.financialMonthStartDay !== undefined) {
      this._financialMonthStartDay = data.financialMonthStartDay;
      changes.financialMonthStartDay = data.financialMonthStartDay;
    }
```

- [ ] **Step 3: Update mapper**

In `profile.mapper.ts`:

In `toDomain()`, add to the reconstitute object (after `quickActionsHintDismissed`):
```typescript
      financialMonthStartDay: ormEntity.financialMonthStartDay,
```

In `toOrm()`, add (after `quickActionsHintDismissed`):
```typescript
    ormEntity.financialMonthStartDay = domainEntity.financialMonthStartDay;
```

- [ ] **Step 4: Update ProfileResponse type**

In `application/types/index.ts`, add to `ProfileResponse` (after `quickActionsHintDismissed`):
```typescript
  financialMonthStartDay: number;
```

- [ ] **Step 5: Update UpdateProfileCommand**

In `update-profile.command.ts`, add to `data` type (after `quickActionsHintDismissed`):
```typescript
      financialMonthStartDay?: number;
```

- [ ] **Step 6: Update UpdateProfileDto**

In `update-profile.dto.ts`, add imports and field:

Add `IsInt, Min, Max` to the existing imports from `class-validator`:
```typescript
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsArray,
  IsObject,
  IsInt,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
```

Add field at end of `UpdateProfileDto`:
```typescript
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  financialMonthStartDay?: number;
```

- [ ] **Step 7: Update toResponse in both handlers**

In `get-profile.handler.ts` `toResponse()`, add (after `quickActionsHintDismissed`):
```typescript
      financialMonthStartDay: profile.financialMonthStartDay,
```

In `update-profile.handler.ts` `toResponse()`, add (after `quickActionsHintDismissed`):
```typescript
      financialMonthStartDay: profile.financialMonthStartDay,
```

- [ ] **Step 8: Run backend build to verify no type errors**

Run: `cd backend && bun run build`
Expected: Compiles without errors.

- [ ] **Step 9: Run existing tests**

Run: `cd backend && bun run test`
Expected: All tests pass (existing tests don't check for new field).

- [ ] **Step 10: Commit**

```bash
git add backend/src/modules/identity/
git commit -m "feat(profile): add financialMonthStartDay field across domain layer"
```

---

### Task 4: Update getMonthlyStats chain

**Files:**
- Modify: `backend/src/modules/accounting/domain/repositories/transaction.repository.interface.ts`
- Modify: `backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts`
- Modify: `backend/src/modules/accounting/application/queries/get-monthly-stats/get-monthly-stats.query.ts`
- Modify: `backend/src/modules/accounting/application/queries/get-monthly-stats/get-monthly-stats.handler.ts`
- Modify: `backend/src/modules/accounting/application/queries/get-monthly-stats/get-monthly-stats.handler.spec.ts`
- Modify: `backend/src/modules/accounting/presentation/controllers/transactions.controller.ts`

- [ ] **Step 1: Update repository interface**

In `transaction.repository.interface.ts`, change `getMonthlyStats` signature:

```typescript
  getMonthlyStats(userId: string, year: number, month: number, startDay?: number): Promise<MonthlyStats>;
```

(Optional `startDay` with default behavior = 1 for backwards compat.)

- [ ] **Step 2: Update repository implementation**

In `transaction.repository.ts`, in the `getMonthlyStats` method, replace the first two lines:

Old:
```typescript
  async getMonthlyStats(userId: string, year: number, month: number): Promise<MonthlyStats> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
```

New:
```typescript
  async getMonthlyStats(userId: string, year: number, month: number, startDay: number = 1): Promise<MonthlyStats> {
    const { start: startDate, end: endDate } = getFinancialMonthBounds(year, month, startDay);
```

Add import at top of file:
```typescript
import { getFinancialMonthBounds } from '../../../../shared/utils/financial-period';
```

- [ ] **Step 3: Update query object**

In `get-monthly-stats.query.ts`:

```typescript
export class GetMonthlyStatsQuery {
  constructor(
    public readonly userId: string,
    public readonly year: number,
    public readonly month: number,
    public readonly startDay: number = 1,
  ) {}
}
```

- [ ] **Step 4: Update handler**

In `get-monthly-stats.handler.ts`, change the execute method:

```typescript
  async execute(query: GetMonthlyStatsQuery) {
    return this.transactionRepository.getMonthlyStats(
      query.userId, query.year, query.month, query.startDay,
    );
  }
```

- [ ] **Step 5: Update TransactionsController to inject profile and read startDay**

In `transactions.controller.ts`, add imports and inject `PROFILE_REPOSITORY`:

Add imports:
```typescript
import {
  IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../../identity/domain/repositories/profile.repository.interface';
```

Add to constructor:
```typescript
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
```

(Add `Inject` to the existing `@nestjs/common` import if not present.)

Update `getMonthlyStats` endpoint:

```typescript
  @Get('stats/monthly')
  async getMonthlyStats(
    @CurrentUser('sub') userId: string,
    @Query() query: MonthlyStatsQueryDto,
  ): Promise<unknown> {
    const profile = await this.profileRepository.findById(userId);
    const startDay = profile?.financialMonthStartDay ?? 1;
    return this.queryBus.execute(
      new GetMonthlyStatsQuery(userId, query.year, query.month, startDay),
    );
  }
```

- [ ] **Step 6: Update tests**

In `get-monthly-stats.handler.spec.ts`, update the test to verify startDay is passed:

```typescript
  it('should return monthly stats from repository', async () => {
    const stats = {
      totalIncome: 5000,
      totalExpense: 3000,
      incomeByCurrency: { USD: 5000 },
      expenseByCurrency: { USD: 3000 },
    };
    mockTransactionRepository.getMonthlyStats.mockResolvedValue(stats);

    const result = await handler.execute(new GetMonthlyStatsQuery('user-1', 2026, 3));

    expect(result).toEqual(stats);
    expect(mockTransactionRepository.getMonthlyStats).toHaveBeenCalledWith('user-1', 2026, 3, 1);
  });

  it('should pass custom startDay to repository', async () => {
    const stats = {
      totalIncome: 0,
      totalExpense: 0,
      incomeByCurrency: {},
      expenseByCurrency: {},
    };
    mockTransactionRepository.getMonthlyStats.mockResolvedValue(stats);

    const result = await handler.execute(new GetMonthlyStatsQuery('user-1', 2026, 3, 15));

    expect(result).toEqual(stats);
    expect(mockTransactionRepository.getMonthlyStats).toHaveBeenCalledWith('user-1', 2026, 3, 15);
  });
```

- [ ] **Step 7: Run tests**

Run: `cd backend && bun run test -- --testPathPattern=get-monthly-stats`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/accounting/
git commit -m "feat(stats): pass financialMonthStartDay through getMonthlyStats chain"
```

---

### Task 5: Update budget handlers

**Files:**
- Modify: `backend/src/modules/planning/application/queries/get-budget-for-month/get-budget-for-month.query.ts`
- Modify: `backend/src/modules/planning/application/queries/get-budget-for-month/get-budget-for-month.handler.ts`
- Modify: `backend/src/modules/planning/application/queries/get-budget-for-month/get-budget-for-month.handler.spec.ts`
- Modify: `backend/src/modules/planning/application/queries/get-budget-history/get-budget-history.query.ts`
- Modify: `backend/src/modules/planning/application/queries/get-budget-history/get-budget-history.handler.ts`
- Modify: `backend/src/modules/planning/application/queries/get-budget-history/get-budget-history.handler.spec.ts`
- Modify: `backend/src/modules/planning/presentation/controllers/budgets.controller.ts`

- [ ] **Step 1: Update GetBudgetForMonthQuery**

```typescript
export class GetBudgetForMonthQuery {
  constructor(
    public readonly userId: string,
    public readonly year: number,
    public readonly month: number,
    public readonly startDay: number = 1,
  ) {}
}
```

- [ ] **Step 2: Update GetBudgetForMonthHandler**

Change the `getMonthlyStats` call to pass `startDay`:

```typescript
    const stats = await this.transactionRepository.getMonthlyStats(
      query.userId,
      query.year,
      query.month,
      query.startDay,
    );
```

- [ ] **Step 3: Update GetBudgetHistoryQuery**

```typescript
export class GetBudgetHistoryQuery {
  constructor(
    public readonly userId: string,
    public readonly months: number = 6,
    public readonly startDay: number = 1,
  ) {}
}
```

- [ ] **Step 4: Update GetBudgetHistoryHandler**

Add import:
```typescript
import { getCurrentFinancialMonth, getFinancialMonth } from '../../../../shared/utils/financial-period';
```

Replace the month iteration logic in the `execute` method. Change:

```typescript
    const now = new Date();
    const months: Array<{ year: number; month: number }> = [];

    for (let i = 0; i < query.months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: date.getFullYear(), month: date.getMonth() + 1 });
    }
```

To:

```typescript
    const months: Array<{ year: number; month: number }> = [];
    const current = getCurrentFinancialMonth(query.startDay);
    let { year: y, month: m } = current;

    for (let i = 0; i < query.months; i++) {
      months.push({ year: y, month: m });
      m--;
      if (m === 0) {
        m = 12;
        y--;
      }
    }
```

Update the `getMonthlyStats` call to pass `startDay`:

```typescript
    const statsResults = await Promise.all(
      monthsWithBudgets.map((m) =>
        this.transactionRepository.getMonthlyStats(query.userId, m.year, m.month, query.startDay),
      ),
    );
```

- [ ] **Step 5: Update BudgetsController**

Add a helper to read startDay from profile. The controller already has `profileRepository`. Add a method:

```typescript
  private async getStartDay(userId: string): Promise<number> {
    const profile = await this.profileRepository.findById(userId);
    return profile?.financialMonthStartDay ?? 1;
  }
```

Update `getCurrent`:
```typescript
  @Get('current')
  async getCurrent(@CurrentUser('sub') userId: string): Promise<unknown> {
    const now = new Date();
    const startDay = await this.getStartDay(userId);
    const { getCurrentFinancialMonth } = await import('../../../../shared/utils/financial-period');
    const { year, month } = getCurrentFinancialMonth(startDay);
    return this.queryBus.execute(
      new GetBudgetForMonthQuery(userId, year, month, startDay),
    );
  }
```

Wait — better to import at top level. Add import at top of `budgets.controller.ts`:

```typescript
import { getCurrentFinancialMonth } from '../../../../shared/utils/financial-period';
```

Then the method:
```typescript
  @Get('current')
  async getCurrent(@CurrentUser('sub') userId: string): Promise<unknown> {
    const startDay = await this.getStartDay(userId);
    const { year, month } = getCurrentFinancialMonth(startDay);
    return this.queryBus.execute(
      new GetBudgetForMonthQuery(userId, year, month, startDay),
    );
  }
```

Update `getHistory`:
```typescript
  @Get('history')
  async getHistory(
    @CurrentUser('sub') userId: string,
    @Query('months') months?: string,
  ): Promise<unknown> {
    const parsedMonths = months ? parseInt(months, 10) : 6;
    const startDay = await this.getStartDay(userId);
    return this.queryBus.execute(
      new GetBudgetHistoryQuery(userId, isNaN(parsedMonths) ? 6 : parsedMonths, startDay),
    );
  }
```

- [ ] **Step 6: Update tests for GetBudgetForMonthHandler**

In `get-budget-for-month.handler.spec.ts`, update the existing tests to pass `startDay=1` (default) and add a test for custom startDay:

Update existing `getMonthlyStats` expectations to include `1` as the 4th arg:
```typescript
// In every test that checks getMonthlyStats calls, the 4th argument is now 1:
expect(mockTransactionRepository.getMonthlyStats).toHaveBeenCalledWith('user-1', 2026, 3, 1);
```

Add test:
```typescript
  it('should pass startDay to getMonthlyStats', async () => {
    const defaultBudget = Budget.createDefault('b-1', 'user-1', 50000, 'USD');
    mockBudgetRepository.findOverride.mockResolvedValue(null);
    mockBudgetRepository.findDefault.mockResolvedValue(defaultBudget);
    mockTransactionRepository.getMonthlyStats.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 0,
      incomeByCurrency: {},
      expenseByCurrency: {},
    });

    await handler.execute(new GetBudgetForMonthQuery('user-1', 2026, 3, 15));

    expect(mockTransactionRepository.getMonthlyStats).toHaveBeenCalledWith('user-1', 2026, 3, 15);
  });
```

- [ ] **Step 7: Update tests for GetBudgetHistoryHandler**

In `get-budget-history.handler.spec.ts`, update `getMonthlyStats` expectations to check for 4th arg. In the test "should return budget history with stats for months that have a budget", add 4th arg `1`:

```typescript
// Existing calls now pass default startDay=1
expect(mockTransactionRepository.getMonthlyStats).toHaveBeenCalledTimes(2);
```

- [ ] **Step 8: Run all budget tests**

Run: `cd backend && bun run test -- --testPathPattern=budget`
Expected: All tests pass.

- [ ] **Step 9: Run full backend tests**

Run: `cd backend && bun run test`
Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add backend/src/modules/planning/
git commit -m "feat(budget): use financial month for budget calculations"
```

---

## Phase 2 — Frontend Infrastructure + UI

### Task 6: Update frontend Profile types + API

**Files:**
- Modify: `frontend/src/shared/api/database.types.ts`
- Modify: `frontend/src/shared/api/services/profileApi.ts`

- [ ] **Step 1: Add field to database.types.ts**

In `Row` (after `quick_actions_hint_dismissed: boolean;`):
```typescript
          financial_month_start_day: number;
```

In `Insert` (after `quick_actions_hint_dismissed?: boolean;`):
```typescript
          financial_month_start_day?: number;
```

In `Update` (after `quick_actions_hint_dismissed?: boolean;`):
```typescript
          financial_month_start_day?: number;
```

- [ ] **Step 2: Update profileApi.ts**

In `ProfileResponse` interface (after `quickActionsHintDismissed`):
```typescript
  financialMonthStartDay: number;
```

In `transformProfile()` (after `quick_actions_hint_dismissed`):
```typescript
    financial_month_start_day: profile.financialMonthStartDay,
```

In `update()` method, add to the request body (after `quickActionsHintDismissed`):
```typescript
      financialMonthStartDay: updates.financial_month_start_day,
```

- [ ] **Step 3: Verify frontend builds**

Run: `cd frontend && bun run build`
Expected: Compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/api/database.types.ts frontend/src/shared/api/services/profileApi.ts
git commit -m "feat(frontend): add financial_month_start_day to Profile types and API"
```

---

### Task 7: Frontend financial period utility

**Files:**
- Create: `frontend/src/shared/lib/utils/financialPeriod.ts`
- Modify: `frontend/src/shared/lib/date/index.ts`

- [ ] **Step 1: Create frontend utility**

```typescript
// frontend/src/shared/lib/utils/financialPeriod.ts

/**
 * Resolve startDay for a specific month.
 * If startDay > days in month, returns last day.
 */
export function resolveStartDay(year: number, month: number, startDay: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.min(startDay, daysInMonth);
}

/**
 * Returns financial month boundaries (exclusive end).
 */
export function getFinancialMonthBounds(
  year: number,
  month: number,
  startDay: number,
): { start: Date; end: Date } {
  const resolvedDay = resolveStartDay(year, month, startDay);
  const start = new Date(year, month - 1, resolvedDay);

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextResolvedDay = resolveStartDay(nextYear, nextMonth, startDay);
  const end = new Date(nextYear, nextMonth - 1, nextResolvedDay);

  return { start, end };
}

/**
 * Determines which financial month a date belongs to.
 */
export function getFinancialMonth(
  date: Date,
  startDay: number,
): { year: number; month: number } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const resolvedDay = resolveStartDay(year, month, startDay);

  if (day >= resolvedDay) {
    return { year, month };
  } else {
    if (month === 1) {
      return { year: year - 1, month: 12 };
    }
    return { year, month: month - 1 };
  }
}

/**
 * Returns current financial month.
 */
export function getCurrentFinancialMonth(startDay: number): { year: number; month: number } {
  return getFinancialMonth(new Date(), startDay);
}

const SHORT_MONTHS_RU = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

const FULL_MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/**
 * Format financial period label.
 * startDay=1: "Март 2026"
 * startDay≠1: "15 мар – 14 апр"
 */
export function formatFinancialPeriod(year: number, month: number, startDay: number): string {
  if (startDay === 1) {
    return `${FULL_MONTHS_RU[month - 1]} ${year}`;
  }
  const { start, end } = getFinancialMonthBounds(year, month, startDay);
  const endInclusive = new Date(end.getTime() - 1); // exclusive → last day

  const startStr = `${start.getDate()} ${SHORT_MONTHS_RU[start.getMonth()]}`;
  const endStr = `${endInclusive.getDate()} ${SHORT_MONTHS_RU[endInclusive.getMonth()]}`;

  return `${startStr} – ${endStr}`;
}

/**
 * Days remaining in current financial period, inclusive of today. Minimum 1.
 */
export function getDaysRemainingInPeriod(startDay: number): number {
  const now = new Date();
  const { year, month } = getCurrentFinancialMonth(startDay);
  const { end } = getFinancialMonthBounds(year, month, startDay);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = end.getTime() - todayStart.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}
```

- [ ] **Step 2: Verify frontend builds**

Run: `cd frontend && bun run build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/lib/utils/financialPeriod.ts
git commit -m "feat(frontend): add financial period utility"
```

---

### Task 8: useFinancialPeriod composable

**Files:**
- Create: `frontend/src/shared/lib/hooks/useFinancialPeriod.ts`

- [ ] **Step 1: Create composable**

```typescript
// frontend/src/shared/lib/hooks/useFinancialPeriod.ts
import { computed } from 'vue';
import { useCurrentUser } from './useCurrentUser';
import { useProfile } from '@/shared/api';
import {
  getCurrentFinancialMonth,
  getFinancialMonthBounds,
  getDaysRemainingInPeriod,
} from '@/shared/lib/utils/financialPeriod';

export function useFinancialPeriod() {
  const { userId } = useCurrentUser();
  const { profile } = useProfile(userId);

  const startDay = computed(() => profile.value?.financial_month_start_day ?? 1);
  const isCustomPeriod = computed(() => startDay.value !== 1);

  const currentPeriod = computed(() => getCurrentFinancialMonth(startDay.value));

  const currentBounds = computed(() => {
    const { year, month } = currentPeriod.value;
    return getFinancialMonthBounds(year, month, startDay.value);
  });

  const daysRemaining = computed(() => getDaysRemainingInPeriod(startDay.value));

  return { startDay, isCustomPeriod, currentPeriod, currentBounds, daysRemaining };
}
```

- [ ] **Step 2: Verify frontend builds**

Run: `cd frontend && bun run build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/lib/hooks/useFinancialPeriod.ts
git commit -m "feat(frontend): add useFinancialPeriod composable"
```

---

### Task 9: FinancialPeriodModal + ProfilePage integration

**Files:**
- Create: `frontend/src/features/configure-financial-period/ui/FinancialPeriodModal.vue`
- Create: `frontend/src/features/configure-financial-period/index.ts`
- Modify: `frontend/src/pages/profile/ProfilePage.vue`

- [ ] **Step 1: Create barrel export**

```typescript
// frontend/src/features/configure-financial-period/index.ts
export { default as FinancialPeriodModal } from './ui/FinancialPeriodModal.vue';
```

- [ ] **Step 2: Create FinancialPeriodModal**

```vue
<!-- frontend/src/features/configure-financial-period/ui/FinancialPeriodModal.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UModal, UButton, useToast } from '@/shared/ui';
import { useProfile } from '@/shared/api';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';
import {
  getFinancialMonthBounds,
  getCurrentFinancialMonth,
  formatFinancialPeriod,
} from '@/shared/lib/utils/financialPeriod';
import { useQueryClient } from '@tanstack/vue-query';

const model = defineModel<boolean>({ required: true });

const { userId } = useCurrentUser();
const { profile, updateProfile } = useProfile(userId);
const { toast } = useToast();
const { trigger } = useHaptics();
const queryClient = useQueryClient();

const currentStartDay = computed(() => profile.value?.financial_month_start_day ?? 1);
const selectedDay = ref(currentStartDay.value);

// Sync selectedDay when profile loads or modal opens
watch([() => model.value, currentStartDay], ([open, day]) => {
  if (open) selectedDay.value = day;
});

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

const previewLabel = computed(() =>
  formatFinancialPeriod(currentYear, currentMonth, selectedDay.value),
);

const daysInPeriod = computed(() => {
  const { start, end } = getFinancialMonthBounds(currentYear, currentMonth, selectedDay.value);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
});

const isChanged = computed(() => selectedDay.value !== currentStartDay.value);
const isChangingFromCustom = computed(() => currentStartDay.value !== 1 && isChanged.value);

const isSaving = ref(false);

function selectDay(day: number) {
  selectedDay.value = day;
  trigger('selection');
}

async function save() {
  isSaving.value = true;
  try {
    await updateProfile({ financial_month_start_day: selectedDay.value });
    // Global cache invalidation — period boundaries changed
    await queryClient.invalidateQueries();
    trigger('success');
    toast({ title: 'Начало месяца обновлено', variant: 'default' });
    model.value = false;
  } catch {
    trigger('error');
    toast({ title: 'Ошибка сохранения', variant: 'destructive' });
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <UModal v-model="model" title="Начало финансового месяца">
    <div class="space-y-5">
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        Выберите день, с которого начинается ваш финансовый месяц.
        Обычно это день получения зарплаты.
      </p>

      <!-- Day Grid -->
      <div class="space-y-1.5">
        <div class="grid grid-cols-7 gap-1.5">
          <button
            v-for="day in 28"
            :key="day"
            :class="[
              'h-10 rounded-lg text-sm font-medium transition-all',
              day === selectedDay
                ? 'bg-primary text-white shadow-sm scale-105'
                : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/10 text-text-primary-light dark:text-text-primary-dark',
            ]"
            @click="selectDay(day)"
          >
            {{ day }}
          </button>
        </div>
        <div class="grid grid-cols-7 gap-1.5">
          <button
            v-for="day in [29, 30, 31]"
            :key="day"
            :class="[
              'h-10 rounded-lg text-sm font-medium transition-all',
              day === selectedDay
                ? 'bg-primary text-white shadow-sm scale-105'
                : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/10 text-text-primary-light dark:text-text-primary-dark',
            ]"
            @click="selectDay(day)"
          >
            {{ day }}
          </button>
        </div>

        <p
          v-if="selectedDay > 28"
          class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          В коротких месяцах будет использоваться последний доступный день
          (напр. 28-е в феврале)
        </p>

        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          Если вы получаете зарплату дважды в месяц, укажите день первой выплаты
        </p>
      </div>

      <!-- Live Preview -->
      <div class="rounded-xl bg-surface-light dark:bg-surface-dark p-4 space-y-1.5">
        <p
          class="text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark"
        >
          Ваш текущий период
        </p>
        <p class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
          {{ previewLabel }}
        </p>
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          {{ daysInPeriod }} дней в периоде
        </p>
      </div>

      <!-- Warning -->
      <div
        v-if="isChangingFromCustom"
        class="rounded-lg bg-warning/10 p-3 text-sm text-warning"
      >
        Смена дня начала пересчитает статистику за все месяцы.
        Исторические данные будут перегруппированы по новым границам.
      </div>
    </div>

    <template #actions>
      <UButton variant="secondary" full-width @click="model = false">Отмена</UButton>
      <UButton
        variant="primary"
        full-width
        :disabled="!isChanged || isSaving"
        :loading="isSaving"
        @click="save"
      >
        Сохранить
      </UButton>
    </template>
  </UModal>
</template>
```

- [ ] **Step 3: Integrate into ProfilePage.vue**

Add import at top of `<script setup>`:
```typescript
import { FinancialPeriodModal } from '@/features/configure-financial-period';
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
```

Add after the `usePrimaryColor()` block:
```typescript
// Financial period
const { startDay } = useFinancialPeriod();
const showFinancialPeriodModal = ref(false);
const financialPeriodLabel = computed(() =>
  startDay.value === 1 ? '1-е (стандарт)' : `${startDay.value}-е число`,
);
```

Add menu item to `settingsGroup` array, after the `currency` item:
```typescript
  {
    id: 'financial-period',
    icon: 'calendar_month',
    label: 'Начало месяца',
    value: () => financialPeriodLabel.value,
    color: '#6366f1', // indigo
  },
```

Add handler in `handleMenuClick`:
```typescript
    case 'financial-period':
      showFinancialPeriodModal.value = true;
      break;
```

Add modal in template, after `EditProfileModal`:
```vue
    <!-- Financial Period Modal -->
    <FinancialPeriodModal v-model="showFinancialPeriodModal" />
```

- [ ] **Step 4: Verify frontend builds**

Run: `cd frontend && bun run build`
Expected: Compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/configure-financial-period/ frontend/src/pages/profile/ProfilePage.vue
git commit -m "feat(ui): add FinancialPeriodModal and ProfilePage integration"
```

---

## Phase 3 — Module Migration

### Task 10: Update useAnalyticsFilters

**Files:**
- Modify: `frontend/src/features/analytics-filters/model/useAnalyticsFilters.ts`

- [ ] **Step 1: Update month-start filter and daysRemainingInMonth**

Add import:
```typescript
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
```

Inside `useAnalyticsFilters()`, add at the top:
```typescript
  const { currentBounds, daysRemaining: daysRemainingInPeriod } = useFinancialPeriod();
```

Update the `'month-start'` case in `effectiveDateRange`:

```typescript
      case 'month-start': {
        const { start } = currentBounds.value;
        const monthStart = new Date(start);
        monthStart.setHours(0, 0, 0, 0);
        return { startDate: monthStart, endDate: now };
      }
```

Update `daysRemainingInMonth`:

```typescript
  const daysRemainingInMonth = computed(() => daysRemainingInPeriod.value);
```

Remove the import of `getDaysRemainingInMonth` from `@/shared/lib/date` (if this was its only usage in this file).

- [ ] **Step 2: Verify frontend builds**

Run: `cd frontend && bun run build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/analytics-filters/model/useAnalyticsFilters.ts
git commit -m "feat(analytics): use financial period for month-start filter"
```

---

### Task 11: Update query keys

**Files:**
- Modify: `frontend/src/entities/transaction/api/queryKeys.ts`

- [ ] **Step 1: Add startDay to monthlyStats key**

Update the `monthlyStats` factory:

```typescript
  monthlyStats: (userId: string, year: number, month: number, startDay: number = 1) =>
    [...transactionQueryKeys.all, 'monthly-stats', userId, year, month, startDay] as const,
```

- [ ] **Step 2: Verify no callers break**

The existing callers pass `(userId, year, month)` — with the default `startDay=1`, the key stays the same. Frontend doesn't need to pass startDay explicitly because backend resolves it server-side.

Run: `cd frontend && bun run build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/entities/transaction/api/queryKeys.ts
git commit -m "feat(cache): add startDay to monthlyStats query key"
```

---

### Task 12: Changelog entry

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

- [ ] **Step 1: Bump version and add entry**

Change:
```typescript
export const CURRENT_VERSION = '1.0.39';
```
To:
```typescript
export const CURRENT_VERSION = '1.0.40';
```

Add at the top of `CHANGELOG_ENTRIES` array:
```typescript
  {
    version: '1.0.40',
    date: '2026-03-24',
    title: 'Финансовый период',
    items: [
      {
        type: 'feature',
        text: 'Настраиваемый день начала финансового месяца — статистика, бюджеты и аналитика теперь считаются по вашему периоду',
      },
    ],
  },
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "feat(changelog): add v1.0.40 financial period entry"
```

---

### Task 13: Final verification

- [ ] **Step 1: Run backend build + tests**

Run: `cd backend && bun run build && bun run test`
Expected: Build succeeds, all tests pass.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && bun run build`
Expected: Type-check + production build succeeds.

- [ ] **Step 3: Run migration on local DB (if available)**

Run: `cd backend && bun run migration:run`
Expected: Migration applied (or already applied from Task 1).

- [ ] **Step 4: Manual smoke test**

Start dev: `bun run dev`
- Open profile page → verify "Начало месяца" setting appears
- Click → modal shows grid 1-31 with live preview
- Select day 15 → preview shows "15 мар – 14 апр"
- Save → toast appears, all stats refresh
- Check analytics → month-start filter uses financial period
- Set back to 1 → everything reverts to calendar months
