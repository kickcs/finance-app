# Debts Cursor-Based Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cursor-based pagination with server-side filtering and grouping by person to the debts feature.

**Architecture:** New `GET /api/debts/paginated` endpoint returns debts grouped by `(personName, debtType)`, paginated by groups (10 per page). Frontend uses `useInfiniteQuery` with `IntersectionObserver` for auto-loading. Existing `GET /api/debts` stays for the dashboard widget.

**Spec deviations:**
- Grouping by `(personName, debtType)` instead of `(personId)` — debts use `person_name` string, not a foreign key to `person` table. Grouping by `(personName, debtType)` is more granular and matches the existing frontend grouping logic.
- Per-group `summary` field omitted from API response — computed inline in frontend from `group.debts` array. Keeps the API simpler.

**Tech Stack:** NestJS, TypeORM QueryBuilder, TanStack Vue Query `useInfiniteQuery`, Reka UI `CollapsibleRoot`, VueUse `useIntersectionObserver`

---

### Task 1: Backend — DTO for paginated debts

**Files:**
- Create: `backend/src/modules/debt/presentation/dto/get-debts-paginated.dto.ts`
- Modify: `backend/src/modules/debt/presentation/dto/index.ts`

- [ ] **Step 1: Create the DTO**

```typescript
// backend/src/modules/debt/presentation/dto/get-debts-paginated.dto.ts
import { IsString, IsNumber, IsOptional, IsIn, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetDebtsPaginatedDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  pageSize?: number = 10;

  @IsOptional()
  @IsString()
  cursorPersonName?: string;

  @IsOptional()
  @IsIn(['given', 'taken'])
  cursorDebtType?: string;

  @IsOptional()
  @IsString()
  cursorCreatedAt?: string;

  @IsOptional()
  @IsIn(['active', 'closed'])
  status?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  personName?: string;
}
```

- [ ] **Step 2: Export from index**

Add `export * from './get-debts-paginated.dto';` to `backend/src/modules/debt/presentation/dto/index.ts`.

- [ ] **Step 3: Verify build**

Run: `cd backend && bun run build`
Expected: No errors

---

### Task 2: Backend — Query class

**Files:**
- Create: `backend/src/modules/debt/application/queries/get-debts-paginated/get-debts-paginated.query.ts`

- [ ] **Step 1: Create the query**

```typescript
// backend/src/modules/debt/application/queries/get-debts-paginated/get-debts-paginated.query.ts
export class GetDebtsPaginatedQuery {
  constructor(
    public readonly userId: string,
    public readonly pageSize: number = 10,
    public readonly cursorPersonName?: string,
    public readonly cursorDebtType?: string,
    public readonly cursorCreatedAt?: string,
    public readonly status?: string,
    public readonly currency?: string,
    public readonly personName?: string,
  ) {}
}
```

---

### Task 3: Backend — Repository interface and implementation

**Files:**
- Modify: `backend/src/modules/debt/domain/repositories/debt.repository.interface.ts`
- Modify: `backend/src/modules/debt/infrastructure/persistence/repositories/debt.repository.ts`

- [ ] **Step 1: Add types and method to repository interface**

Add to `debt.repository.interface.ts`:

```typescript
export interface DebtPaginationOptions {
  pageSize: number;
  cursorPersonName?: string;
  cursorDebtType?: string;
  cursorCreatedAt?: string;
  status?: string;  // 'active' | 'closed'
  currency?: string;
  personName?: string;
}

export interface DebtGroupResult {
  personName: string;
  debtType: string;
  lastDebtDate: Date;
  debts: Debt[];
}

export interface PaginatedDebtGroups {
  groups: DebtGroupResult[];
  totalSummary: {
    totalGiven: Record<string, number>;
    totalTaken: Record<string, number>;
  };
  nextCursor: { personName: string; debtType: string; createdAt: string } | null;
  hasMore: boolean;
  totalDebtsCount: number;
}
```

Add method to `IDebtRepository`:

```typescript
getPaginated(userId: string, options: DebtPaginationOptions): Promise<PaginatedDebtGroups>;
```

- [ ] **Step 2: Implement in TypeOrmDebtRepository**

Add `getPaginated` method to `backend/src/modules/debt/infrastructure/persistence/repositories/debt.repository.ts`:

