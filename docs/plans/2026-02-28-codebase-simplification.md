# Codebase Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 11 code quality, reuse, and efficiency issues flagged by full-codebase review.

**Architecture:** Quick wins first (DB indexes, utility extraction, SQL rewrite, caching), then medium-effort refactors (query consolidation, batching, composable extraction), then large refactors (router consistency, domain layer fix, demo data sync).

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Vue 3, TanStack Vue Query, TypeScript

---

### Task 1: Add Missing DB Indexes

**Files:**
- Create: `backend/src/database/migrations/1772300000000-AddMissingIndexes.ts`

**Step 1: Generate migration file**

Run: `cd backend && bun run migration:generate src/database/migrations/AddMissingIndexes`

If that fails (no schema changes detected), create manually:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingIndexes1772300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pg_trgm extension for ILIKE index support
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // Index for transfer lookups (to_account_id)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_to_account_id" ON "transactions" ("to_account_id") WHERE "to_account_id" IS NOT NULL`,
    );

    // Index for debt-transaction lookups
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_debts_source_transaction_id" ON "debts" ("source_transaction_id") WHERE "source_transaction_id" IS NOT NULL`,
    );

    // Trigram index for ILIKE '%term%' search on descriptions
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_description_trgm" ON "transactions" USING gin ("description" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_description_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_debts_source_transaction_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_to_account_id"`);
  }
}
```

**Step 2: Verify migration compiles**

Run: `cd backend && bun run build`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/database/migrations/1772300000000-AddMissingIndexes.ts
git commit -m "perf: add missing DB indexes for to_account_id, source_transaction_id, description trgm"
```

---

### Task 2: Extract Reminder `isUpcoming`/`isOverdue` Utilities

**Files:**
- Create: `frontend/src/entities/reminder/model/utils.ts`
- Modify: `frontend/src/entities/reminder/ui/ReminderCard.vue`
- Modify: `frontend/src/widgets/reminders-section/ui/RemindersSection.vue`
- Modify: `frontend/src/pages/reminders/detail/ReminderDetailPage.vue`
- Modify: `frontend/src/entities/reminder/api/useReminders.ts`

**Step 1: Create utility file**

Create `frontend/src/entities/reminder/model/utils.ts`:

```typescript
export const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function isReminderOverdue(reminder: { next_date: string; is_active: boolean }): boolean {
  return reminder.is_active && new Date(reminder.next_date).getTime() < Date.now();
}

export function isReminderUpcoming(
  reminder: { next_date: string; is_active: boolean },
  windowMs = THREE_DAYS_MS,
): boolean {
  const nextMs = new Date(reminder.next_date).getTime();
  const now = Date.now();
  return reminder.is_active && nextMs >= now && nextMs - now < windowMs;
}
```

**Step 2: Replace in ReminderCard.vue**

Replace lines 26-34 in `ReminderCard.vue`:

```typescript
// Replace:
const isUpcoming = computed(() => {
  const nextDateMs = new Date(props.reminder.next_date).getTime();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  return nextDateMs - Date.now() < threeDays && nextDateMs > Date.now();
});

const isOverdue = computed(() => {
  return new Date(props.reminder.next_date).getTime() < Date.now();
});

// With:
import { isReminderUpcoming, isReminderOverdue } from '@/entities/reminder/model/utils';

const isUpcoming = computed(() => isReminderUpcoming(props.reminder));
const isOverdue = computed(() => isReminderOverdue(props.reminder));
```

**Step 3: Replace in RemindersSection.vue**

Find the inline isUpcoming/isOverdue logic and replace with the utility functions. Same pattern as above.

**Step 4: Replace in ReminderDetailPage.vue**

Same pattern — replace inline logic with imported utilities.

**Step 5: Update useReminders.ts**

Replace lines 120-137:

```typescript
import { isReminderUpcoming, isReminderOverdue, SEVEN_DAYS_MS } from '../model/utils';

const upcomingReminders = computed(() =>
  activeReminders.value.filter((r) => isReminderUpcoming(r, SEVEN_DAYS_MS)),
);

