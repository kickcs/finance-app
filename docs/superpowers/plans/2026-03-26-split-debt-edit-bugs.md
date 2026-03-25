# Split Expense + Debt Edit Bugs Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 bugs in the interaction between split expense creation, transaction editing, and debt integrity.

**Architecture:** All fixes are frontend-only — the backend already has correct validation (e.g., debt check on delete). The bugs are: (1) non-atomic save order in edit modal, (2) stale cache when loading split debts, (3) unconditional remaining_amount reset, (4) missing debt cache invalidation after transaction edit, (5) non-atomic split expense creation with no error recovery, (6) missing fallback for account_id/currency when creating new participant.

**Tech Stack:** Vue 3, TanStack Vue Query, TypeScript

---

### Task 1: Fix stale cache when loading split debts (BUG 4 + BUG 3)

**Files:**
- Modify: `frontend/src/features/split-expense/model/useSplitTransactionEdit.ts:49-72`

**Problem:** `loadSplitDebts()` reads from Vue Query cache instead of fetching fresh data. If payments were made in another tab, the modal shows stale data and allows editing debts that should be locked.

- [ ] **Step 1: Always fetch fresh debts**

Replace `loadSplitDebts()` (lines 49-72) with:

```typescript
async function loadSplitDebts() {
  const txId = toValue(transactionId);
  const uid = toValue(userId);
  if (!txId || !uid) {
    splitDebts.value = [];
    return;
  }

  isLoading.value = true;
  try {
    // Always fetch fresh data to avoid stale cache issues
    // (payments made in another tab would not be reflected in cache)
    const allDebts = await debtsApi.getAll(uid);
    splitDebts.value = allDebts.filter((d) => d.source_transaction_id === txId);
  } catch {
    splitDebts.value = [];
  } finally {
    isLoading.value = false;
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/split-expense/model/useSplitTransactionEdit.ts
git commit -m "fix(split-expense): always fetch fresh debts to avoid stale cache"
```

---

### Task 2: Fix remaining_amount reset — preserve payments (BUG 3)

**Files:**
- Modify: `frontend/src/features/split-expense/model/useSplitTransactionEdit.ts:221-239`

**Problem:** `saveChanges()` unconditionally sets `remaining_amount = update.amount` for all updated debts, even if partial payments were made. This destroys payment history.

- [ ] **Step 1: Calculate correct remaining_amount**

Replace the update block in `saveChanges()` (lines 222-239) with:

```typescript
// 2. Update modified debts
for (const [debtId, update] of pendingUpdates.value) {
  const debt = splitDebts.value.find((d) => d.id === debtId);
  if (!debt) continue;

  const updates: Partial<Debt> = {};
  if (update.amount !== undefined) {
    updates.total_amount = update.amount;
    // Preserve payments: remaining = new_total - already_paid
    const paidAmount = debt.total_amount - debt.remaining_amount;
    updates.remaining_amount = Math.max(0, update.amount - paidAmount);
  }
  if (update.personName !== undefined) {
    updates.person_name = update.personName;
    updates.name = buildDebtName('given', update.personName);
  }

  if (Object.keys(updates).length > 0) {
    await debtsApi.update(debtId, updates);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/split-expense/model/useSplitTransactionEdit.ts
git commit -m "fix(split-expense): preserve payment history when updating debt amounts"
```

---

### Task 3: Fix non-atomic save — save transaction first, then debts (BUG 1)

**Files:**
- Modify: `frontend/src/features/edit-transaction/ui/EditTransactionModal.vue:152-171`
- Modify: `frontend/src/features/edit-transaction/model/useEditTransaction.ts:15-53`

**Problem:** `confirm()` saves split debt changes first, then emits the transaction update. If the transaction update fails, debts are already mutated with no rollback.

**Fix:** Reverse the order — update the transaction first (the critical operation), then save split changes. The modal must call the update function directly instead of emitting.

- [ ] **Step 1: Add onTransactionUpdated callback to useSplitTransactionEdit**

The `confirm()` in EditTransactionModal currently emits `confirm` which the parent handles. We need to change the flow so the modal handles everything internally. The cleanest fix is to reverse the save order: emit `confirm` first (which updates the transaction), and only save split changes after the transaction is confirmed.

However, since `emit('confirm')` is fire-and-forget (the parent calls `useEditTransaction.update()` asynchronously), we can't await its result.

**Better approach:** Make `confirm()` return success/failure from the transaction update. The simplest way: pass `useEditTransaction.update` as a prop and call it directly.

Actually, the cleanest fix with minimal refactoring: **reverse the order in `confirm()` — emit transaction update first (which is the lightweight step), then save split changes.** But since `emit` doesn't return a Promise...

**Simplest correct fix:** Make `confirm()` save split changes only after emitting, using a `watch` on `isUpdating` prop. But this is fragile.