```typescript
async getPaginated(
  userId: string,
  options: DebtPaginationOptions,
): Promise<PaginatedDebtGroups> {
  const { pageSize, cursorPersonName, cursorDebtType, cursorCreatedAt, status, currency, personName } = options;

  // NOTE: TypeORM QueryBuilder uses entity property names (camelCase), not DB column names (snake_case)

  // 1. Get total summary (across ALL matching debts, not just current page)
  const summaryQuery = this.ormRepository
    .createQueryBuilder('d')
    .select('d.debtType', 'debtType')
    .addSelect('d.currency', 'currency')
    .addSelect('SUM(d.remainingAmount)', 'total')
    .where('d.userId = :userId', { userId })
    .andWhere('d.isPrivate = false');

  if (status === 'active') summaryQuery.andWhere('d.isClosed = false');
  if (status === 'closed') summaryQuery.andWhere('d.isClosed = true');
  if (currency) summaryQuery.andWhere('d.currency = :currency', { currency });
  if (personName) summaryQuery.andWhere('d.personName = :personName', { personName });

  summaryQuery.groupBy('d.debtType').addGroupBy('d.currency');

  const summaryRows = await summaryQuery.getRawMany<{
    debtType: string;
    currency: string;
    total: string;
  }>();

  const totalGiven: Record<string, number> = {};
  const totalTaken: Record<string, number> = {};
  for (const row of summaryRows) {
    const amount = Number(row.total);
    if (row.debtType === 'given') {
      totalGiven[row.currency] = (totalGiven[row.currency] || 0) + amount;
    } else {
      totalTaken[row.currency] = (totalTaken[row.currency] || 0) + amount;
    }
  }

  // 2. Get total debts count
  const countQuery = this.ormRepository
    .createQueryBuilder('d')
    .where('d.userId = :userId', { userId });
  if (status === 'active') countQuery.andWhere('d.isClosed = false');
  if (status === 'closed') countQuery.andWhere('d.isClosed = true');
  if (currency) countQuery.andWhere('d.currency = :currency', { currency });
  if (personName) countQuery.andWhere('d.personName = :personName', { personName });
  const totalDebtsCount = await countQuery.getCount();

  // 3. Get groups (personName + debtType) ordered by last debt date
  // Use raw column names in select aliases since getRawMany bypasses entity mapping
  let groupsQuery = this.ormRepository
    .createQueryBuilder('d')
    .select('d.personName', 'personName')
    .addSelect('d.debtType', 'debtType')
    .addSelect('MAX(d.createdAt)', 'lastDebtDate')
    .where('d.userId = :userId', { userId });

  if (status === 'active') groupsQuery.andWhere('d.isClosed = false');
  if (status === 'closed') groupsQuery.andWhere('d.isClosed = true');
  if (currency) groupsQuery.andWhere('d.currency = :currency', { currency });
  if (personName) groupsQuery.andWhere('d.personName = :personName', { personName });

  groupsQuery = groupsQuery.groupBy('d.personName').addGroupBy('d.debtType');

  // Apply cursor using HAVING on aggregated column
  if (cursorCreatedAt && cursorPersonName !== undefined && cursorDebtType) {
    groupsQuery.having(
      `(MAX(d.createdAt) < :cursorCreatedAt ` +
        `OR (MAX(d.createdAt) = :cursorCreatedAt AND d.personName > :cursorPersonName) ` +
        `OR (MAX(d.createdAt) = :cursorCreatedAt AND d.personName = :cursorPersonName AND d.debtType > :cursorDebtType))`,
      {
        cursorCreatedAt: new Date(cursorCreatedAt),
        cursorPersonName,
        cursorDebtType,
      },
    );
  }

  // Order by the raw alias from select since getRawMany is used
  groupsQuery = groupsQuery
    .orderBy('"lastDebtDate"', 'DESC')
    .addOrderBy('d.personName', 'ASC')
    .addOrderBy('d.debtType', 'ASC')
    .limit(pageSize + 1);

  const groupRows = await groupsQuery.getRawMany<{
    personName: string;
    debtType: string;
    lastDebtDate: Date;
  }>();

  const hasMore = groupRows.length > pageSize;
  const groupsToFetch = groupRows.slice(0, pageSize);

  if (groupsToFetch.length === 0) {
    return {
      groups: [],
      totalSummary: { totalGiven, totalTaken },
      nextCursor: null,
      hasMore: false,
      totalDebtsCount,
    };
  }

  // 4. Fetch debts for these groups
  const groupConditions = groupsToFetch.map(
    (g, i) => `(d.personName = :pn${i} AND d.debtType = :dt${i})`,
  );
  const groupParams: Record<string, string> = {};
  groupsToFetch.forEach((g, i) => {
    groupParams[`pn${i}`] = g.personName;
    groupParams[`dt${i}`] = g.debtType;
  });

  let debtsQuery = this.ormRepository
    .createQueryBuilder('d')
    .where('d.userId = :userId', { userId })
    .andWhere(`(${groupConditions.join(' OR ')})`, groupParams)
    .orderBy('d.createdAt', 'DESC');

  if (status === 'active') debtsQuery = debtsQuery.andWhere('d.isClosed = false');
  if (status === 'closed') debtsQuery = debtsQuery.andWhere('d.isClosed = true');
  if (currency) debtsQuery = debtsQuery.andWhere('d.currency = :currency', { currency });

  const ormDebts = await debtsQuery.getMany();
  const debts = ormDebts.map((e) => DebtMapper.toDomain(e));

  // 5. Build groups result
  const groupsMap = new Map<string, DebtGroupResult>();
  for (const group of groupsToFetch) {
    const key = `${group.personName}_${group.debtType}`;
    groupsMap.set(key, {
      personName: group.personName,
      debtType: group.debtType,
      lastDebtDate: group.lastDebtDate,
      debts: [],
    });
  }
  for (const debt of debts) {
    const key = `${debt.personName}_${debt.debtTypeValue}`;
    groupsMap.get(key)?.debts.push(debt);
  }

  const groups = groupsToFetch.map((g) => groupsMap.get(`${g.personName}_${g.debtType}`)!);

  // 6. Build cursor
  const lastGroup = groupsToFetch[groupsToFetch.length - 1];
  const nextCursor = hasMore
    ? {
        personName: lastGroup.personName,
        debtType: lastGroup.debtType,
        createdAt: new Date(lastGroup.lastDebtDate).toISOString(),
      }
    : null;

  return {
    groups,
    totalSummary: { totalGiven, totalTaken },
    nextCursor,
    hasMore,
    totalDebtsCount,
  };
}
```