const overdueReminders = computed(() =>
  activeReminders.value.filter((r) => isReminderOverdue(r)),
);
```

**Step 6: Build to verify**

Run: `cd frontend && bun run build`
Expected: No errors

**Step 7: Commit**

```bash
git add frontend/src/entities/reminder/model/utils.ts \
  frontend/src/entities/reminder/ui/ReminderCard.vue \
  frontend/src/widgets/reminders-section/ui/RemindersSection.vue \
  frontend/src/pages/reminders/detail/ReminderDetailPage.vue \
  frontend/src/entities/reminder/api/useReminders.ts
git commit -m "refactor: extract isReminderUpcoming/isReminderOverdue utility functions"
```

---

### Task 3: Rewrite `getHashtags` to Use SQL

**Files:**
- Modify: `backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts` (lines 795-818)

**Step 1: Replace the getHashtags method**

Replace the existing method (lines 795-818) with:

```typescript
async getHashtags(userId: string): Promise<{ tag: string; count: number }[]> {
  const result = await this.ormRepository.query(
    `SELECT sub.tag, COUNT(*)::int as count
     FROM (
       SELECT unnest(regexp_matches(description, '#[^\\s#]+', 'g')) as tag
       FROM transactions
       WHERE user_id = $1 AND description LIKE '%#%'
     ) sub
     GROUP BY sub.tag
     ORDER BY count DESC`,
    [userId],
  );

  return result;
}
```

This replaces JS-side regex parsing with PostgreSQL `regexp_matches`. The pattern `#[^\s#]+` matches `#` followed by non-whitespace/non-hash chars, supporting Unicode (Cyrillic etc.) natively.

**Step 2: Build to verify**

Run: `cd backend && bun run build`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts
git commit -m "perf: rewrite getHashtags to parse hashtags in SQL instead of JS"
```

---

### Task 4: Add Caching to PremiumGuard

**Files:**
- Modify: `backend/src/modules/subscription/guards/premium.guard.ts`

**Step 1: Add in-memory cache with TTL**

Replace the entire file:

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { OnEvent } from '@nestjs/event-emitter';
import { IUserSubscriptionRepository, USER_SUBSCRIPTION_REPOSITORY } from '../domain/repositories';

interface AuthenticatedRequest extends Request {
  user?: { sub: string };
}

interface CacheEntry {
  isPremium: boolean;
  checkedAt: number;
}

@Injectable()
export class PremiumGuard implements CanActivate {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IUserSubscriptionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;
    if (!userId) throw new ForbiddenException('Authentication required');

    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.checkedAt < this.TTL_MS) {
      if (!cached.isPremium) {
        throw new ForbiddenException('Premium subscription required');
      }
      return true;
    }

    const subscription = await this.subscriptionRepository.findByUserId(userId);
    const isPremium = subscription?.isPremium() ?? false;

    this.cache.set(userId, { isPremium, checkedAt: Date.now() });

    if (!isPremium) {
      throw new ForbiddenException('Premium subscription required');
    }

    return true;
  }

  @OnEvent('subscription.changed')
  handleSubscriptionChanged(payload: { userId: string }) {
    this.cache.delete(payload.userId);
  }
}
```

Note: Check if `@nestjs/event-emitter` is already installed and if `subscription.changed` events are emitted from the webhook handler. If not, the `@OnEvent` decorator can be removed and the cache will simply expire after 5 minutes.

**Step 2: Verify event emitter is configured**

Search for `EventEmitterModule` in the backend to confirm it's registered. If not, remove the `@OnEvent` decorator and rely on TTL-based expiry only.

**Step 3: Build and test**

Run: `cd backend && bun run build && bun run test`
Expected: Build succeeds, all tests pass

**Step 4: Commit**

```bash
git add backend/src/modules/subscription/guards/premium.guard.ts
git commit -m "perf: add 5-minute in-memory cache to PremiumGuard"
```

---

### Task 5: Consolidate `getAnalyticsStats` Queries (14 → 3)

**Files:**
- Modify: `backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts` (lines 464-793)

**Step 1: Replace 12 scalar/by-currency queries with single aggregation**

Replace lines 464-660 (the 12 queries) with a single query that groups by `type`, `category_id`, `currency`:

```typescript
async getAnalyticsStats(userId: string, options: AnalyticsOptions): Promise<AnalyticsStats> {
  const { startDate, endDate, accountIds } = options;

  // Single aggregation query for all totals and by-currency breakdowns
  let aggregateQuery = this.ormRepository
    .createQueryBuilder('t')
    .select('t.type', 'type')
    .addSelect('t.category_id', 'categoryId')
    .addSelect('t.currency', 'currency')
    .addSelect('COALESCE(t.is_debt_related, false)', 'isDebtRelated')
    .addSelect('SUM(t.amount)', 'total')
    .where('t.user_id = :userId', { userId })
    .andWhere('t.date >= :startDate', { startDate })
    .andWhere('t.date <= :endDate', { endDate })
    .groupBy('t.type')
    .addGroupBy('t.category_id')
    .addGroupBy('t.currency')
    .addGroupBy('COALESCE(t.is_debt_related, false)');

  if (accountIds && accountIds.length > 0) {
    aggregateQuery = aggregateQuery.andWhere('t.account_id IN (:...accountIds)', { accountIds });
  }

  const rows: Array<{
    type: string;
    categoryId: string;
    currency: string;
    isDebtRelated: boolean;
    total: string;
  }> = await aggregateQuery.getRawMany();

  // Compute all totals from the single result set
  const DEBT_CATEGORY_IDS = ['debt_given', 'debt_taken', 'debt_return_to_me', 'debt_return_from_me'];

  let regularIncome = 0;
  let regularExpense = 0;
  let debtGiven = 0;
  let debtTaken = 0;
  let debtReturnsToMe = 0;
  let debtReturnsFromMe = 0;

  const regularIncomeByCurrency: Record<string, number> = {};
  const regularExpenseByCurrency: Record<string, number> = {};
  const debtGivenByCurrency: Record<string, number> = {};
  const debtTakenByCurrency: Record<string, number> = {};
  const debtReturnsToMeByCurrency: Record<string, number> = {};
  const debtReturnsFromMeByCurrency: Record<string, number> = {};

  for (const row of rows) {
    const amount = parseFloat(row.total) || 0;
    const isDebtRelated = row.isDebtRelated === true || row.isDebtRelated === 'true' as any;

    // Debt-specific categories
    if (row.categoryId === 'debt_given') {
      debtGiven += amount;
      debtGivenByCurrency[row.currency] = (debtGivenByCurrency[row.currency] || 0) + amount;
    } else if (row.categoryId === 'debt_taken') {
      debtTaken += amount;
      debtTakenByCurrency[row.currency] = (debtTakenByCurrency[row.currency] || 0) + amount;
    } else if (row.categoryId === 'debt_return_to_me') {
      debtReturnsToMe += amount;
      debtReturnsToMeByCurrency[row.currency] = (debtReturnsToMeByCurrency[row.currency] || 0) + amount;
    } else if (row.categoryId === 'debt_return_from_me') {
      debtReturnsFromMe += amount;
      debtReturnsFromMeByCurrency[row.currency] = (debtReturnsFromMeByCurrency[row.currency] || 0) + amount;
    } else if (!isDebtRelated && !DEBT_CATEGORY_IDS.includes(row.categoryId)) {
      // Regular (non-debt) income/expense
      if (row.type === 'income') {
        regularIncome += amount;
        regularIncomeByCurrency[row.currency] = (regularIncomeByCurrency[row.currency] || 0) + amount;
      } else if (row.type === 'expense') {
        regularExpense += amount;
        regularExpenseByCurrency[row.currency] = (regularExpenseByCurrency[row.currency] || 0) + amount;
      }
    }
  }

  // ... keep the existing categoryBreakdownResult query (lines ~667-730) and
  // categoryOffsetsQuery (lines ~736-793) as-is — they have different grouping.
  // Copy them here unchanged.
```

This reduces 12 sequential queries to 1 aggregation query. The category breakdown and offset queries (2 more) stay as-is. **14 → 3 total queries.**

**Step 2: Build to verify**

