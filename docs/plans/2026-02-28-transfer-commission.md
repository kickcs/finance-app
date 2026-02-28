# Transfer Commission Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to optionally add a commission when transferring between accounts, creating a separate expense transaction.

**Architecture:** Commission is a separate expense transaction with system category `commission`, created atomically alongside the transfer. Frontend adds an optional fee input to TransferPanel with fixed/percent toggle.

**Tech Stack:** NestJS (CQRS), Vue 3 (Composition API), TanStack Vue Query, Tailwind CSS v4

---

### Task 1: Add COMMISSION category constant (frontend)

**Files:**
- Modify: `frontend/src/shared/config/categoryIds.ts`
- Modify: `frontend/src/entities/category/model/constants.ts`

**Step 1: Add COMMISSION to CATEGORY_IDS**

In `frontend/src/shared/config/categoryIds.ts`, add `COMMISSION: 'commission'` to the object:

```typescript
export const CATEGORY_IDS = {
  DEBT_GIVEN: 'debt_given',
  DEBT_TAKEN: 'debt_taken',
  DEBT_RETURN_TO_ME: 'debt_return_to_me',
  DEBT_RETURN_FROM_ME: 'debt_return_from_me',
  GIFTS: 'gifts',
  GIFTS_INCOME: 'gifts_income',
  TRANSFER: 'transfer',
  COMMISSION: 'commission',
} as const;
```

**Step 2: Add COMMISSION_CATEGORY constant**

In `frontend/src/entities/category/model/constants.ts`, after `TRANSFER_CATEGORY` (line 185), add:

```typescript
export const COMMISSION_CATEGORY: Category = {
  id: 'commission',
  name: 'Комиссия',
  icon: 'receipt_long',
  color: '#ef4444',
  type: 'expense',
};
```

Update `ALL_CATEGORIES` to include it:

```typescript
export const ALL_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  ...DEBT_CATEGORIES,
  TRANSFER_CATEGORY,
  COMMISSION_CATEGORY,
];
```

**Step 3: Add icon mapping**

Check `frontend/src/shared/ui/icon/iconMap.ts` — if `receipt_long` is not mapped, add a mapping (e.g., to Lucide `Receipt`).

**Step 4: Build frontend to verify**

Run: `cd frontend && bun run build`
Expected: Success, no type errors

**Step 5: Commit**

```
feat: add COMMISSION system category constant
```

---

### Task 2: Add feeAmount to backend DTO, Command, and Handler

**Files:**
- Modify: `backend/src/modules/accounting/presentation/dto/create-transaction.dto.ts`
- Modify: `backend/src/modules/accounting/application/commands/create-transaction/create-transaction.command.ts`
- Modify: `backend/src/modules/accounting/application/commands/create-transaction/create-transaction.handler.ts`
- Modify: `backend/src/modules/accounting/presentation/controllers/transactions.controller.ts` (line ~162, pass `dto.feeAmount`)

**Step 1: Add feeAmount to DTO**

In `create-transaction.dto.ts`, add after `debtId`:

```typescript
@IsOptional()
@IsNumber()
@IsPositive({ message: 'Fee amount must be positive' })
feeAmount?: number;
```

**Step 2: Add feeAmount to Command**

In `create-transaction.command.ts`, add parameter after `debtId`:

```typescript
export class CreateTransactionCommand {
  constructor(
    public readonly userId: string,
    public readonly accountId: string,
    public readonly categoryId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly type: 'income' | 'expense' | 'transfer',
    public readonly date: Date,
    public readonly description?: string,
    public readonly isDebtRelated: boolean = false,
    public readonly toAccountId?: string,
    public readonly toAmount?: number,
    public readonly toCurrency?: string,
    public readonly debtId?: string,
    public readonly feeAmount?: number,
  ) {}
}
```

**Step 3: Pass feeAmount from controller to command**

In `transactions.controller.ts` line ~174, add `dto.feeAmount` as last arg:

```typescript
return this.commandBus.execute(
  new CreateTransactionCommand(
    userId,
    dto.accountId,
    dto.categoryId,
    dto.amount,
    dto.currency,
    dto.type,
    new Date(dto.date),
    dto.description,
    dto.isDebtRelated,
    dto.toAccountId,
    dto.toAmount,
    dto.toCurrency,
    dto.debtId,
    dto.feeAmount,
  ),
);
```

**Step 4: Create fee expense in handler**

In `create-transaction.handler.ts`, inside the `if (type === 'transfer')` block (after line 90, after saving transfer), add commission logic:

```typescript
if (type === 'transfer') {
  // ... existing transfer code through line 90 ...

  // Create commission expense if fee specified
  if (command.feeAmount && command.feeAmount > 0) {
    const feeTransaction = Transaction.createExpense(
      crypto.randomUUID(),
      userId,
      accountId,
      'commission',
      command.feeAmount,
      currency,
      date,
      'Комиссия за перевод',
      false,
      undefined,
    );
    account.debit(command.feeAmount, currency);

    // Save fee within same database transaction
    await this.dataSource.transaction(async () => {
      await this.accountRepository.save(account);
      await this.accountRepository.save(toAccount);
      await this.transactionRepository.save(transaction);
      await this.transactionRepository.save(feeTransaction);
    });

    await this.eventPublisher.publishEvents(account);
    await this.eventPublisher.publishEvents(toAccount);
    await this.eventPublisher.publishEvents(transaction);
    await this.eventPublisher.publishEvents(feeTransaction);
  } else {
    // Original save logic (no fee)
    await this.dataSource.transaction(async () => {
      await this.accountRepository.save(account);
      await this.accountRepository.save(toAccount);
      await this.transactionRepository.save(transaction);
    });

    await this.eventPublisher.publishEvents(account);
    await this.eventPublisher.publishEvents(toAccount);
    await this.eventPublisher.publishEvents(transaction);
  }

  return this.toResponse(transaction);
}
```

**Important:** The `account.debit(feeAmount, currency)` must happen BEFORE the DB transaction save, since `TransferDomainService.executeTransfer` already debits the transfer amount. The fee is an additional debit on the same source account.

**Step 5: Build backend**

Run: `cd backend && bun run build`
Expected: Success

**Step 6: Run tests**

Run: `cd backend && bun run test`
Expected: All pass

**Step 7: Commit**

```
feat: support optional feeAmount for transfer commission
```

---

### Task 3: Add fee fields to frontend form data and API

**Files:**
- Modify: `frontend/src/features/add-transaction/model/useTransactionForm.ts`
- Modify: `frontend/src/features/add-transaction/model/useSubmitTransaction.ts`
- Modify: `frontend/src/entities/transaction/api/transactionsApi.ts`

**Step 1: Extend TransactionFormData**

In `useTransactionForm.ts`, add to `TransactionFormData` interface:

```typescript
export interface TransactionFormData {
  accountId: string | null;
  categoryId: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  date: number;
  toAccountId: string | null;
  toAmount: number | null;
  toCurrency: string | null;
  feeAmount: number;
  feeType: 'fixed' | 'percent';
}
```

Add defaults:

```typescript
const DEFAULT_FORM_DATA: Omit<TransactionFormData, 'date'> = {
  accountId: null,
  categoryId: '',
  amount: 0,
  currency: DEFAULT_CURRENCY,
  type: 'expense',
  description: '',
  toAccountId: null,
  toAmount: null,
  toCurrency: null,
  feeAmount: 0,
  feeType: 'fixed',
};
```

In `setType()`, reset fee fields when switching away from transfer:

```typescript
function setType(type: 'income' | 'expense' | 'transfer') {
  formData.value.type = type;
  formData.value.categoryId = type === 'transfer' ? CATEGORY_IDS.TRANSFER : '';
  if (type !== 'transfer') {
    formData.value.toAccountId = null;
    formData.value.toAmount = null;
    formData.value.toCurrency = null;
    formData.value.feeAmount = 0;
    formData.value.feeType = 'fixed';
  }
}
```

**Step 2: Update buildApiPayload in useSubmitTransaction.ts**

In `buildApiPayload()`, add `feeAmount` for transfers:

```typescript
function buildApiPayload(userId: string, formData: TransactionFormData) {
  const isTransfer = formData.type === 'transfer';
  const categoryId = isTransfer ? CATEGORY_IDS.TRANSFER : formData.categoryId;

  const computedFee = isTransfer && formData.feeAmount > 0
    ? (formData.feeType === 'percent'
        ? Math.round(formData.amount * formData.feeAmount / 100 * 100) / 100
        : formData.feeAmount)
    : undefined;

  return {
    user_id: userId,
    account_id: formData.accountId!,
    category_id: categoryId,
    amount: formData.amount,
    currency: formData.currency,
    type: formData.type,
    description: formData.description || null,
    date: new Date(formData.date).toISOString(),
    to_account_id: isTransfer ? formData.toAccountId : null,
    to_amount: isTransfer ? formData.toAmount : null,
    to_currency: isTransfer ? formData.toCurrency : null,
    fee_amount: computedFee,
  };
}
```

**Step 3: Send feeAmount in transactionsApi.create()**

In `transactionsApi.ts`, `create()` method, add `feeAmount` to the POST body:

```typescript
async create(transaction: TransactionInsert): Promise<Transaction> {
  const data = await http.post<TransactionResponse>('/transactions', {
    accountId: transaction.account_id,
    categoryId: transaction.category_id,
    amount: transaction.amount,
    currency: transaction.currency,
    type: transaction.type,
    description: transaction.description,
    date: transaction.date,
    isDebtRelated: transaction.is_debt_related ?? false,
    debtId: transaction.debt_id,
    toAccountId: transaction.to_account_id,
    toAmount: transaction.to_amount,
    toCurrency: transaction.to_currency,
    feeAmount: transaction.fee_amount,
  });
  return transformTransaction(data);
}
```