Note: `DebtMapper` import already exists in this file.

- [ ] **Step 3: Verify build**

Run: `cd backend && bun run build`
Expected: No errors

---

### Task 4: Backend — Query handler

**Files:**
- Create: `backend/src/modules/debt/application/queries/get-debts-paginated/get-debts-paginated.handler.ts`
- Modify: `backend/src/modules/debt/application/queries/index.ts`

- [ ] **Step 1: Create query handler**

```typescript
// backend/src/modules/debt/application/queries/get-debts-paginated/get-debts-paginated.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetDebtsPaginatedQuery } from './get-debts-paginated.query';
import {
  IDebtRepository,
  DEBT_REPOSITORY,
} from '../../../domain/repositories/debt.repository.interface';
import { DebtResponseMapper } from '../../mappers/debt-response.mapper';

@QueryHandler(GetDebtsPaginatedQuery)
export class GetDebtsPaginatedHandler implements IQueryHandler<GetDebtsPaginatedQuery> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
  ) {}

  async execute(query: GetDebtsPaginatedQuery) {
    const result = await this.debtRepository.getPaginated(query.userId, {
      pageSize: query.pageSize,
      cursorPersonName: query.cursorPersonName,
      cursorDebtType: query.cursorDebtType,
      cursorCreatedAt: query.cursorCreatedAt,
      status: query.status,
      currency: query.currency,
      personName: query.personName,
    });

    return {
      groups: result.groups.map((group) => ({
        personName: group.personName,
        debtType: group.debtType,
        debts: DebtResponseMapper.toResponseList(group.debts),
      })),
      totalSummary: result.totalSummary,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      totalDebtsCount: result.totalDebtsCount,
    };
  }
}
```

- [ ] **Step 2: Export from queries index**

In `backend/src/modules/debt/application/queries/index.ts`, add:

```typescript
import { GetDebtsPaginatedHandler } from './get-debts-paginated/get-debts-paginated.handler';

// Add to QueryHandlers array:
export const QueryHandlers = [GetDebtsHandler, GetDebtByIdHandler, GetDebtsPaginatedHandler];

// Re-export query class:
export { GetDebtsPaginatedQuery } from './get-debts-paginated/get-debts-paginated.query';
```

- [ ] **Step 3: Verify build**

Run: `cd backend && bun run build`
Expected: No errors

---

### Task 5: Backend — Controller endpoint

**Files:**
- Modify: `backend/src/modules/debt/presentation/controllers/debts.controller.ts`

- [ ] **Step 1: Add paginated endpoint**

Add `Query` to the `@nestjs/common` imports (needed for `@Query()` parameter decorator). Add imports for `GetDebtsPaginatedQuery` and `GetDebtsPaginatedDto`. Then add this method **before** the `@Get(':id')` route (important — otherwise `:id` catches "paginated"):

```typescript
@Get('paginated')
async getPaginated(
  @CurrentUser('sub') userId: string,
  @Query() dto: GetDebtsPaginatedDto,
): Promise<unknown> {
  return this.queryBus.execute(
    new GetDebtsPaginatedQuery(
      userId,
      dto.pageSize,
      dto.cursorPersonName,
      dto.cursorDebtType,
      dto.cursorCreatedAt,
      dto.status,
      dto.currency,
      dto.personName,
    ),
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd backend && bun run build`
Expected: No errors

- [ ] **Step 3: Commit backend changes**

```bash
git add backend/src/modules/debt/
git commit -m "feat(debts): add cursor-based paginated endpoint with server-side grouping and filtering"
```

---

### Task 6: Backend — Test paginated handler

**Files:**
- Create: `backend/src/modules/debt/application/queries/get-debts-paginated/get-debts-paginated.handler.spec.ts`

- [ ] **Step 1: Write test**