Run: `cd backend && bun run build`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/modules/accounting/infrastructure/persistence/repositories/transaction.repository.ts
git commit -m "perf: consolidate getAnalyticsStats from 14 sequential queries to 3"
```

---

### Task 6: Batch Bulk Import Saves

**Files:**
- Modify: `backend/src/modules/accounting/application/commands/bulk-import/bulk-import.handler.ts` (lines 134-151)

**Step 1: Replace sequential loops with batch operations**

Replace lines 134-151:

```typescript
// Save everything in a single DB transaction
await this.dataSource.transaction(async () => {
  // Batch save new categories
  const newCats = [...categoryMap.values()].filter((cat) =>
    createdCategories.includes(cat.name),
  );
  if (newCats.length > 0) {
    await this.categoryRepository.saveMany(newCats);
  }

  // Batch save accounts
  for (const account of accountsToSave.values()) {
    await this.accountRepository.save(account);
  }

  // Batch save transactions
  for (const transaction of transactionsToSave) {
    await this.transactionRepository.save(transaction);
  }
});
```

Note: Accounts and transactions use domain repositories that go through mappers, so we can't easily batch them at the ORM level. Categories already have `saveMany`. Keep accounts and transactions as sequential saves through the domain layer — the main win here is category batching and the fact that this is already in a DB transaction.

Actually, the bigger optimization requires adding `saveMany` to the account and transaction repositories. Since that's more invasive, keep the existing pattern for now but switch categories to `saveMany`.

**Step 2: Build to verify**

Run: `cd backend && bun run build`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/modules/accounting/application/commands/bulk-import/bulk-import.handler.ts
git commit -m "perf: batch category saves in bulk import handler"
```

---

### Task 7: Extract `useTransactionEditFlow` Composable

**Files:**
- Create: `frontend/src/entities/transaction/model/useTransactionEditFlow.ts`
- Modify: `frontend/src/pages/history/HistoryPage.vue`
- Modify: `frontend/src/pages/accounts/AccountDetailPage.vue`

**Step 1: Create the composable**

Create `frontend/src/entities/transaction/model/useTransactionEditFlow.ts`:

```typescript
import { ref, type MaybeRefOrGetter, toValue } from 'vue';
import type { Transaction } from '../model/types';
import { useTransactionSelection } from './useTransactionSelection';
import { useEditTransaction } from './useEditTransaction';

export function useTransactionEditFlow(userId: MaybeRefOrGetter<string | null>) {
  const showDeleteModal = ref(false);

  const {
    selectedTransaction,
    hasSplitDebts,
    showEditModal,
    select: handleTransactionClick,
    close: closeEditModal,
  } = useTransactionSelection(userId);

  const {
    isUpdating,
    isDeleting,
    error: editError,
    update: updateTransactionFn,
    remove: removeTransactionFn,
  } = useEditTransaction(toValue(userId));

  async function handleUpdateTransaction(updates: Partial<Transaction>) {
    if (!selectedTransaction.value) return;
    const success = await updateTransactionFn(selectedTransaction.value, updates);
    if (success) {
      closeEditModal();
    }
  }

  async function handleDeleteTransaction() {
    if (!selectedTransaction.value) return;
    const success = await removeTransactionFn(selectedTransaction.value);
    if (success) {
      showDeleteModal.value = false;
      closeEditModal();
      selectedTransaction.value = null;
    }
  }

  function handleDeleteClick() {
    closeEditModal();
    showDeleteModal.value = true;
  }

  function handleSwipeDelete(transaction: Transaction) {
    selectedTransaction.value = transaction;
    showDeleteModal.value = true;
  }

  return {
    selectedTransaction,
    hasSplitDebts,
    showEditModal,
    showDeleteModal,
    isUpdating,
    isDeleting,
    editError,
    handleTransactionClick,
    handleUpdateTransaction,
    handleDeleteTransaction,
    handleDeleteClick,
    handleSwipeDelete,
    closeEditModal,
  };
}
```

**Step 2: Check if useTransactionSelection and useEditTransaction exist in the right location**

Grep for these to find their imports and adjust the composable's imports accordingly.

**Step 3: Refactor HistoryPage.vue**

Replace lines 124-179 with:

```typescript
import { useTransactionEditFlow } from '@/entities/transaction';

const {
  selectedTransaction,
  hasSplitDebts,
  showEditModal,
  showDeleteModal,
  isUpdating,
  isDeleting,
  handleTransactionClick,
  handleUpdateTransaction,
  handleDeleteTransaction,
  handleDeleteClick,
  handleSwipeDelete,
} = useTransactionEditFlow(userId);
```

**Step 4: Refactor AccountDetailPage.vue**

Replace lines 133-174 with the same composable call. Rename returned values to match existing template bindings (e.g., `showEditModal` → `showEditTransactionModal` via destructuring rename).

```typescript
const {
  selectedTransaction,
  hasSplitDebts,
  showEditModal: showEditTransactionModal,
  showDeleteModal: showDeleteTransactionModal,
  isUpdating: isUpdatingTransaction,
  isDeleting: isDeletingTransaction,
  editError: transactionError,
  handleTransactionClick,
  handleUpdateTransaction,
  handleDeleteClick: handleDeleteTransactionClick,
  handleDeleteTransaction,
} = useTransactionEditFlow(userId);
```

