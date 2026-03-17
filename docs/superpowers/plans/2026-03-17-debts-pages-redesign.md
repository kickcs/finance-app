# Debts Pages Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign debts pages with tree grouping by person, payment timeline, closed debt cards with metadata, shared detail component, and currency fixes.

**Architecture:** Backend adds 3 columns (description, closed_at, forgiven_amount) to debts table + debtId filter on transactions. Frontend replaces flat list with Reka UI Tree, extracts shared DebtDetailContent, adds payment timeline from transactions, fixes currency handling.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Vue 3, Reka UI (TreeRoot/TreeItem), TanStack Vue Query, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-17-debts-pages-redesign.md`

---

## Chunk 1: Backend — Migration and Domain Model

### Task 1: Database migration — add description, closed_at, forgiven_amount

**Files:**
- Create: `backend/src/database/migrations/<timestamp>-AddDebtMetadata.ts`

- [ ] **Step 1: Generate migration**

```bash
cd backend && bun run migration:generate src/database/migrations/AddDebtMetadata
```

If the auto-generated migration is empty (no entity changes yet), create it manually:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDebtMetadata1773750000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "debts" ADD COLUMN "description" varchar NULL`);
    await queryRunner.query(`ALTER TABLE "debts" ADD COLUMN "closed_at" timestamp NULL`);
    await queryRunner.query(
      `ALTER TABLE "debts" ADD COLUMN "forgiven_amount" decimal(18,2) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "debts" DROP COLUMN "forgiven_amount"`);
    await queryRunner.query(`ALTER TABLE "debts" DROP COLUMN "closed_at"`);
    await queryRunner.query(`ALTER TABLE "debts" DROP COLUMN "description"`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/database/migrations/
git commit -m "feat(backend): add description, closed_at, forgiven_amount to debts table"
```

### Task 2: Update ORM entity

**Files:**
- Modify: `backend/src/modules/debt/infrastructure/persistence/typeorm/debt.orm-entity.ts`

- [ ] **Step 1: Add 3 new columns after `sourceTransactionId`**

```typescript
@Column({ type: 'varchar', nullable: true })
description: string | null;

@Column({ name: 'closed_at', type: 'timestamp', nullable: true })
closedAt: Date | null;

@Column({ name: 'forgiven_amount', type: 'decimal', precision: 18, scale: 2, default: 0 })
forgivenAmount: number;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/debt/
git commit -m "feat(backend): add description, closed_at, forgiven_amount to DebtOrmEntity"
```

### Task 3: Update domain aggregate

**Files:**
- Modify: `backend/src/modules/debt/domain/aggregates/debt/debt.aggregate.ts`

The aggregate uses private fields (`this._name`, `this._userId`, etc.) and a `DebtProps` interface for the constructor. Follow the same pattern.

- [ ] **Step 1: Add to DebtProps interface (line 6-22)**

```typescript
description: string | null;
closedAt: Date | null;
forgivenAmount: number;
```

- [ ] **Step 2: Add private fields (after line 38)**

```typescript
private _description: string | null;
private _closedAt: Date | null;
private _forgivenAmount: number;
```

- [ ] **Step 3: Assign in constructor (after line 55)**

```typescript
this._description = props.description;
this._closedAt = props.closedAt;
this._forgivenAmount = props.forgivenAmount;
```

- [ ] **Step 4: Add getters (after line 165)**

```typescript
get description(): string | null {
  return this._description;
}
get closedAt(): Date | null {
  return this._closedAt;
}
get forgivenAmount(): number {
  return this._forgivenAmount;
}
```

- [ ] **Step 5: Update `create()` static factory (line 58-102)**

Add `description?: string` parameter after `createdAt?`. Add to props object:

```typescript
description: description?.trim() || null,
closedAt: null,
forgivenAmount: 0,
```

- [ ] **Step 6: Update `close()` method (line 187-193)**

```typescript
close(): void {
  if (!this._isClosed) {
    this._isClosed = true;
    this._closedAt = new Date();
    this._remainingAmount = Money.zero(this.currency);
    this.addDomainEvent(new DebtClosedEvent(this.id, this._userId));
  }
}
```

- [ ] **Step 7: Add `setForgivenAmount()` method**

```typescript
setForgivenAmount(amount: number): void {
  this._forgivenAmount = amount;
}
```

- [ ] **Step 8: Update `update()` method data type (line 195-228)**

Add to the `data` parameter type:

```typescript
description?: string | null;
forgivenAmount?: number;
```

Add to the method body:

```typescript
if (data.description !== undefined) this._description = data.description;
if (data.forgivenAmount !== undefined) this._forgivenAmount = data.forgivenAmount;
```

Note: `closedAt` is NOT in the update data — it's set automatically by `close()` when `isClosed` becomes true.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/debt/
git commit -m "feat(backend): add description, closedAt, forgivenAmount to Debt aggregate"
```

### Task 4: Update mapper

**Files:**
- Modify: `backend/src/modules/debt/infrastructure/persistence/mappers/debt.mapper.ts`

- [ ] **Step 1: Add new fields to `toDomain()`**

Map `orm.description`, `orm.closedAt`, `orm.forgivenAmount` (parse as Number) in the `toDomain` method.

- [ ] **Step 2: Add new fields to `toOrm()`**

Map `domain.description`, `domain.closedAt`, `domain.forgivenAmount` in the `toOrm` method.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/debt/
git commit -m "feat(backend): map new debt fields in DebtMapper"
```

### Task 5: Update DTOs, response mapper, and UpdateDebtCommand

**Files:**
- Modify: `backend/src/modules/debt/presentation/dto/create-debt.dto.ts`
- Modify: `backend/src/modules/debt/presentation/dto/update-debt.dto.ts`
- Modify: `backend/src/modules/debt/application/mappers/debt-response.mapper.ts`
- Modify: `backend/src/modules/debt/application/commands/update-debt/update-debt.command.ts`

- [ ] **Step 1: Add `description` to CreateDebtDto**

```typescript
@IsOptional()
@IsString()
description?: string;
```

- [ ] **Step 2: Add `description`, `forgivenAmount` to UpdateDebtDto**

```typescript
@IsOptional()
@IsString()
description?: string;

@IsOptional()
@IsNumber()
@Min(0)
forgivenAmount?: number;
```

Note: `closedAt` is NOT in UpdateDebtDto — it's set automatically by the domain's `close()` method.

- [ ] **Step 3: Add new fields to `toResponse()` in DebtResponseMapper**

```typescript
description: debt.description,
closedAt: debt.closedAt?.toISOString() ?? null,
forgivenAmount: debt.forgivenAmount,
```

- [ ] **Step 4: Add new fields to UpdateDebtCommand.data type**

In `update-debt.command.ts`, add to the `data` type:

```typescript
description?: string | null;
forgivenAmount?: number;
```

These are passed through to `debt.update()` by the handler at line 28.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/debt/
git commit -m "feat(backend): add new fields to debt DTOs and response mapper"
```

### Task 6: Update create-debt command to accept description

**Files:**
- Modify: `backend/src/modules/debt/application/commands/create-debt/create-debt.command.ts`
- Modify: `backend/src/modules/debt/application/commands/create-debt/create-debt.handler.ts`
- Modify: `backend/src/modules/debt/presentation/controllers/debts.controller.ts`

- [ ] **Step 1: Add `description` param to CreateDebtCommand constructor**

- [ ] **Step 2: Pass `description` in the handler's `Debt.create()` call**

- [ ] **Step 3: Pass `dto.description` from controller to CreateDebtCommand**

- [ ] **Step 4: Verify build**

```bash
cd backend && bun run build
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/debt/
git commit -m "feat(backend): pass description through debt creation flow"
```

### Task 7: Add debtId filter to transactions endpoint

The filter flows through: PaginationDto → Controller → Query → Handler → Repository.

**Files:**
- Modify: `backend/src/modules/accounting/presentation/dto/pagination.dto.ts`
- Modify: `backend/src/modules/accounting/presentation/controllers/transactions.controller.ts`
- Modify: `backend/src/modules/accounting/application/queries/get-transactions-paginated/get-transactions-paginated.query.ts`
- Modify: `backend/src/modules/accounting/application/queries/get-transactions-paginated/get-transactions-paginated.handler.ts`
- Modify: `backend/src/modules/accounting/domain/repositories/transaction.repository.interface.ts`
- Modify: `backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts`

- [ ] **Step 1: Add `debtId` to PaginationDto**

```typescript
@IsOptional()
@IsUUID()
debtId?: string;
```

- [ ] **Step 2: Pass `pagination.debtId` from controller to query**

In the `findAll` method, add `pagination.debtId` as a new parameter to `GetTransactionsPaginatedQuery`.

- [ ] **Step 3: Add `debtId` param to GetTransactionsPaginatedQuery constructor**

```typescript
public readonly debtId?: string,
```

- [ ] **Step 4: Pass `query.debtId` from handler to repository**

In the handler's `execute` method, add `debtId: query.debtId` to the options passed to `getPaginated`.

- [ ] **Step 5: Add `debtId` to PaginationOptions interface**

```typescript
debtId?: string;
```

- [ ] **Step 6: Add `debtId` filter in repository's `getPaginated` method**

After the `search` filter (around line 227), add:

```typescript
if (options.debtId) {
  query = query.andWhere('t.debt_id = :debtId', { debtId: options.debtId });
}
```

- [ ] **Step 7: Verify build**

```bash
cd backend && bun run build
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/accounting/
git commit -m "feat(backend): add debtId filter to transactions endpoint"
```

---

## Chunk 2: Frontend — Types, API Layer, and Entity Fixes

### Task 8: Update frontend Debt types

**Files:**
- Modify: `frontend/src/shared/api/database.types.ts`

- [ ] **Step 1: Add new fields to Debt Row type (after `source_transaction_id`)**

```typescript
description: string | null;
closed_at: string | null;
forgiven_amount: number;
```

- [ ] **Step 2: Add new fields to Debt Insert type (optional)**

```typescript
description?: string | null;
closed_at?: string | null;
forgiven_amount?: number;
```

- [ ] **Step 3: Add new fields to Debt Update type (optional)**

```typescript
description?: string | null;
closed_at?: string | null;
forgiven_amount?: number;
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/api/database.types.ts
git commit -m "feat(frontend): add description, closed_at, forgiven_amount to Debt types"
```

### Task 9: Update debtsApi.ts

**Files:**
- Modify: `frontend/src/entities/debt/api/debtsApi.ts`

- [ ] **Step 1: Add new fields to DebtResponse interface**

```typescript
description: string | null;
closedAt: string | null;
forgivenAmount: number;
```

- [ ] **Step 2: Add new fields to transformDebt()**

```typescript
description: debt.description,
closed_at: debt.closedAt,
forgiven_amount: debt.forgivenAmount,
```

- [ ] **Step 3: Fix create() method — remove `?? 'UZS'` and add description**

Change `currency: debt.currency ?? 'UZS'` to `currency: debt.currency`.
Add `description: debt.description` to the POST body.

- [ ] **Step 4: Add new fields to update() method body**

```typescript
description: updates.description,
forgivenAmount: updates.forgiven_amount,
```

Note: `closed_at` is NOT sent in updates — the backend's `close()` method sets `closedAt` automatically when `isClosed` becomes true.

- [ ] **Step 5: Add getDebtTransactions() method**

```typescript
async getDebtTransactions(debtId: string): Promise<Transaction[]> {
  const response = await http.get<{
    data: TransactionResponse[];
    nextCursor: PaginatedCursor | null;
    hasMore: boolean;
  }>('/transactions', {
    params: { debtId, pageSize: 100 },
  });
  return response.data.map(transformTransaction);
},
```

Note: This requires importing `Transaction` type and creating a `TransactionResponse` interface + `transformTransaction` function. Instead, use `transactionsApi` from the transaction entity — add a new method there.

Actually, better approach: add the method to `transactionsApi.ts` instead:

**Files:**
- Modify: `frontend/src/entities/transaction/api/transactionsApi.ts`

Add after `countByAccount`:

```typescript
async getByDebtId(debtId: string): Promise<Transaction[]> {
  const response = await http.get<{
    data: TransactionResponse[];
    nextCursor: PaginatedCursor | null;
    hasMore: boolean;
  }>('/transactions', {
    params: { debtId, pageSize: 100 },
  });
  return response.data.map(transformTransaction);
},
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/entities/debt/api/debtsApi.ts frontend/src/entities/transaction/api/transactionsApi.ts
git commit -m "feat(frontend): update debtsApi for new fields, add getByDebtId to transactionsApi"
```

### Task 10: Create useDebtTransactions composable

**Files:**
- Create: `frontend/src/entities/debt/api/useDebtTransactions.ts`
- Modify: `frontend/src/entities/debt/api/index.ts`
- Modify: `frontend/src/entities/debt/api/queryKeys.ts`

- [ ] **Step 1: Add transactions query key to queryKeys.ts**

```typescript
transactions: (debtId: string) => [...debtQueryKeys.all, 'transactions', debtId] as const,
```

- [ ] **Step 2: Create useDebtTransactions.ts**

```typescript
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { debtQueryKeys } from './queryKeys';
import { transactionsApi } from '@/entities/transaction';

export function useDebtTransactions(debtId: MaybeRefOrGetter<string | null>) {
  const id = computed(() => toValue(debtId));

  const { data, isLoading } = useQuery({
    queryKey: computed(() => (id.value ? debtQueryKeys.transactions(id.value) : debtQueryKeys.all)),
    queryFn: () => {
      if (!id.value) return [];
      return transactionsApi.getByDebtId(id.value);
    },
    enabled: computed(() => !!id.value),
  });

  const transactions = computed(() => {
    const items = data.value ?? [];
    return [...items].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  });

  return { transactions, isLoading };
}
```

- [ ] **Step 3: Export from api/index.ts**

Add `export { useDebtTransactions } from './useDebtTransactions';`

- [ ] **Step 4: Export from entities/debt/index.ts**

The api barrel re-exports via `export * from './api'`, so it's already available.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/entities/debt/api/
git commit -m "feat(frontend): add useDebtTransactions composable"
```

### Task 11: Clean up useDebts.ts — remove broken currency computeds

**Files:**
- Modify: `frontend/src/entities/debt/api/useDebts.ts`
- Modify: `frontend/src/entities/debt/model/types.ts`

- [ ] **Step 1: Remove `debtsByPerson`, `totalDebt`, `totalPaid`, `overallProgress` computeds**

Remove lines 116-150 (the computed values section) and their return values from the return object.

- [ ] **Step 2: Remove import of DebtsByPerson type**

Remove `import type { DebtsByPerson } from '../model/types';`

Keep the `DebtsByPerson` interface export in `types.ts` — other consumers (DebtsSection widget) may reference it.

- [ ] **Step 3: Update return object**

Remove `totalDebt`, `totalPaid`, `overallProgress`, `debtsByPerson` from return.

- [ ] **Step 4: Fix DEBT_DIRECTION_COLORS to match design tokens**

In `frontend/src/entities/debt/model/types.ts`, update:

```typescript
export const DEBT_DIRECTION_COLORS: Record<DebtDirection, string> = {
  given: '#f59e0b', // --color-debt-given (amber)
  taken: '#a855f7', // --color-debt-received (purple) — was #8b5cf6, now matches token
};
```

- [ ] **Step 5: Verify frontend still builds**

```bash
cd frontend && bun run build
```

Note: This will break DebtsListPage which imports `debtsByPerson` from `useDebts`. That's expected — it gets fixed in Chunk 4 (Task 16). DebtsSection computes its own `debtsByPerson` locally and will NOT break.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/entities/debt/
git commit -m "refactor(frontend): remove broken currency computeds from useDebts, fix DEBT_DIRECTION_COLORS"
```

### Task 12: Fix DebtCard — remove dead code, fix hardcoded colors

**Files:**
- Modify: `frontend/src/entities/debt/ui/DebtCard.vue`

- [ ] **Step 1: Remove unused `_paid` computed (line 29-31)**

- [ ] **Step 2: Replace hardcoded `#ef4444` with CSS approach**

Change the icon container style from:
```vue
:style="{ backgroundColor: `${isOverdue ? '#ef4444' : debtColor}15` }"
```
to using Tailwind classes:
```vue
:class="isOverdue ? 'bg-danger/10' : ''"
:style="!isOverdue ? { backgroundColor: `${debtColor}15` } : undefined"
```

And the icon style from:
```vue
:style="{ color: isOverdue ? '#ef4444' : debtColor }"
```
to:
```vue
:class="isOverdue ? 'text-danger' : ''"
:style="!isOverdue ? { color: debtColor } : undefined"
```

- [ ] **Step 3: Similarly fix progress bar color**

The `UProgressBar` at line 119-125:
```vue
:color="isOverdue ? '#ef4444' : debtColor"
```
Change to use CSS variable:
```vue
:color="isOverdue ? 'var(--color-danger)' : debtColor"
```

- [ ] **Step 4: Add CurrencyBadge for non-user-currency debts**

Add a `userCurrency` prop (optional string). When provided and `debt.currency !== userCurrency`, show `CurrencyBadge` next to the amount:

```vue
<CurrencyBadge v-if="userCurrency && debtCurrency !== userCurrency" :currency="debtCurrency" />
```

Import `CurrencyBadge` from `@/entities/currency` (or `@/shared/ui` if it exists there).

- [ ] **Step 5: Add overdue card styling**

When `isOverdue` is true and not closed, add visual emphasis to the card's container:

```vue
:class="[
  // existing classes...
  isOverdue && !debt.is_closed && 'bg-danger/[0.03] !border-danger/15',
]"
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/entities/debt/ui/DebtCard.vue
git commit -m "fix(frontend): remove dead code, fix colors, add CurrencyBadge and overdue styling to DebtCard"
```

### Task 12b: Update useCreateDebt to pass description to debt

**Files:**
- Modify: `frontend/src/features/create-debt/model/useCreateDebt.ts`

- [ ] **Step 1: Add `description` to debtsApi.create() call (line 92-103)**

Currently `formData.value.description` is only passed to the transaction. Add it to the debt creation too:

```typescript
const debt = await debtsApi.create({
  user_id: userId,
  name: debtName,
  total_amount: formData.value.amount,
  remaining_amount: formData.value.amount,
  debt_type: formData.value.debt_type,
  person_name: formData.value.person_name,
  account_id: accountId,
  transaction_id: transactionId,
  is_closed: false,
  currency: currency,
  description: formData.value.description || null,  // NEW
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/create-debt/
git commit -m "feat(frontend): pass description to debt creation"
```

---

## Chunk 3: Frontend — New UI Components

### Task 13: Create DebtPaymentTimeline component

**Files:**
- Create: `frontend/src/entities/debt/ui/DebtPaymentTimeline.vue`

- [ ] **Step 1: Create the component**

Props: `debt: Debt`, `transactions: Transaction[]`, `isLoading: boolean`

The component renders a vertical timeline:
- First node (indigo): "Долг создан" — `debt.created_at` + `debt.total_amount` in `debt.currency`
- Payment nodes (green): each transaction with `debt_id` — amount + description + date. Get account name from description text.
- Forgiveness node (amber, if `debt.forgiven_amount > 0`): "Прощено" — forgiven amount
- Final node: if `debt.is_closed` → "Погашен" (green check); else → "Осталось {remaining}" (outlined dot in debt color)
- Show Skeleton placeholders while `isLoading`

Use design tokens: `text-primary` for created, `text-success` for payments, `text-warning` for forgiveness, debt color for remaining.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/entities/debt/ui/DebtPaymentTimeline.vue
git commit -m "feat(frontend): create DebtPaymentTimeline component"
```

### Task 14: Create DebtDetailContent shared component

**Files:**
- Create: `frontend/src/entities/debt/ui/DebtDetailContent.vue`
- Modify: `frontend/src/entities/debt/index.ts`

- [ ] **Step 1: Create the component**

Extract the shared content from DebtDetailPage.vue and DebtDetailPanel.vue into DebtDetailContent.vue.

Props:
```typescript
debt: Debt
transactions: Transaction[]
accounts: AccountWithBalances[]
isLoading: boolean
transactionsLoading: boolean
```

Emits: `payment`, `edit`, `delete`

Sections:
1. Main card — IconBadge, person name, direction label, closed badge, amount, paid, progress bar
2. Description block — shown only if `debt.description` exists
3. Payment timeline — `<DebtPaymentTimeline :debt :transactions :is-loading="transactionsLoading" />`
4. Details card — linked account, due date (with overdue styling), created date. Remove "Тип" and "Валюта" rows.
5. Actions — payment button or delete button

Use `debt.currency` for all `formatCurrency()` calls (not DEFAULT_CURRENCY fallback).

- [ ] **Step 2: Export from entities/debt/index.ts**

Add `export { default as DebtDetailContent } from './ui/DebtDetailContent.vue';`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/entities/debt/
git commit -m "feat(frontend): create shared DebtDetailContent component"
```

### Task 15: Create ClosedDebtCard component

**Files:**
- Create: `frontend/src/entities/debt/ui/ClosedDebtCard.vue`
- Modify: `frontend/src/entities/debt/index.ts`

- [ ] **Step 1: Create the component**

Props: `debt: Debt`, `userCurrency: string`

Card shows:
- Avatar: ✓ icon (green) if fully paid, ♡ icon (amber) if `debt.forgiven_amount > 0`
- Person name + debt type subtitle
- Total amount in `debt.currency`. Show `CurrencyBadge` if currency differs from `userCurrency`.
- "Прощён" badge if `forgiven_amount > 0`
- Mini timeline bar: `debt.created_at` → `debt.closed_at` with filled progress (100% green or amber)
- Summary: "{N} дней" calculated from `created_at` to `closed_at`

Emits: `click`

- [ ] **Step 2: Export from entities/debt/index.ts**

Add `export { default as ClosedDebtCard } from './ui/ClosedDebtCard.vue';`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/entities/debt/
git commit -m "feat(frontend): create ClosedDebtCard component"
```

---

## Chunk 4: Frontend — Page Refactors

### Task 16: Refactor DebtsListPage — Tree view

**Files:**
- Modify: `frontend/src/pages/debts/list/DebtsListPage.vue`

This is the largest change. The page needs to:

- [ ] **Step 1: Replace imports**

Remove: `DebtCard` import for grouped view (keep for tree children), remove `listTransition`.
Add: `TreeRoot, TreeItem` from `reka-ui`, `ClosedDebtCard` from `@/entities/debt`.

- [ ] **Step 2: Build page-level `debtsByPerson` computed with currency conversion**

Since `useDebts` no longer provides `debtsByPerson`, compute it at page level using `useExchangeRates`:

```typescript
interface PersonGroup {
  personName: string;
  debts: Debt[];
  debtType: DebtDirection;
  totalRemaining: number;
  totalRemainingDisplay: { amount: number; currency: string; approximate: boolean };
}

const debtsByPerson = computed<PersonGroup[]>(() => {
  const groups = new Map<string, { debts: Debt[]; debtType: DebtDirection }>();

  for (const debt of activeDebts.value) {
    const personName = (debt.person_name || debt.name).trim();
    const existing = groups.get(personName);
    if (existing) {
      existing.debts.push(debt);
    } else {
      groups.set(personName, { debts: [debt], debtType: debt.debt_type });
    }
  }

  return Array.from(groups.entries()).map(([personName, { debts: personDebts, debtType }]) => {
    const currencies = new Set(personDebts.map((d) => d.currency));
    const isMixed = currencies.size > 1;
    const totalRemaining = personDebts.reduce(
      (sum, d) => sum + convert(d.remaining_amount, d.currency),
      0,
    );
    const displayCurrency = isMixed ? currency.value : personDebts[0].currency;

    return {
      personName,
      debts: personDebts,
      debtType,
      totalRemaining,
      totalRemainingDisplay: {
        amount: isMixed ? totalRemaining : personDebts.reduce((s, d) => s + d.remaining_amount, 0),
        currency: displayCurrency,
        approximate: isMixed,
      },
    };
  });
});
```

- [ ] **Step 3: Build tree items data structure for TreeRoot**

```typescript
const treeItems = computed(() =>
  debtsByPerson.value.map((group) => ({
    ...group,
    children: group.debts,
  })),
);
```

- [ ] **Step 4: Replace template — remove viewMode toggle, add TreeRoot**

Remove the viewMode toggle buttons and grouped/flat conditional rendering.

Replace with TreeRoot + TreeItem:

```vue
<TreeRoot
  v-if="activeDebts.length > 0"
  :items="treeItems"
  :get-key="(item) => item.personName ?? item.id"
  :get-children="(item) => item.children"
  :default-expanded="personFilter ? [personFilter] : []"
  class="space-y-2"
>
  <template #default="{ flattenItems }">
    <div v-for="item in flattenItems" :key="item._id" class="space-y-1">
      <!-- Person node (level 1) -->
      <template v-if="item.level === 1">
        <!-- person header with expand arrow, InitialAvatar, name, count, total -->
      </template>
      <!-- Debt node (level 2) -->
      <template v-else>
        <div class="ml-5 pl-3 border-l-2 border-border-light dark:border-border-dark">
          <DebtCard
            :debt="item.value"
            compact
            @click="handleDebtClick(item.value)"
          />
        </div>
      </template>
    </div>
  </template>
</TreeRoot>
```

- [ ] **Step 5: Replace closed debts section — use ClosedDebtCard**

```vue
<ClosedDebtCard
  v-for="debt in closedDebts"
  :key="debt.id"
  :debt="debt"
  :user-currency="currency"
  @click="handleDebtClick(debt)"
/>
```

- [ ] **Step 6: Fix summary cards — use activeDebts with convert()**

The `totalGivenDebts` and `totalTakenDebts` computeds already use `convert()` — verify they filter from `activeDebts` correctly. No change needed if they already work.

- [ ] **Step 7: Verify the page renders**

```bash
cd frontend && bun run dev
```

Open the app, navigate to /debts, verify the tree renders correctly.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/debts/list/DebtsListPage.vue
git commit -m "feat(frontend): replace flat list with Tree view in DebtsListPage"
```

### Task 17: Refactor DebtDetailPage — use DebtDetailContent

**Files:**
- Modify: `frontend/src/pages/debts/detail/DebtDetailPage.vue`

- [ ] **Step 1: Add useDebtTransactions import and call**

```typescript
import { DebtDetailContent, useDebtTransactions } from '@/entities/debt';

const { transactions, isLoading: transactionsLoading } = useDebtTransactions(debtId);
```

- [ ] **Step 2: Replace template body with DebtDetailContent**

Replace the entire `<div v-else class="space-y-6">` section with:

```vue
<DebtDetailContent
  v-else
  :debt="debt"
  :transactions="transactions"
  :accounts="accounts"
  :is-loading="false"
  :transactions-loading="transactionsLoading"
  @payment="showPartialPaymentModal = true"
  @delete="showDeleteModal = true"
/>
```

- [ ] **Step 3: Remove unused imports**

Remove: `UCard`, `UProgressBar`, `IconBadge`, `UBadge`, `formatDate`, `DEBT_DIRECTION_LABELS`, `DEBT_DIRECTION_COLORS`, `DEFAULT_CURRENCY`.
Remove: `linkedAccount`, `progress` computeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/debts/detail/DebtDetailPage.vue
git commit -m "refactor(frontend): use DebtDetailContent in DebtDetailPage"
```

### Task 18: Refactor DebtDetailPanel — use DebtDetailContent

**Files:**
- Modify: `frontend/src/entities/debt/ui/DebtDetailPanel.vue`

- [ ] **Step 1: Add useDebtTransactions and replace body**

Same pattern as Task 17:

```typescript
import { useDebtTransactions } from '../api/useDebtTransactions';
import DebtDetailContent from './DebtDetailContent.vue';

const { transactions, isLoading: transactionsLoading } = useDebtTransactions(
  computed(() => props.debtId),
);
```

- [ ] **Step 2: Replace template with DebtDetailContent**

```vue
<DebtDetailContent
  v-if="debt"
  :debt="debt"
  :transactions="transactions"
  :accounts="accounts.length > 0 ? accounts : []"
  :is-loading="isLoading"
  :transactions-loading="transactionsLoading"
  @payment="$emit('payment')"
  @edit="$emit('edit')"
  @delete="$emit('delete')"
/>
```

- [ ] **Step 3: Remove duplicate code**

Remove: all the card template code, `linkedAccount` / `progress` / `isOverdue` computeds, unused imports.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/entities/debt/ui/DebtDetailPanel.vue
git commit -m "refactor(frontend): use DebtDetailContent in DebtDetailPanel"
```

---

## Chunk 5: Frontend — Widget Fix, Partial Payment Update, and Build Verification

### Task 19: Fix DebtsSection — use listTransition, fix broken debtsByPerson

**Files:**
- Modify: `frontend/src/widgets/debts-section/ui/DebtsSection.vue`

- [ ] **Step 1: Replace custom CSS transitions with listTransition**

Import `listTransition` from `@/shared/lib/transitions` and use it in the TransitionGroup:

```vue
<TransitionGroup
  tag="div"
  class="space-y-2"
  :enter-active-class="listTransition.enterActiveClass"
  :leave-active-class="listTransition.leaveActiveClass"
  :enter-from-class="listTransition.enterFromClass"
  :leave-to-class="listTransition.leaveToClass"
  :move-class="listTransition.moveClass"
>
```

Remove the `<style scoped>` block with `.debt-list-*` classes.

- [ ] **Step 2: Fix debtsByPerson computation**

The widget has its own `debtsByPerson` computed (lines 54-95) that already uses `convert()` from `useExchangeRates`. This is correct — it doesn't use `useDebts.debtsByPerson`. No fix needed for the data computation.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/widgets/debts-section/
git commit -m "fix(frontend): use listTransition in DebtsSection"
```

### Task 20: Update partial payment flow — set forgiven_amount and closed_at

**Files:**
- Modify: `frontend/src/features/partial-payment/model/usePartialPayment.ts`

- [ ] **Step 1: When closing a debt, include forgiven_amount in the update**

In the debt update section (around line 109), when `willClose` is true, add `forgiven_amount`. Note: `closed_at` is NOT sent — the backend's `close()` method sets it automatically when `isClosed` becomes true.

```typescript
await debtsApi.update(debt.id, {
  remaining_amount: willClose ? 0 : Math.max(0, newRemaining),
  is_closed: !!willClose,
  ...(willClose && closeTransactionId ? { close_transaction_id: closeTransactionId } : {}),
  ...(options?.forgiveRemainder ? {
    forgiven_amount: debt.remaining_amount - actualPayment,
  } : {}),
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/partial-payment/
git commit -m "feat(frontend): set closed_at and forgiven_amount on debt close"
```

### Task 21: Full build verification

- [ ] **Step 1: Build backend**

```bash
cd backend && bun run build
```

Expected: SUCCESS

- [ ] **Step 2: Build frontend**

```bash
cd frontend && bun run build
```

Expected: SUCCESS (type-check + vite build)

- [ ] **Step 3: Fix any build errors**

If there are errors, fix them before proceeding.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build errors from debts redesign"
```

### Task 22: Update tests

**Files:**
- Modify: `frontend/src/pages/debts/list/DebtsListPage.spec.ts`
- Modify: `frontend/src/pages/debts/detail/DebtDetailPage.spec.ts`
- Modify: `frontend/src/test/mocks/handlers/debts.ts`

- [ ] **Step 1: Update mock handlers to include new fields**

In `debts.ts` mock handler, add `description: null`, `closedAt: null`, `forgivenAmount: 0` to mock debt responses.

- [ ] **Step 2: Update DebtsListPage tests**

Remove tests for viewMode toggle. Update tests to work with Tree component structure.

- [ ] **Step 3: Update DebtDetailPage tests**

Mock `useDebtTransactions` composable. Update selectors if needed for DebtDetailContent.

- [ ] **Step 4: Run tests**

```bash
cd frontend && bun run test
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "test(frontend): update debt page tests for redesign"
```