```typescript
// backend/src/modules/debt/application/queries/get-debts-paginated/get-debts-paginated.handler.spec.ts
import { GetDebtsPaginatedHandler } from './get-debts-paginated.handler';
import { GetDebtsPaginatedQuery } from './get-debts-paginated.query';
import { IDebtRepository, PaginatedDebtGroups } from '../../../domain/repositories/debt.repository.interface';
import { Debt } from '../../../domain/aggregates/debt/debt.aggregate';

describe('GetDebtsPaginatedHandler', () => {
  let handler: GetDebtsPaginatedHandler;
  let mockRepository: jest.Mocked<IDebtRepository>;

  const mockDebt = {
    id: 'debt-1',
    userId: 'user-1',
    name: 'Test Debt',
    totalAmountValue: 1000,
    remainingAmountValue: 500,
    monthlyPaymentValue: null,
    nextPaymentDate: null,
    debtTypeValue: 'given' as const,
    personName: 'John',
    accountId: null,
    transactionId: null,
    closeTransactionId: null,
    isClosed: false,
    currency: 'USD',
    sourceTransactionId: null,
    createdAt: new Date('2025-01-01'),
    description: null,
    closedAt: null,
    forgivenAmount: 0,
    isPrivate: false,
  };

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByTransactionId: jest.fn(),
      hasOpenDebtsForTransaction: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      getPaginated: jest.fn(),
    };

    handler = new GetDebtsPaginatedHandler(mockRepository);
  });

  it('should return paginated groups', async () => {
    const paginatedResult: PaginatedDebtGroups = {
      groups: [
        {
          personName: 'John',
          debtType: 'given',
          lastDebtDate: new Date('2025-01-01'),
          debts: [mockDebt as unknown as Debt],
        },
      ],
      totalSummary: { totalGiven: { USD: 500 }, totalTaken: {} },
      nextCursor: null,
      hasMore: false,
      totalDebtsCount: 1,
    };

    mockRepository.getPaginated.mockResolvedValue(paginatedResult);

    const query = new GetDebtsPaginatedQuery('user-1', 10);
    const result = await handler.execute(query);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].personName).toBe('John');
    expect(result.groups[0].debtType).toBe('given');
    expect(result.groups[0].debts).toHaveLength(1);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.totalDebtsCount).toBe(1);
    expect(result.totalSummary.totalGiven).toEqual({ USD: 500 });
  });

  it('should pass filters to repository', async () => {
    mockRepository.getPaginated.mockResolvedValue({
      groups: [],
      totalSummary: { totalGiven: {}, totalTaken: {} },
      nextCursor: null,
      hasMore: false,
      totalDebtsCount: 0,
    });

    const query = new GetDebtsPaginatedQuery(
      'user-1', 10, 'John', 'given', '2025-01-01T00:00:00.000Z', 'active', 'USD',
    );
    await handler.execute(query);

    expect(mockRepository.getPaginated).toHaveBeenCalledWith('user-1', {
      pageSize: 10,
      cursorPersonName: 'John',
      cursorDebtType: 'given',
      cursorCreatedAt: '2025-01-01T00:00:00.000Z',
      status: 'active',
      currency: 'USD',
      personName: undefined,
    });
  });
});
```

- [ ] **Step 2: Run test**

Run: `cd backend && bun run test -- --testPathPattern=get-debts-paginated`
Expected: Tests pass

- [ ] **Step 3: Commit test**

```bash
git add backend/src/modules/debt/application/queries/get-debts-paginated/get-debts-paginated.handler.spec.ts
git commit -m "test(debts): add unit tests for GetDebtsPaginatedHandler"
```

---

### Task 7: Frontend — Types for paginated debts

**Files:**
- Modify: `frontend/src/entities/debt/model/types.ts`

- [ ] **Step 1: Add paginated types**

Append to `frontend/src/entities/debt/model/types.ts`:

```typescript
// --- Paginated debts ---

export interface DebtGroupResponse {
  person_name: string;
  debt_type: 'given' | 'taken';
  debts: Debt[];
}

export interface DebtsPaginatedCursor {
  personName: string;
  debtType: string;
  createdAt: string;
}

export interface DebtsFilters {
  status?: 'active' | 'closed';
  currency?: string;
  personName?: string;
}

export interface PaginatedDebtsResult {
  groups: DebtGroupResponse[];
  totalSummary: {
    totalGiven: Record<string, number>;
    totalTaken: Record<string, number>;
  };
  nextCursor: DebtsPaginatedCursor | null;
  hasMore: boolean;
  totalDebtsCount: number;
}
```

---

### Task 8: Frontend — Query keys update

**Files:**
- Modify: `frontend/src/entities/debt/api/queryKeys.ts`

- [ ] **Step 1: Add infinite query keys**

```typescript
import type { DebtsFilters } from '../model/types';
import { cleanUndefined } from '@/shared/lib/utils';

export const debtQueryKeys = {
  all: ['debts'] as const,
  list: (userId: string) => [...debtQueryKeys.all, 'list', userId] as const,
  detail: (debtId: string) => [...debtQueryKeys.all, 'detail', debtId] as const,
  transactions: (debtId: string) => [...debtQueryKeys.all, 'transactions', debtId] as const,
  infinitePrefix: () => [...debtQueryKeys.all, 'infinite'] as const,
  infinite: (userId: string, filters?: DebtsFilters) =>
    [...debtQueryKeys.all, 'infinite', userId, cleanUndefined(filters ?? {})] as const,
};

export type DebtQueryKeys = typeof debtQueryKeys;
```