**Step 5: Build to verify**

Run: `cd frontend && bun run build`
Expected: No errors

**Step 6: Commit**

```bash
git add frontend/src/entities/transaction/model/useTransactionEditFlow.ts \
  frontend/src/pages/history/HistoryPage.vue \
  frontend/src/pages/accounts/AccountDetailPage.vue
git commit -m "refactor: extract useTransactionEditFlow composable from duplicated page logic"
```

---

### Task 8: Deduplicate Payment Modal Logic

**Files:**
- Create: `frontend/src/entities/debt/model/useDebtPaymentForm.ts`
- Create: `frontend/src/entities/debt/ui/ForgivenessToggle.vue`
- Modify: `frontend/src/features/partial-payment/ui/PartialPaymentModal.vue`
- Modify: `frontend/src/features/close-debt/ui/CloseAllDebtsModal.vue`

**Step 1: Read both modal files completely to identify exact shared logic**

Read `PartialPaymentModal.vue` and `CloseAllDebtsModal.vue` fully to identify the shared state, computed properties, and template blocks.

**Step 2: Create `useDebtPaymentForm` composable**

Create `frontend/src/entities/debt/model/useDebtPaymentForm.ts`:

```typescript
import { ref, computed, watch } from 'vue';
import { CATEGORY_IDS } from '@/entities/category/model/constants';

export function useDebtPaymentForm(options: {
  remainingAmount: () => number;
  debtType: () => 'given' | 'taken';
}) {
  const paymentAmount = ref(0);
  const forgiveRemainder = ref(false);
  const excessCategoryId = ref<string>(CATEGORY_IDS.GIFTS_INCOME);

  const isOverpayment = computed(() => paymentAmount.value > options.remainingAmount());
  const excess = computed(() =>
    isOverpayment.value ? paymentAmount.value - options.remainingAmount() : 0,
  );

  const isValid = computed(() => paymentAmount.value > 0);

  // Reset forgiveness when overpaying
  watch(isOverpayment, (over) => {
    if (over) forgiveRemainder.value = false;
  });

  function reset(amount: number) {
    paymentAmount.value = amount;
    forgiveRemainder.value = false;
    excessCategoryId.value =
      options.debtType() === 'given' ? CATEGORY_IDS.GIFTS_INCOME : CATEGORY_IDS.GIFTS;
  }

  return {
    paymentAmount,
    forgiveRemainder,
    excessCategoryId,
    isOverpayment,
    excess,
    isValid,
    reset,
  };
}
```

**Step 3: Create ForgivenessToggle.vue**

Create `frontend/src/entities/debt/ui/ForgivenessToggle.vue` — extract the shared checkbox+label+icon template block from both modals.

**Step 4: Refactor PartialPaymentModal.vue to use the composable**

Replace the local state/computed/watch with the composable call.

**Step 5: Refactor CloseAllDebtsModal.vue to use the composable**

Same pattern. The modal has extra complexity (multi-debt allocation) that stays local.

**Step 6: Build to verify**

Run: `cd frontend && bun run build`
Expected: No errors

**Step 7: Commit**

```bash
git add frontend/src/entities/debt/model/useDebtPaymentForm.ts \
  frontend/src/entities/debt/ui/ForgivenessToggle.vue \
  frontend/src/features/partial-payment/ui/PartialPaymentModal.vue \
  frontend/src/features/close-debt/ui/CloseAllDebtsModal.vue
git commit -m "refactor: extract shared debt payment form logic and forgiveness toggle"
```

---

### Task 9: Create Route Names Constants and Convert Path-String Navigations

**Files:**
- Create: `frontend/src/app/router/routeNames.ts`
- Modify: 11 files with `router.push('/...')` calls

**Step 1: Create routeNames.ts**

Create `frontend/src/app/router/routeNames.ts`:

```typescript
export const ROUTE_NAMES = {
  DASHBOARD: 'dashboard',
  HISTORY: 'history',
  ANALYTICS: 'analytics',
  ANALYTICS_FULL: 'analytics-full',
  ACCOUNTS: 'accounts',
  NEW_ACCOUNT: 'new-account',
  ACCOUNT_DETAIL: 'account-detail',
  NEW_TRANSACTION: 'new-transaction',
  NEW_REMINDER: 'new-reminder',
  REMINDER_DETAIL: 'reminder-detail',
  REMINDERS_LIST: 'reminders-list',
  DEBTS_LIST: 'debts-list',
  NEW_DEBT: 'new-debt',
  DEBT_DETAIL: 'debt-detail',
  PROFILE: 'profile',
  CHANGELOG: 'changelog',
  SETTINGS_CURRENCY: 'settings-currency',
  SETTINGS_IMPORT: 'settings-import',
  SETTINGS_CATEGORIES: 'settings-categories',
  PEOPLE_LIST: 'people-list',
  SETTINGS_QUICK_ACTIONS: 'settings-quick-actions',
  SCAN_RECEIPT: 'scan-receipt',
  DASHBOARD_SETTINGS: 'dashboard-settings',
  WELCOME: 'welcome',
  LOGIN: 'login',
  AUTH_CALLBACK: 'auth-callback',
  FIRST_ACCOUNT: 'first-account',
  CURRENCY_SELECTION: 'currency-selection',
} as const;
```

**Step 2: Update router/index.ts to use ROUTE_NAMES**

Import and use `ROUTE_NAMES` for all `name:` properties in route definitions and guard navigations.

**Step 3: Convert all 28 path-string navigations across 11 files**

For each file, replace `router.push('/path')` with `router.push({ name: ROUTE_NAMES.XXX })`:

Files to modify:
- `app/layouts/ui/MainLayout.vue` — `'/transactions/new'` → `{ name: ROUTE_NAMES.NEW_TRANSACTION }`
- `pages/onboarding/currency-selection/CurrencySelectionPage.vue` — `'/onboarding/first-account'` → `{ name: ROUTE_NAMES.FIRST_ACCOUNT }`
- `pages/onboarding/first-account/FirstAccountPage.vue` — `'/'` → `{ name: ROUTE_NAMES.DASHBOARD }`
- `features/analytics-filters/ui/ModeToggle.vue` — `'/analytics'` / `'/analytics/full'`
- `pages/dashboard/model/useDashboardNavigation.ts` — all 12 navigations
- `pages/history/HistoryPage.vue` — `'/transactions/new'`
- `pages/accounts/AccountDetailPage.vue` — `'/transactions/new'`
- `pages/accounts/AccountsPage.vue` — `'/accounts/${id}'` / `'/accounts/new'`
- `pages/profile/ProfilePage.vue` — 6 navigations
- `pages/settings/import/ImportPage.vue` — `'/history'` / `'/'`
- `features/scan-receipt/ui/steps/Step4Summary.vue` — `'/'`

For routes with params like `/accounts/${account.id}`:
```typescript
router.push({ name: ROUTE_NAMES.ACCOUNT_DETAIL, params: { id: account.id } })
```

For routes with query like `/analytics?type=${type}`:
```typescript
router.push({ name: ROUTE_NAMES.ANALYTICS, query: { type } })
```

**Step 4: Build to verify**

Run: `cd frontend && bun run build`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/app/router/routeNames.ts \
  frontend/src/app/router/index.ts \
  # ... all 11 modified files
git commit -m "refactor: replace path-string router navigations with named routes"
```

---

### Task 10: Fix `DeleteDebtHandler` to Use Domain Layer

**Files:**
- Modify: `backend/src/modules/accounting/application/commands/delete-transaction/delete-transaction.command.ts`
- Modify: `backend/src/modules/accounting/application/commands/delete-transaction/delete-transaction.handler.ts`
- Modify: `backend/src/modules/debt/application/commands/delete-debt/delete-debt.handler.ts`

**Step 1: Add `skipDebtCheck` option to DeleteTransactionCommand**

The existing `DeleteTransactionHandler` checks `hasOpenDebtsForTransaction` and throws if debts are open. When deleting a debt's transactions, the debt is still open, so this check would fail. Add an option to skip it:

```typescript
export class DeleteTransactionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly skipDebtCheck = false,
  ) {}
}
```

**Step 2: Update DeleteTransactionHandler to respect skipDebtCheck**

In the handler (line ~42-47), wrap the debt check:

```typescript
if (!command.skipDebtCheck) {
  const hasOpenDebts = await this.debtRepository.hasOpenDebtsForTransaction(command.id);
  if (hasOpenDebts) {
    throw new BadRequestException(
      'Нельзя удалить транзакцию, пока есть связанные открытые долги. Сначала закройте долги.',
    );
  }
}
```

**Step 3: Rewrite DeleteDebtHandler to use CommandBus**

Replace the entire file:

```typescript
import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DeleteDebtCommand } from './delete-debt.command';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';
import { DeleteTransactionCommand } from '../../../../accounting/application/commands/delete-transaction/delete-transaction.command';