Also add `fee_amount?: number` to `TransactionInsert` type in `database.types.ts` (in the `Insert` type for transactions).

**Step 4: Update optimistic account balance for fee**

In `useSubmitTransaction.ts` `snapshotAndApplyOptimistic()`, in the account balance update block (~line 158), when transfer, also debit fee:

```typescript
if (account.id === formData.accountId) {
  let balanceChange = formData.type === 'income' ? formData.amount : -formData.amount;
  // For transfers with fee, also debit fee from source
  if (formData.type === 'transfer' && formData.feeAmount > 0) {
    const computedFee = formData.feeType === 'percent'
      ? Math.round(formData.amount * formData.feeAmount / 100 * 100) / 100
      : formData.feeAmount;
    balanceChange -= computedFee;
  }
  return {
    ...account,
    balances: account.balances.map((b) =>
      b.currency === formData.currency ? { ...b, balance: b.balance + balanceChange } : b,
    ),
  };
}
```

**Step 5: Build frontend**

Run: `cd frontend && bun run build`
Expected: Success

**Step 6: Commit**

```
feat: add fee fields to transaction form data and API layer
```

---

### Task 4: Add commission UI to TransferPanel

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/TransferPanel.vue`

**Step 1: Add fee state and computed**

In `<script setup>`, add:

```typescript
const feeDisplayAmount = computed(() => {
  if (props.formData.feeType === 'percent' && props.formData.amount > 0 && props.formData.feeAmount > 0) {
    return Math.round(props.formData.amount * props.formData.feeAmount / 100 * 100) / 100;
  }
  return props.formData.feeAmount;
});

function handleFeeAmountChange(value: string) {
  const num = Number(value) || 0;
  emit('update:formData', { ...props.formData, feeAmount: num });
}

function handleFeeTypeToggle() {
  const newType = props.formData.feeType === 'fixed' ? 'percent' : 'fixed';
  emit('update:formData', { ...props.formData, feeType: newType, feeAmount: 0 });
}
```

**Step 2: Add commission input in template**

After the target account popover (after line 447 `</Popover>`), before the `showConversion` section, add:

```vue
<!-- Commission input (only when target selected) -->
<Transition name="fee">
  <div
    v-if="targetAccount"
    class="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-light/50 dark:bg-surface-dark/50 border border-border-light dark:border-border-dark"
  >
    <UIcon
      name="receipt_long"
      size="sm"
      class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
    />
    <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark shrink-0">
      Комиссия
    </span>
    <input
      type="number"
      inputmode="decimal"
      :value="formData.feeAmount || ''"
      placeholder="0"
      class="flex-1 min-w-0 bg-transparent text-sm text-right text-text-primary-light dark:text-text-primary-dark outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      @input="handleFeeAmountChange(($event.target as HTMLInputElement).value)"
    />
    <button
      type="button"
      class="shrink-0 px-2 py-1 rounded-lg text-xs font-medium transition-colors"
      :class="
        formData.feeType === 'percent'
          ? 'bg-primary/10 text-primary'
          : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'
      "
      @click="handleFeeTypeToggle"
    >
      {{ formData.feeType === 'percent' ? '%' : formData.currency }}
    </button>
    <span
      v-if="formData.feeType === 'percent' && feeDisplayAmount > 0"
      class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark tabular-nums shrink-0"
    >
      ≈ {{ feeDisplayAmount }} {{ formData.currency }}
    </span>
  </div>
</Transition>
```

**Step 3: Add transition styles**

In `<style scoped>`, add:

```css
.fee-enter-active,
.fee-leave-active {
  transition: all 0.2s ease;
}
.fee-enter-from,
.fee-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
```

**Step 4: Build and verify visually**

Run: `cd frontend && bun run build`
Expected: Success

**Step 5: Commit**

```
feat: add commission input UI to transfer panel
```

---

### Task 5: Verify end-to-end and update changelog

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

**Step 1: Manual e2e test**

Run: `bun run dev`

Test scenarios:
1. Create transfer without commission — should work as before
2. Create transfer with fixed commission (e.g., 50₽) — should create 2 transactions: transfer + expense "Комиссия"
3. Create transfer with percent commission (e.g., 2%) — should calculate and create
4. Toggle between % and ₽ — field resets to 0
5. Verify source account balance debited by (amount + fee)
6. Verify commission transaction appears in expense history and analytics

**Step 2: Update changelog**

Add entry at top of `CHANGELOG_ENTRIES` in `changelogData.ts`:

```typescript
{
  version: '<next_patch>',
  date: '2026-02-28',
  entries: [
    {
      type: 'feature',
      description: 'Комиссия при переводе — можно указать сумму или процент, комиссия создаётся как отдельный расход',
    },
  ],
},
```

**Step 3: Build both**

Run: `bun run build`
Expected: Success for both frontend and backend

**Step 4: Commit**

```
feat: add transfer commission feature with changelog
```