---

### Task 9: Frontend — API method

**Files:**
- Modify: `frontend/src/entities/debt/api/debtsApi.ts`

- [ ] **Step 1: Add backend response types and getPaginated method**

Add at the top of the file (after DebtResponse interface):

```typescript
interface DebtGroupBackendResponse {
  personName: string;
  debtType: 'given' | 'taken';
  debts: DebtResponse[];
}

interface PaginatedDebtsBackendResponse {
  groups: DebtGroupBackendResponse[];
  totalSummary: {
    totalGiven: Record<string, number>;
    totalTaken: Record<string, number>;
  };
  nextCursor: { personName: string; debtType: string; createdAt: string } | null;
  hasMore: boolean;
  totalDebtsCount: number;
}
```

Add import for types:
```typescript
import type { DebtsPaginatedCursor, DebtsFilters, PaginatedDebtsResult } from '../model/types';
```

Add method to `debtsApi` object:

```typescript
async getPaginated(
  _userId: string,
  pageSize: number = 10,
  cursor?: DebtsPaginatedCursor,
  filters?: DebtsFilters,
): Promise<PaginatedDebtsResult> {
  const params: Record<string, unknown> = { pageSize };
  if (cursor) {
    params.cursorPersonName = cursor.personName;
    params.cursorDebtType = cursor.debtType;
    params.cursorCreatedAt = cursor.createdAt;
  }
  if (filters?.status) params.status = filters.status;
  if (filters?.currency) params.currency = filters.currency;
  if (filters?.personName) params.personName = filters.personName;

  const data = await http.get<PaginatedDebtsBackendResponse>('/debts/paginated', { params });

  return {
    groups: data.groups.map((g) => ({
      person_name: g.personName,
      debt_type: g.debtType,
      debts: g.debts.map(transformDebt),
    })),
    totalSummary: {
      totalGiven: data.totalSummary.totalGiven,
      totalTaken: data.totalSummary.totalTaken,
    },
    nextCursor: data.nextCursor,
    hasMore: data.hasMore,
    totalDebtsCount: data.totalDebtsCount,
  };
},
```

---

### Task 10: Frontend — useInfiniteDebts composable

**Files:**
- Create: `frontend/src/entities/debt/api/useInfiniteDebts.ts`
- Modify: `frontend/src/entities/debt/api/index.ts`

- [ ] **Step 1: Create the composable**

```typescript
// frontend/src/entities/debt/api/useInfiniteDebts.ts
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useInfiniteQuery, useQueryClient, keepPreviousData } from '@tanstack/vue-query';
import { debtQueryKeys } from './queryKeys';
import { debtsApi } from './debtsApi';
import type {
  DebtsFilters,
  DebtsPaginatedCursor,
  PaginatedDebtsResult,
} from '../model/types';

const PAGE_SIZE = 10;

export function useInfiniteDebts(
  userId: MaybeRefOrGetter<string | null>,
  filters?: MaybeRefOrGetter<DebtsFilters | undefined>,
) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const uid = toValue(userId);
    const f = toValue(filters);
    return uid ? debtQueryKeys.infinite(uid, f) : debtQueryKeys.all;
  });

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKey,
    queryFn: async ({ pageParam }): Promise<PaginatedDebtsResult> => {
      const uid = toValue(userId);
      if (!uid)
        return {
          groups: [],
          totalSummary: { totalGiven: {}, totalTaken: {} },
          nextCursor: null,
          hasMore: false,
          totalDebtsCount: 0,
        };

      const f = toValue(filters);
      return debtsApi.getPaginated(uid, PAGE_SIZE, pageParam, f);
    },
    initialPageParam: undefined as DebtsPaginatedCursor | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: computed(() => !!toValue(userId)),
    placeholderData: keepPreviousData,
  });

  const groups = computed(() => data.value?.pages.flatMap((page) => page.groups) ?? []);

  const totalDebtsCount = computed(() => data.value?.pages[0]?.totalDebtsCount ?? 0);

  const totalSummary = computed(
    () =>
      data.value?.pages[0]?.totalSummary ?? {
        totalGiven: {},
        totalTaken: {},
      },
  );

  return {
    groups,
    totalDebtsCount,
    totalSummary,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage: computed(() => hasNextPage.value ?? false),
    isFetchingNextPage: computed(() => isFetchingNextPage.value),
    isFetching: computed(() => isFetching.value),
    refetch,
  };
}
```

- [ ] **Step 2: Export from api/index.ts**

Add `export { useInfiniteDebts } from './useInfiniteDebts';` to `frontend/src/entities/debt/api/index.ts`.

- [ ] **Step 3: Export from entity index**

Ensure `useInfiniteDebts` is accessible from `frontend/src/entities/debt/index.ts` (already exports `* from './api'`).

---

### Task 11: Frontend — Update cache invalidation