**Best fix with minimal changes:** Accept `onSave` callback as a prop that performs the transaction update and returns success/failure.

- [ ] **Step 2: Update EditTransactionModal**

Add `onSave` prop:

```typescript
const props = defineProps<{
  modelValue: boolean;
  transaction: Transaction | null;
  accounts: AccountWithBalances[];
  currency: string;
  isUpdating?: boolean;
  error?: string | null;
  onSave?: (updates: Partial<Transaction>) => Promise<boolean>;
}>();
```

Replace `confirm()`:

```typescript
async function confirm() {
  if (isConfirming.value) return;
  isConfirming.value = true;
  try {
    const updates = {
      type: type.value,
      amount: amount.value,
      account_id: accountId.value,
      category_id: categoryId.value,
      description: description.value || null,
      date: date.value,
    };

    // 1. Save transaction first (the critical operation)
    if (props.onSave) {
      const txSuccess = await props.onSave(updates);
      if (!txSuccess) return;
    } else {
      // Fallback: emit for backward compatibility
      emit('confirm', updates);
    }

    // 2. Save split changes only after transaction succeeds
    if (hasSplit.value) {
      await saveSplitChanges();
    }
  } finally {
    isConfirming.value = false;
  }
}
```

- [ ] **Step 3: Find and update parent component that uses EditTransactionModal**

Search for where `EditTransactionModal` is used and the `@confirm` handler. The parent should pass `onSave` prop that wraps `useEditTransaction.update()`. The parent file is likely in `frontend/src/pages/` or `frontend/src/features/edit-transaction/`.

Read the parent component, find the `@confirm` handler for `EditTransactionModal`, and add the `onSave` prop:

```vue
<EditTransactionModal
  ...existing props...
  :on-save="handleSaveTransaction"
/>
```

Where `handleSaveTransaction` is:

```typescript
async function handleSaveTransaction(updates: Partial<Transaction>): Promise<boolean> {
  if (!editingTransaction.value) return false;
  return await updateTransaction(editingTransaction.value, updates);
}
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/edit-transaction/ frontend/src/pages/
git commit -m "fix(edit-transaction): save transaction before split debts to ensure atomicity"
```

---

### Task 4: Add debt cache invalidation after transaction edit (BUG 5)

**Files:**
- Modify: `frontend/src/features/edit-transaction/model/useEditTransaction.ts:37-41`

**Problem:** After editing a transaction, `invalidateTransactionRelated` is called but it doesn't include debt queries. The debts page shows stale data.

- [ ] **Step 1: Add debt invalidation**

Replace the invalidation block in `update()` (lines 37-41) with:

```typescript
// Invalidate all related caches (including debts for split transactions)
await Promise.all([
  invalidateTransactionRelated(queryClient, toValue(userId) ?? ''),
  invalidateAccountRelated(queryClient, toValue(userId) ?? ''),
  queryClient.invalidateQueries({ queryKey: ['debts'] }),
]);
```

Add the same in `remove()` (lines 88-92):

```typescript
await Promise.all([
  invalidateTransactionRelated(queryClient, toValue(userId) ?? ''),
  invalidateAccountRelated(queryClient, toValue(userId) ?? ''),
  queryClient.invalidateQueries({ queryKey: ['debts'] }),
]);
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/edit-transaction/model/useEditTransaction.ts
git commit -m "fix(edit-transaction): invalidate debt cache after transaction update/delete"
```

---

### Task 5: Handle partial failure in split expense creation (BUG 6)

**Files:**
- Modify: `frontend/src/features/split-expense/model/useSplitExpense.ts:185-233`

**Problem:** `createDebtsForSplit()` creates debts sequentially. If creation fails mid-way, some debts exist and others don't. No error notification to user.

- [ ] **Step 1: Add error handling with user notification**

Replace `createDebtsForSplit()` (lines 185-233) with:

```typescript
async function createDebtsForSplit(
  transactionId: string,
  userId: string,
  accountId: string,
  currency: string,
  transactionDate: number,
): Promise<boolean> {
  if (!splitData.value.enabled || splitData.value.participants.length === 0) {
    return true;
  }

  // Filter out participants with zero or negative amounts
  const validParticipants = splitData.value.participants.filter((p) => p.amount > 0);

  if (validParticipants.length === 0) {
    return true;
  }

  let createdCount = 0;

  try {
    for (const participant of validParticipants) {
      await debtsApi.create({
        user_id: userId,
        name: buildDebtName('given', participant.personName),
        total_amount: participant.amount,
        remaining_amount: participant.amount,
        debt_type: 'given',
        person_name: participant.personName,
        account_id: accountId,
        transaction_id: null,
        source_transaction_id: transactionId,
        is_closed: false,
        currency: currency,
        created_at: new Date(transactionDate).toISOString(),
      });
      createdCount++;
    }

    // Invalidate debts cache
    await queryClient.invalidateQueries({
      queryKey: debtQueryKeys.list(userId),
    });

    return true;
  } catch (e) {
    console.error('Failed to create debts for split expense:', e);

    // Notify user about partial failure
    if (createdCount > 0) {
      toast({
        title: `Создано ${createdCount} из ${validParticipants.length} долгов`,
        description: 'Остальные можно добавить вручную через редактирование транзакции',
        variant: 'warning',
      });
      // Invalidate to show what was created
      await queryClient.invalidateQueries({
        queryKey: debtQueryKeys.list(userId),
      });
    } else {
      toast({
        title: 'Не удалось создать долги для разделения',
        description: 'Транзакция создана, долги можно добавить позже',
        variant: 'error',
      });
    }

    return false;
  }
}
```