@CommandHandler(DeleteDebtCommand)
export class DeleteDebtHandler implements ICommandHandler<DeleteDebtCommand> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
    private readonly commandBus: CommandBus,
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: DeleteDebtCommand): Promise<void> {
    const debt = await this.debtRepository.findById(command.id);
    if (!debt) throw new NotFoundException('Debt not found');
    if (debt.userId !== command.userId) throw new ForbiddenException('Access denied');

    // Collect ALL transaction IDs linked to this debt
    const transactionIds = new Set<string>();
    if (debt.transactionId) transactionIds.add(debt.transactionId);
    if (debt.closeTransactionId) transactionIds.add(debt.closeTransactionId);

    // Find all transactions with debt_id = this debt's id (partial payments)
    const debtTransactions = await this.debtRepository.findTransactionIdsByDebtId(command.id);
    for (const txId of debtTransactions) {
      transactionIds.add(txId);
    }

    // Delete transactions via command bus (handles balance reversal properly)
    for (const txId of transactionIds) {
      try {
        await this.commandBus.execute(
          new DeleteTransactionCommand(txId, command.userId, true),
        );
      } catch {
        // Transaction may already be deleted — continue
      }
    }

    // Delete the debt itself
    await this.debtRepository.delete(command.id);
  }
}
```

Note: Check if `debtRepository` has a `findTransactionIdsByDebtId` method or if we need to add it. If not, use a direct query for `SELECT id FROM transactions WHERE debt_id = :debtId`.

Also check if `debtRepository` has a `delete` method. If not, use the data source directly for the debt deletion only.

**Step 4: Build and test**

Run: `cd backend && bun run build && bun run test`
Expected: Build succeeds, all tests pass

**Step 5: Commit**

```bash
git add backend/src/modules/accounting/application/commands/delete-transaction/delete-transaction.command.ts \
  backend/src/modules/accounting/application/commands/delete-transaction/delete-transaction.handler.ts \
  backend/src/modules/debt/application/commands/delete-debt/delete-debt.handler.ts
git commit -m "refactor: DeleteDebtHandler uses CommandBus instead of direct ORM access"
```

---

### Task 11: Synchronize Demo Data Constants

**Files:**
- Modify: `frontend/src/features/demo-mode/model/demoDataGenerator.ts`
- Modify: `backend/src/modules/identity/application/services/demo-initialization.service.ts`

**Step 1: Read both files completely**

Compare the constants in both files to identify exact overlap and divergence.

**Step 2: Add cross-reference comments and align structure**

At the top of each file, add a prominent comment:

Frontend:
```typescript
/**
 * DEMO DATA CONFIGURATION
 * ⚠️ Keep in sync with: backend/src/modules/identity/application/services/demo-initialization.service.ts
 * Both files share identical constants for demo data generation.
 */
```

Backend:
```typescript
/**
 * DEMO DATA CONFIGURATION
 * ⚠️ Keep in sync with: frontend/src/features/demo-mode/model/demoDataGenerator.ts
 * Both files share identical constants for demo data generation.
 */
```

**Step 3: Align the constant structure**

Extract shared constants into a clearly labeled `DEMO_CONFIG` object at the top of each file with identical structure. This makes it easy to diff the two files when changes are needed.

**Step 4: Build both**

Run: `cd frontend && bun run build && cd ../backend && bun run build`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/features/demo-mode/model/demoDataGenerator.ts \
  backend/src/modules/identity/application/services/demo-initialization.service.ts
git commit -m "docs: add cross-reference comments and align demo data constants structure"
```

---

## Execution Order

Tasks 1-4 are independent quick wins — can be parallelized.
Tasks 5-8 are independent medium-effort — can be parallelized.
Tasks 9-11 are independent large refactors — can be parallelized.

**Recommended execution:** Parallel within each group, sequential between groups. Verify build after each group.