**Files:**
- Modify: `frontend/src/shared/api/invalidation.ts`

- [ ] **Step 1: Update invalidateDebtRelated**

Update `invalidateDebtRelated` to also invalidate infinite debt queries:

```typescript
export async function invalidateDebtRelated(
  queryClient: QueryClient,
  userId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: debtQueryKeys.all }),
    invalidateTransactionRelated(queryClient, userId),
    invalidateAccountRelated(queryClient, userId),
  ]);
}
```

This already works because `debtQueryKeys.all` (`['debts']`) is a prefix of `debtQueryKeys.infinite(...)` (`['debts', 'infinite', ...]`). No change needed here — just verify.

---

### Task 12: Frontend — Update useDebtsPageState

**Files:**
- Modify: `frontend/src/pages/debts/list/useDebtsPageState.ts`

- [ ] **Step 1: Switch to useInfiniteDebts for active debts**

Key changes:
- Import `useInfiniteDebts` and types from `@/entities/debt`
- Replace `useDebts(userId)` with `useInfiniteDebts(userId, serverFilters)` for the paginated list
- Keep `useDebts(userId)` for mutations (create/update/delete still need the old composable for optimistic updates) — OR use `invalidateDebtRelated` on mutations
- Compute `serverFilters` from `statusFilter`, `currencyFilter`, and `personFilter`
- Remove in-memory filtering/grouping logic — server now handles it
- Use `totalSummary` from API for summary cards instead of in-memory computation
- Replace `debtsByPerson` computed with `groups` from `useInfiniteDebts`
- Expose `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`

Replace the composable body. Full replacement code:

```typescript
import { ref, computed, watch, toValue } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import {
  useDebts,
  useInfiniteDebts,
  getDebtDisplayName,
  type Debt,
  type DebtsFilters,
  type DebtGroupResponse,
} from '@/entities/debt';
import { useAccounts } from '@/entities/account';
import { useCloseAllDebts, useCloseDebt } from '@/features/close-debt';
import { usePartialPayment } from '@/features/partial-payment';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useExchangeRates } from '@/shared/api';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { navigateBack } from '@/app/router';

const STATUS_TABS = [
  { id: 'active', label: 'Активные' },
  { id: 'closed', label: 'Закрытые' },
];

export function useDebtsPageState() {
  const router = useRouter();
  const route = useRoute();
  const isDesktop = useIsDesktop();
  const { userId } = useCurrentUser();
  const { currency } = useUserCurrency();
  const { convert } = useExchangeRates(currency);
  const { accounts } = useAccounts(userId);

  // Keep useDebts for mutations only (optimistic updates on the "all" cache)
  const { updateDebt } = useDebts(userId);

  // --- Filters ---
  const personFilter = ref<string | null>(route.query.person as string | null);
  const typeFilter = ref<'given' | 'taken' | null>(route.query.type as 'given' | 'taken' | null);
  const currencyFilter = ref<string | null>(null);
  const statusFilter = ref<'active' | 'closed'>('active');

  watch(statusFilter, () => {
    currencyFilter.value = null;
  });

  watch(
    () => route.query,
    (newQuery) => {
      personFilter.value = newQuery.person as string | null;
      typeFilter.value = newQuery.type as 'given' | 'taken' | null;
    },
  );

  // Server-side filters
  const serverFilters = computed<DebtsFilters>(() => ({
    status: statusFilter.value,
    ...(currencyFilter.value ? { currency: currencyFilter.value } : {}),
    ...(personFilter.value ? { personName: personFilter.value } : {}),
  }));

  // Paginated query
  const {
    groups,
    totalDebtsCount,
    totalSummary,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteDebts(userId, serverFilters);

  // --- Totals from server summary ---
  const totalGivenDebts = computed(() => {
    const given = totalSummary.value.totalGiven;
    return Object.entries(given).reduce(
      (sum, [cur, amount]) => sum + convert(amount, cur),
      0,
    );
  });

  const totalTakenDebts = computed(() => {
    const taken = totalSummary.value.totalTaken;
    return Object.entries(taken).reduce(
      (sum, [cur, amount]) => sum + convert(amount, cur),
      0,
    );
  });

  // Flatten all debts from groups (for count checks, closed tab, etc.)
  const allDebtsFromGroups = computed(() => groups.value.flatMap((g) => g.debts));

  // Filter groups by typeFilter (person page filter)
  const filteredGroups = computed(() => {
    if (!typeFilter.value) return groups.value;
    return groups.value.filter((g) => g.debt_type === typeFilter.value);
  });

  // Available currencies (from loaded groups only — approximate)
  const availableCurrencies = computed(() =>
    Array.from(new Set(allDebtsFromGroups.value.map((d) => d.currency))).sort(),
  );

  function isGroupDefaultOpen(group: DebtGroupResponse): boolean {
    return personFilter.value === group.person_name;
  }

  // --- Selected debt (desktop detail panel) ---
  const selectedDebtId = ref<string | null>(null);
  const selectedDebt = computed<Debt | null>(() => {
    if (!selectedDebtId.value) return null;
    return allDebtsFromGroups.value.find((d) => d.id === selectedDebtId.value) ?? null;
  });
  const selectedDebtCurrency = computed(() => selectedDebt.value?.currency || DEFAULT_CURRENCY);

  // --- Navigation ---
  function goBack() {
    navigateBack();
  }

  function handleDebtClick(debt: Debt) {
    if (isDesktop.value) {
      selectedDebtId.value = debt.id;
    } else {
      router.push({ name: ROUTE_NAMES.DEBT_DETAIL, params: { id: debt.id } });
    }
  }

  const showCreateDrawer = ref(false);

  function handleAddDebt() {
    showCreateDrawer.value = true;
  }

  function clearFilter() {
    personFilter.value = null;
    typeFilter.value = null;
    router.replace({ path: '/debts' });
  }

  // --- Close all debts ---
  const { isClosing, progress, total, closeAllDebts } = useCloseAllDebts();
  const showCloseAllModal = ref(false);
  const closeAllPersonName = ref<string | null>(null);

  const closeAllDebtsForPerson = computed(() => {
    if (!closeAllPersonName.value) return allDebtsFromGroups.value;
    return allDebtsFromGroups.value.filter(
      (d) => getDebtDisplayName(d) === closeAllPersonName.value,
    );
  });

  function openCloseAllForPerson(personName: string) {
    closeAllPersonName.value = personName;
    showCloseAllModal.value = true;
  }

  async function handleCloseAll(
    accountId: string,
    options: { paymentAmount: number; forgiveRemainder?: boolean; excessCategoryId?: string },
  ) {
    if (!userId.value) return;
    const success = await closeAllDebts(
      closeAllDebtsForPerson.value,
      accountId,
      userId.value,
      options,
    );
    if (success) {
      showCloseAllModal.value = false;
      closeAllPersonName.value = null;
      clearFilter();
    }
  }

  // --- Detail panel actions ---
  const showDeleteModal = ref(false);
  const showPartialPaymentModal = ref(false);
  const { isDeleting, deleteDebt } = useCloseDebt();
  const { isPaying, makePartialPayment } = usePartialPayment();

  function handleDetailPayment() {
    showPartialPaymentModal.value = true;
  }

  function handleDetailEdit() {
    if (selectedDebtId.value) {
      router.push({ name: ROUTE_NAMES.DEBT_DETAIL, params: { id: selectedDebtId.value } });
    }
  }

  function handleDetailDelete() {
    showDeleteModal.value = true;
  }

  async function handleDeleteDebt() {
    if (!selectedDebt.value || !userId.value) return;
    const success = await deleteDebt(selectedDebt.value, userId.value);
    if (success) {
      showDeleteModal.value = false;
      selectedDebtId.value = null;
    }
  }

  async function handlePartialPayment(
    amount: number,
    accountId: string,
    options: { forgiveRemainder?: boolean; excessCategoryId?: string } = {},
  ) {
    if (!selectedDebt.value || !userId.value) return;
    const willClose = amount >= selectedDebt.value.remaining_amount || options.forgiveRemainder;
    const success = await makePartialPayment(
      selectedDebt.value,
      amount,
      accountId,
      userId.value,
      options,
    );
    if (success) {
      showPartialPaymentModal.value = false;
      if (willClose) {
        selectedDebtId.value = null;
      }
    }
  }

  async function handleDetailTogglePrivate(value: boolean) {
    if (!selectedDebt.value) return;
    await updateDebt(selectedDebt.value.id, { is_private: value });
  }

  function handleDetailClose() {
    selectedDebtId.value = null;
  }

  async function handleRefresh() {
    await refetch();
  }

  return {
    // State
    userId,
    currency,
    isLoading,
    isDesktop,
    statusFilter,
    statusTabs: STATUS_TABS,
    personFilter,
    currencyFilter,
    availableCurrencies,
    selectedDebtId,
    selectedDebt,
    selectedDebtCurrency,

    // Debt data
    groups: filteredGroups,
    allDebtsFromGroups,
    totalGivenDebts,
    totalTakenDebts,
    totalDebtsCount,

    // Pagination
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,

    // Close all
    showCloseAllModal,
    closeAllPersonName,
    closeAllDebtsForPerson,
    isClosing,
    progress,
    total,
    accounts,

    // Create drawer
    showCreateDrawer,

    // Detail panel modals
    showDeleteModal,
    showPartialPaymentModal,
    isDeleting,
    isPaying,

    // Functions
    goBack,
    handleDebtClick,
    handleAddDebt,
    clearFilter,
    isGroupDefaultOpen,
    openCloseAllForPerson,
    handleCloseAll,
    handleDetailPayment,
    handleDetailEdit,
    handleDetailDelete,
    handleDeleteDebt,
    handlePartialPayment,
    handleDetailTogglePrivate,
    handleDetailClose,
    handleRefresh,
  };
}
```

