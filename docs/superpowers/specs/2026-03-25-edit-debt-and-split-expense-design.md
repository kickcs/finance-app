# Design Spec: Edit Debt & Split Expense Viewing/Editing

**Date**: 2026-03-25
**Status**: Draft
**Scope**: Two features — editing debts after creation, and viewing/editing split expense details on transactions.

---

## Feature 1: Edit Debt (EditDebtDrawer)

### Problem

Users cannot edit debts after creation. The "Edit" button on `DebtDetailPage` shows a toast "Редактирование пока недоступно". Backend already supports full editing via `PATCH /api/debts/:id`.

### Solution

New feature `features/edit-debt/` with a vaul-vue drawer component following `CreateDebtDrawer` patterns.

### Architecture

```
features/edit-debt/
├── model/
│   └── useEditDebt.ts          # Form state, validation, submit logic
├── ui/
│   ├── EditDebtDrawer.vue      # Responsive drawer (bottom-sheet mobile, side panel desktop)
│   └── index.ts
└── index.ts
```

### Component: EditDebtDrawer

**Props**: `debt: Debt`, `open: boolean`
**Emits**: `close`, `saved`

**Behavior**:
- Responsive via vaul-vue `DrawerRoot` (same as `CreateDebtDrawer`)
- Bottom-sheet on mobile, right-side panel on desktop
- Handle bar on mobile, close button on both
- iOS keyboard fix via `useDrawerKeyboard`

**Form Fields** (initialized from `debt` prop):

| Field | Type | Editable | Notes |
|-------|------|----------|-------|
| debt_type | Toggle (given/taken) | Yes | Warning on change |
| person_name | Text input | Yes | — |
| total_amount | Number input | Yes | Warning about existing payments |
| remaining_amount | Number input | Yes | Must be ≤ total_amount, ≥ 0 |
| currency | Display only | No | Fixed to debt's currency |
| account_id | SelectChips | Yes | From user's accounts |
| monthly_payment | Number input | Yes | Optional |
| next_payment_date | DatePickerField | Yes | Optional |
| description | Text input | Yes | — |
| is_private | ToggleRow | Yes | — |

**Validation**:
- `person_name` is non-empty
- `total_amount` > 0
- `remaining_amount` ≥ 0 and ≤ `total_amount`
- Auto-correct `remaining_amount` if it exceeds new `total_amount`

**Warnings** (contextual, shown as info boxes):
- When `total_amount` changes: "Изменение суммы не повлияет на уже созданные транзакции платежей"
- When `debt_type` changes: "Направление долга изменится"
- When `remaining_amount` > `total_amount` after edit: auto-corrected with notification

**Submit flow**:
1. Build diff of changed fields only
2. Call `useDebts().updateDebt(id, changes)` → `PATCH /api/debts/:id`
3. On success: haptic feedback, toast, emit `saved` + `close`
4. On error: toast with error message

### Composable: useEditDebt

```typescript
function useEditDebt(debt: MaybeRefOrGetter<Debt | null>) {
  return {
    formData: Ref<EditDebtFormData>,
    isValid: ComputedRef<boolean>,
    isDirty: ComputedRef<boolean>,
    isSubmitting: Ref<boolean>,
    warnings: ComputedRef<string[]>,
    updateField(field, value): void,
    submit(userId: string): Promise<boolean>,
    reset(): void,
  }
}
```

### Integration: DebtDetailPage

Replace current `handleEdit()` toast with drawer:

```typescript
// Before:
function handleEdit() {
  toast({ title: 'Редактирование пока недоступно' });
}

// After:
const showEditDrawer = ref(false);
function handleEdit() {
  showEditDrawer.value = true;
}
function handleEditSaved() {
  refetch(); // Refresh debt data
}
```

---

## Feature 2: Split Expense Viewing/Editing in EditTransactionModal

### Problem

When a transaction has split expenses (debts with `source_transaction_id`), users see only a "Транзакция с раздельным счётом" protected view. They cannot see who participated, how much each owes, payment status, or edit the split.

### Solution

Extend `EditTransactionModal` to show a split section with participant details and allow editing (with constraints for participants who have payments).

### Architecture

No new feature folder — extends existing `features/edit-transaction/` and `features/split-expense/`.

New/modified files:
```
features/split-expense/
├── model/
│   ├── useSplitExpense.ts        # Existing — no changes
│   └── useSplitTransactionEdit.ts  # NEW — manages split editing state
├── ui/
│   ├── SplitExpenseDrawer.vue    # Existing — no changes
│   ├── SplitExpenseSection.vue   # Existing — no changes
│   ├── SplitParticipantList.vue  # NEW — read/edit participant list
│   └── index.ts                  # Updated exports
└── index.ts

features/edit-transaction/ui/
└── EditTransactionModal.vue      # MODIFIED — add split section
```

### Composable: useSplitTransactionEdit

Manages the state of split debts linked to a transaction being edited.