Note: `toast` needs to be imported. Check if `useSplitExpense` already has access to `useToast`. If not, add: `const { toast } = useToast();` at the top of the composable.

- [ ] **Step 2: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/split-expense/model/useSplitExpense.ts
git commit -m "fix(split-expense): handle partial failure in debt creation with user notification"
```

---

### Task 6: Fix new participant account_id/currency fallback (BUG 5 from investigation)

**Files:**
- Modify: `frontend/src/features/split-expense/model/useSplitTransactionEdit.ts:241-260`

**Problem:** When creating a new participant debt, the code uses `splitDebts.value[0]` as template for account_id and currency. If all existing debts were deleted, this can produce a debt with empty account_id.

- [ ] **Step 1: Pass transaction context to saveChanges**

The composable already receives `transactionAmount` as a parameter. We need the transaction's `account_id` and `currency` too. But changing the composable signature is a larger refactor.

**Simpler fix:** Use the first NON-deleted debt as template, or fall back to a reasonable default. Also add the transaction's account and currency as parameters to `useSplitTransactionEdit`.

Actually, the simplest fix: add `transactionAccountId` and `transactionCurrency` parameters to the composable.

Update `useSplitTransactionEdit` signature:

```typescript
export function useSplitTransactionEdit(
  transactionId: MaybeRefOrGetter<string | null>,
  userId: MaybeRefOrGetter<string | null>,
  transactionAmount: MaybeRefOrGetter<number>,
  transactionAccountId?: MaybeRefOrGetter<string>,
  transactionCurrency?: MaybeRefOrGetter<string>,
)
```

Update the create block in `saveChanges()` (lines 241-260):

```typescript
// 3. Create new debts
for (const add of pendingAdds.value) {
  if (add.amount <= 0) continue;

  // Use transaction's account/currency, fallback to first existing debt, then defaults
  const templateDebt = splitDebts.value.find((d) => !pendingDeletes.value.has(d.id));
  const acctId = toValue(transactionAccountId) || templateDebt?.account_id || '';
  const curr = toValue(transactionCurrency) || templateDebt?.currency || DEFAULT_CURRENCY;

  await debtsApi.create({
    user_id: uid,
    name: buildDebtName('given', add.personName),
    total_amount: add.amount,
    remaining_amount: add.amount,
    debt_type: 'given',
    person_name: add.personName,
    account_id: acctId,
    transaction_id: null,
    source_transaction_id: txId,
    is_closed: false,
    currency: curr,
    created_at: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Update EditTransactionModal to pass new params**

In `EditTransactionModal.vue`, update the `useSplitTransactionEdit` call (lines 77-84):

```typescript
} = useSplitTransactionEdit(
  () =>
    !isDebtRelated.value && !isTransfer.value && !isAdjustment.value
      ? (props.transaction?.id ?? null)
      : null,
  userId,
  () => amount.value,
  () => accountId.value,
  () => props.transaction?.currency ?? DEFAULT_CURRENCY,
);
```

Add import for `DEFAULT_CURRENCY`:
```typescript
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
```

- [ ] **Step 3: Also invalidate infinite debt queries in saveChanges**

Update the invalidation in `saveChanges()` (line 263):

```typescript
// 4. Invalidate all debt caches (list + infinite)
await queryClient.invalidateQueries({ queryKey: ['debts'] });
```

This covers both `debtQueryKeys.list(uid)` and `debtQueryKeys.infinite(...)` via prefix matching.

- [ ] **Step 4: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/split-expense/model/useSplitTransactionEdit.ts frontend/src/features/edit-transaction/ui/EditTransactionModal.vue
git commit -m "fix(split-expense): use transaction account/currency for new participants, broaden cache invalidation"
```

---

### Task 7: Verify all builds and run tests

- [ ] **Step 1: Full frontend build**

Run: `cd frontend && bun run build`
Expected: No errors

- [ ] **Step 2: Backend tests**

Run: `cd backend && bun run test`
Expected: All tests pass

- [ ] **Step 3: Final commit if any remaining changes**

```bash
git add -A && git status
```