Note: Removed `PersonGroup` interface, `closedDebts` / `closedCurrencyItems` — closed debts now come from the same paginated query with `status: 'closed'` filter. Removed `debtsByPerson` — replaced by `groups` from server. Removed `baseActiveDebts`, `baseClosedDebts` — server handles all filtering.

---

### Task 13: Frontend — Update DebtsListPage template

**Files:**
- Modify: `frontend/src/pages/debts/list/DebtsListPage.vue`

Key changes:
1. Replace `debtsByPerson` with `groups` (now `DebtGroupResponse[]` from server)
2. Replace `activeDebts`/`closedDebts` with `allDebtsFromGroups`
3. Add `IntersectionObserver` sentinel at bottom of list
4. Remove separate closed debts section — unified via server filter
5. Use `useIntersectionObserver` from VueUse for the sentinel
6. Update group rendering — use `group.personName` and `group.debtType` directly
7. Remove `activeCurrencyItems`/`closedCurrencyItems` — use single `availableCurrencies`

- [ ] **Step 1: Update script setup**

Add imports:
```typescript
import { useIntersectionObserver } from '@vueuse/core';
```

Add `USpinner` to the `@/shared/ui` import (for the loading indicator).

Add sentinel ref and observer:
```typescript
const sentinelRef = ref<HTMLElement | null>(null);

useIntersectionObserver(
  sentinelRef,
  ([{ isIntersecting }]) => {
    if (isIntersecting && hasNextPage.value && !isFetchingNextPage.value) {
      fetchNextPage();
    }
  },
  { rootMargin: '200px' },
);
```

Add these to destructured values from `useDebtsPageState`:
```
groups, allDebtsFromGroups, totalDebtsCount,
fetchNextPage, hasNextPage, isFetchingNextPage,
```

Remove from destructured:
```
activeDebts, closedDebts, debtsByPerson,
availableClosedCurrencies, activeCurrencyItems, closedCurrencyItems,
```

- [ ] **Step 2: Update template**

Replace the active debts groups iteration. Change:
- `v-for="group in debtsByPerson"` → `v-for="group in groups"`
- `group.debts[0]` access stays the same (group structure is similar)
- `group.personName` → `group.person_name`
- `group.debtType` → `group.debt_type`
- Remove `group.totalRemainingDisplay` usage — compute inline: `group.debts.reduce((s, d) => s + d.remaining_amount, 0)` with currency from first debt
- Remove `group.hasPrivate` — compute inline: `group.debts.some((d) => d.is_private)`
- `activeDebts.length` → `allDebtsFromGroups.length` (or `totalDebtsCount`)

For summary cards: `totalGivenDebts` and `totalTakenDebts` stay the same (now computed from server summary).

For currency chips: use `availableCurrencies` for both active and closed (server already filters by status).

For closed debts tab: same list rendering pattern using `groups` (server returns closed groups when `status: 'closed'`).

Add sentinel element at the end of the list:
```vue
<!-- Infinite scroll sentinel -->
<div ref="sentinelRef" class="h-1" />

<!-- Loading indicator for next page -->
<div
  v-if="isFetchingNextPage"
  class="flex justify-center py-4"
>
  <USpinner size="sm" />
</div>
```

- [ ] **Step 3: Update group template for new types**

The group template needs adjustments since `PersonGroup` interface is replaced by `DebtGroupResponse`:
- `:key` change: `` `${group.personName}_${group.debtType}` `` → `` `${group.person_name}_${group.debt_type}` ``
- `group.personName` → `group.person_name`
- `group.debtType` → `group.debt_type`
- `group.totalRemainingDisplay` → compute inline: `group.debts.reduce((s, d) => s + d.remaining_amount, 0)` with currency from first debt
- `group.hasPrivate` → `group.debts.some((d) => d.is_private)`
- `DEBT_DIRECTION_DISPLAY[group.debtType]` → `DEBT_DIRECTION_DISPLAY[group.debt_type]`

- [ ] **Step 4: Verify frontend build**

Run: `cd frontend && bun run build`
Expected: No errors

- [ ] **Step 5: Commit frontend changes**

```bash
git add frontend/src/entities/debt/ frontend/src/pages/debts/list/ frontend/src/shared/api/invalidation.ts
git commit -m "feat(debts): add infinite scroll with cursor-based pagination and server-side filtering"
```

---

### Task 14: Frontend — Update exports and verify

**Files:**
- Verify: `frontend/src/entities/debt/index.ts`

- [ ] **Step 1: Ensure all new types are exported**

The entity index already has `export * from './model/types'` and `export * from './api'`, so `useInfiniteDebts`, `DebtGroupResponse`, `DebtsFilters`, `DebtsPaginatedCursor`, `PaginatedDebtsResult` should all be accessible.

- [ ] **Step 2: Full build verification**

Run: `cd frontend && bun run build`
Expected: No errors

Run: `cd backend && bun run build`
Expected: No errors

- [ ] **Step 3: Final commit if any remaining changes**

```bash
git add -A
git commit -m "feat(debts): finalize cursor-based pagination implementation"
```