```typescript
function useSplitTransactionEdit(
  transactionId: MaybeRefOrGetter<string | null>,
  userId: MaybeRefOrGetter<string | null>,
  transactionAmount: MaybeRefOrGetter<number>,
) {
  return {
    // State
    splitDebts: Ref<Debt[]>,              // All debts with source_transaction_id === txId
    hasSplit: ComputedRef<boolean>,         // splitDebts.length > 0
    isLoading: Ref<boolean>,

    // Participant data
    participants: ComputedRef<SplitParticipantView[]>,  // Enriched with payment status
    myShare: ComputedRef<number>,           // transactionAmount - sum(participant amounts)

    // Editing
    canEditParticipant(debtId: string): boolean,   // true if no payments made
    canDeleteParticipant(debtId: string): boolean,  // true if no payments made
    lockedParticipantIds: ComputedRef<string[]>,    // IDs with payments

    // Actions
    updateParticipantAmount(debtId: string, amount: number): void,  // Local state
    updateParticipantName(debtId: string, name: string): void,
    addParticipant(name: string, amount: number): void,
    removeParticipant(debtId: string): void,

    // Amount change handling
    handleTransactionAmountChange(
      newAmount: number,
      strategy: 'redistribute' | 'keep'
    ): void,

    // Persistence
    saveChanges(): Promise<boolean>,   // Batch: update/create/delete debts

    // Validation
    isBalanced: ComputedRef<boolean>,  // myShare + participants === transactionAmount
    totalAssigned: ComputedRef<number>,
  }
}

interface SplitParticipantView {
  debtId: string;
  personName: string;
  amount: number;             // Total owed
  paidAmount: number;         // How much already paid
  remainingAmount: number;
  isClosed: boolean;
  hasPayments: boolean;       // paidAmount > 0
  isLocked: boolean;          // hasPayments === true
  isNew: boolean;             // Added during this edit session
}
```

### Component: SplitParticipantList

Renders the list of participants with inline editing.

**Props**: `participants: SplitParticipantView[]`, `editable: boolean`, `currency: string`
**Emits**: `update-amount`, `update-name`, `remove`, `add`

**Rendering per participant**:
- Avatar (InitialAvatar or colored circle)
- Name (editable if unlocked, text if locked)
- Payment status badge: "Не оплачено" (green), "Оплачено X / Y" (amber), "Закрыт" (gray)
- Amount (editable input if unlocked, display if locked)
- Lock icon (🔒) if has payments, edit icon (✏️) if editable
- Delete button (only if no payments)

**"Add participant" row**: text input + amount, appears at bottom.

### Modified: EditTransactionModal

**Key changes**:

1. **Remove protected mode for split transactions** — replace read-only view with full editing + split section.

2. **Load split data**: on mount, call `useSplitTransactionEdit(transaction.id, userId, amount)`.

3. **Conditional split section**: if `hasSplit`, render `SplitParticipantList` below transaction fields.

4. **Amount change intercept**: when user changes transaction amount and `hasSplit`:
   - Show confirmation dialog: "Сумма изменилась. Пересчитать доли поровну или оставить как есть?"
   - Options: "Поровну" → `handleTransactionAmountChange(newAmount, 'redistribute')`, "Оставить" → `handleTransactionAmountChange(newAmount, 'keep')`
   - Locked participants are never recalculated in either strategy.

5. **Save flow**:
   - Update transaction (existing logic)
   - Call `splitEdit.saveChanges()` to batch update/create/delete debts
   - Invalidate transaction + debt caches

6. **Delete flow**:
   - If has open split debts: confirmation "Будут удалены X незакрытых долгов"
   - Proceed with delete (backend cascades via `DeleteDebtCommand`)

### Amount Redistribution Logic

When transaction amount changes from `oldAmount` to `newAmount`:

**Strategy: "redistribute" (поровну)**
1. Separate participants into `locked` (has payments) and `unlocked`
2. `lockedTotal` = sum of locked participant amounts
3. `availableForRedistribution` = `newAmount` - `lockedTotal`
4. Count = unlocked participants + (1 if user participates)
5. Each unlocked participant gets `availableForRedistribution / count`
6. User's share = remainder

**Strategy: "keep" (оставить как есть)**
1. All participant amounts stay the same
2. User's share = `newAmount` - sum(all participant amounts)
3. If user's share < 0: show warning "Сумма транзакции меньше суммы долей участников"

### Delete Transaction with Split

When deleting a transaction that has split debts:

1. Check for open (unclosed) debts linked via `source_transaction_id`
2. If open debts exist: show `ConfirmDeleteModal` with message "Эта транзакция связана с {N} незакрытыми долгами. Они тоже будут удалены."
3. On confirm: delete transaction → backend `DeleteDebtCommand` cascades cleanup of linked debts (already implemented — checks `sourceTransactionId` and deletes if last reference)

---

## Data Flow Summary

### Edit Debt Flow
```
DebtDetailPage → click Edit → open EditDebtDrawer
  → user edits fields → warnings shown contextually
  → click Save → useEditDebt.submit()
  → PATCH /api/debts/:id → invalidate debt cache
  → close drawer, refresh detail page
```

### View/Edit Split on Transaction
```
TransactionItem → click → open EditTransactionModal
  → useSplitTransactionEdit loads linked debts
  → if hasSplit: show SplitParticipantList section
  → user can: edit unlocked participants, add new, remove without payments
  → if amount changes: show redistribution dialog
  → click Save → update transaction + saveChanges (batch debt ops)
  → invalidate transaction + debt caches
```

---

## Out of Scope

- Adding split to a transaction that doesn't have one (use AddTransactionPage for new splits)
- Splitting income transactions (only expense supported)
- Split across different currencies
- Notifications to participants about changes
