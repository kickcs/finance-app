# Edit Debt & Split Expense Viewing/Editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable editing debts after creation and viewing/editing split expense details on transactions.

**Architecture:** Two independent frontend features. Feature 1 creates `features/edit-debt/` with a vaul-vue drawer (following `CreateDebtDrawer` pattern). Feature 2 extends `EditTransactionModal` with a split participant section and creates `useSplitTransactionEdit` composable + `SplitParticipantList` component inside `features/split-expense/`.

**Tech Stack:** Vue 3, TypeScript, TanStack Vue Query, vaul-vue, Tailwind CSS v4, Reka UI

**Linear Issues:** XDS-14 (Edit Debt), XDS-15 (Split Expense View/Edit)

**Spec:** `docs/superpowers/specs/2026-03-25-edit-debt-and-split-expense-design.md`

---

## File Structure

### Feature 1: Edit Debt (XDS-14)

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `frontend/src/features/edit-debt/model/useEditDebt.ts` | Form state, validation, diff-based submit |
| Create | `frontend/src/features/edit-debt/ui/EditDebtDrawer.vue` | Responsive vaul-vue drawer with edit form |
| Create | `frontend/src/features/edit-debt/ui/index.ts` | UI barrel export |
| Create | `frontend/src/features/edit-debt/index.ts` | Feature barrel export |
| Modify | `frontend/src/pages/debts/detail/DebtDetailPage.vue:59-61` | Replace toast with drawer |

### Feature 2: Split Expense View/Edit (XDS-15)

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `frontend/src/features/split-expense/model/useSplitTransactionEdit.ts` | Load/manage split debts for a transaction |
| Create | `frontend/src/features/split-expense/ui/SplitParticipantList.vue` | Participant list with inline editing |
| Modify | `frontend/src/features/split-expense/index.ts` | Add new exports |
| Modify | `frontend/src/features/edit-transaction/ui/EditTransactionModal.vue` | Add split section, replace protected mode |
| Modify | `frontend/src/features/edit-transaction/model/useTransactionSelection.ts` | Load ALL split debts (not just open) |
| Modify | `frontend/src/features/edit-transaction/model/useTransactionEditFlow.ts` | Pass split debts data, handle split save |

---

## Task 1: Create `useEditDebt` composable

**Files:**
- Create: `frontend/src/features/edit-debt/model/useEditDebt.ts`

- [ ] **Step 1: Create the composable**

```typescript
// frontend/src/features/edit-debt/model/useEditDebt.ts
import { ref, computed, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { useDebts, type Debt, type DebtDirection } from '@/entities/debt';
import { useToast } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';

export interface EditDebtFormData {
  debt_type: DebtDirection;
  person_name: string;
  total_amount: number;
  remaining_amount: number;
  account_id: string | null;
  monthly_payment: number | null;
  next_payment_date: string | null;
  description: string;
  is_private: boolean;
}

export function useEditDebt(
  debt: MaybeRefOrGetter<Debt | null>,
  userId: MaybeRefOrGetter<string | null>,
) {
  const { updateDebt } = useDebts(userId);
  const { toast } = useToast();
  const { trigger } = useHaptics();

  const formData = ref<EditDebtFormData>(makeFormData(toValue(debt)));
  const isSubmitting = ref(false);

  // Track original values for diff
  const originalData = ref<EditDebtFormData>(makeFormData(toValue(debt)));

  function makeFormData(d: Debt | null): EditDebtFormData {
    return {
      debt_type: (d?.debt_type as DebtDirection) ?? 'taken',
      person_name: d?.person_name ?? '',
      total_amount: d?.total_amount ?? 0,
      remaining_amount: d?.remaining_amount ?? 0,
      account_id: d?.account_id ?? null,
      monthly_payment: d?.monthly_payment ?? null,
      next_payment_date: d?.next_payment_date ?? null,
      description: d?.description ?? '',
      is_private: d?.is_private ?? false,
    };
  }

  // Re-init when debt changes
  watch(
    () => toValue(debt),
    (d) => {
      if (d) {
        formData.value = makeFormData(d);
        originalData.value = makeFormData(d);
      }
    },
    { immediate: true },
  );

  const isValid = computed(() => {
    return (
      formData.value.person_name.trim().length > 0 &&
      formData.value.total_amount > 0 &&
      formData.value.remaining_amount >= 0 &&
      formData.value.remaining_amount <= formData.value.total_amount
    );
  });

  const isDirty = computed(() => {
    return JSON.stringify(formData.value) !== JSON.stringify(originalData.value);
  });

  const warnings = computed(() => {
    const result: string[] = [];
    if (formData.value.total_amount !== originalData.value.total_amount) {
      result.push('Изменение суммы не повлияет на уже созданные транзакции платежей');
    }
    if (formData.value.debt_type !== originalData.value.debt_type) {
      result.push('Направление долга изменится');
    }
    return result;
  });

  function updateField<K extends keyof EditDebtFormData>(field: K, value: EditDebtFormData[K]) {
    formData.value[field] = value;

    // Auto-correct remaining if exceeds total
    if (field === 'total_amount' && formData.value.remaining_amount > formData.value.total_amount) {
      formData.value.remaining_amount = formData.value.total_amount;
    }
  }

  async function submit(): Promise<boolean> {
    const d = toValue(debt);
    if (!d || !isValid.value || !isDirty.value) return false;

    isSubmitting.value = true;
    try {
      // Build diff — only send changed fields
      const updates: Partial<Debt> = {};
      const f = formData.value;
      const o = originalData.value;

      if (f.debt_type !== o.debt_type) updates.debt_type = f.debt_type;
      if (f.person_name !== o.person_name) updates.person_name = f.person_name;
      if (f.total_amount !== o.total_amount) updates.total_amount = f.total_amount;
      if (f.remaining_amount !== o.remaining_amount) updates.remaining_amount = f.remaining_amount;
      if (f.account_id !== o.account_id) updates.account_id = f.account_id;
      if (f.monthly_payment !== o.monthly_payment) updates.monthly_payment = f.monthly_payment;
      if (f.next_payment_date !== o.next_payment_date)
        updates.next_payment_date = f.next_payment_date;
      if (f.description !== o.description) updates.description = f.description || null;
      if (f.is_private !== o.is_private) updates.is_private = f.is_private;

      // Also update the name if person_name or debt_type changed
      if (updates.person_name !== undefined || updates.debt_type !== undefined) {
        const { buildDebtName } = await import('@/entities/debt');
        updates.name = buildDebtName(f.debt_type, f.person_name);
      }

      await updateDebt(d.id, updates);
      trigger('success');
      toast({ title: 'Долг обновлён' });
      return true;
    } catch {
      toast({ title: 'Не удалось обновить долг', variant: 'destructive' });
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  function reset() {
    formData.value = makeFormData(toValue(debt));
    originalData.value = makeFormData(toValue(debt));
  }

  return {
    formData,
    isValid,
    isDirty,
    isSubmitting,
    warnings,
    updateField,
    submit,
    reset,
  };
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd frontend && bunx vue-tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `useEditDebt`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/edit-debt/model/useEditDebt.ts
git commit -m "feat(edit-debt): add useEditDebt composable with diff-based submit"
```

---

## Task 2: Create `EditDebtDrawer` component

**Files:**
- Create: `frontend/src/features/edit-debt/ui/EditDebtDrawer.vue`
- Create: `frontend/src/features/edit-debt/ui/index.ts`
- Create: `frontend/src/features/edit-debt/index.ts`

- [ ] **Step 1: Create the drawer component**

```vue
<!-- frontend/src/features/edit-debt/ui/EditDebtDrawer.vue -->
<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UInput, UButton, UTabs, UIcon } from '@/shared/ui';
import { DEBT_DIRECTION_LABELS, type Debt } from '@/entities/debt';
import { getCurrencySymbol } from '@/shared/lib/format/currency';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useDrawerKeyboard } from '@/shared/lib/composables';
import { useEditDebt } from '../model/useEditDebt';
import type { AccountWithBalances } from '@/entities/account';
import DatePickerField from '@/features/create-debt/ui/DatePickerField.vue';
import ToggleRow from '@/features/create-debt/ui/ToggleRow.vue';
import { SelectChips } from '@/shared/ui';

const props = defineProps<{
  open: boolean;
  debt: Debt | null;
  accounts: AccountWithBalances[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  saved: [];
}>();

const isDesktop = useIsDesktop();
const { userId } = useCurrentUser();
const { formData, isValid, isDirty, isSubmitting, warnings, updateField, submit, reset } =
  useEditDebt(
    () => props.debt,
    userId,
  );

// Refs for keyboard handling
const drawerContentRef = ref<InstanceType<typeof DrawerContent> | null>(null);
const footerRef = ref<HTMLDivElement | null>(null);
const scrollContainerRef = ref<HTMLDivElement | null>(null);
const calendarPortalRef = ref<HTMLElement | null>(null);

const { setupKeyboardListener, cleanupKeyboardListener } = useDrawerKeyboard(
  drawerContentRef,
  footerRef,
  scrollContainerRef,
);

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      if (!props.open) return;
      if (!isDesktop.value) setupKeyboardListener();
    } else {
      cleanupKeyboardListener();
      nextTick(reset);
    }
  },
);

const debtTypeItems = [
  { id: 'given', label: DEBT_DIRECTION_LABELS.given },
  { id: 'taken', label: DEBT_DIRECTION_LABELS.taken },
];

const currencySymbol = computed(() =>
  props.debt ? getCurrencySymbol(props.debt.currency) : '',
);

const accountOptions = computed(() =>
  props.accounts.map((a) => ({ id: a.id, label: a.name })),
);

async function handleSubmit() {
  const success = await submit();
  if (success) {
    emit('saved');
    emit('update:open', false);
  }
}
</script>

<template>
  <DrawerRoot
    :open="open"
    :direction="isDesktop ? 'right' : 'bottom'"
    @update:open="emit('update:open', $event)"
  >
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DrawerContent
        ref="drawerContentRef"
        :class="[
          'fixed z-50 flex flex-col bg-surface-light dark:bg-surface-dark outline-none',
          isDesktop
            ? 'right-0 top-0 bottom-0 w-[420px] rounded-l-2xl'
            : 'bottom-0 left-0 right-0 rounded-t-2xl max-h-[90dvh]',
        ]"
      >
        <!-- Handle (mobile) -->
        <DrawerHandle v-if="!isDesktop" class="mx-auto mt-2 mb-1" />

        <!-- Header -->
        <div class="flex items-center justify-between px-5 pt-3 pb-4">
          <DrawerTitle class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
            Редактировать долг
          </DrawerTitle>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full bg-surface-secondary-light dark:bg-surface-secondary-dark"
            @click="emit('update:open', false)"
          >
            <UIcon name="close" size="sm" class="text-text-secondary-light dark:text-text-secondary-dark" />
          </button>
        </div>

        <!-- Scrollable Content -->
        <div
          ref="scrollContainerRef"
          class="flex-1 overflow-y-auto overscroll-contain px-5 space-y-5"
          data-vaul-no-drag
        >
          <!-- Debt Type -->
          <div>
            <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block">
              Тип долга
            </label>
            <UTabs
              :model-value="formData.debt_type"
              :items="debtTypeItems"
              @update:model-value="updateField('debt_type', $event as 'given' | 'taken')"
            />
          </div>

          <!-- Person Name -->
          <UInput
            :model-value="formData.person_name"
            label="Кому / от кого"
            placeholder="Имя"
            @update:model-value="updateField('person_name', String($event))"
          />

          <!-- Total Amount -->
          <UInput
            :model-value="String(formData.total_amount || '')"
            label="Общая сумма"
            placeholder="0"
            variant="currency"
            type="number"
            :suffix="debt?.currency"
            @update:model-value="updateField('total_amount', Number($event) || 0)"
          />

          <!-- Remaining Amount -->
          <UInput
            :model-value="String(formData.remaining_amount || '')"
            label="Остаток"
            placeholder="0"
            variant="currency"
            type="number"
            :suffix="debt?.currency"
            @update:model-value="updateField('remaining_amount', Number($event) || 0)"
          />

          <!-- Account -->
          <div>
            <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block">
              Счёт
            </label>
            <SelectChips
              :options="accountOptions"
              :model-value="formData.account_id"
              @update:model-value="updateField('account_id', $event)"
            />
          </div>

          <!-- Monthly Payment -->
          <UInput
            :model-value="String(formData.monthly_payment ?? '')"
            label="Ежемесячный платёж"
            placeholder="Не указан"
            variant="currency"
            type="number"
            :suffix="debt?.currency"
            @update:model-value="updateField('monthly_payment', $event ? Number($event) : null)"
          />

          <!-- Next Payment Date -->
          <DatePickerField
            :model-value="formData.next_payment_date"
            placeholder="Дата следующего платежа"
            clearable
            :portal-to="calendarPortalRef"
            @update:model-value="updateField('next_payment_date', $event)"
          />

          <!-- Description -->
          <UInput
            :model-value="formData.description"
            label="Описание"
            placeholder="Описание..."
            @update:model-value="updateField('description', String($event))"
          />

          <!-- Warnings -->
          <div
            v-for="(warning, idx) in warnings"
            :key="idx"
            class="p-2.5 rounded-lg bg-warning-light border border-warning/20"
          >
            <div class="flex gap-1.5">
              <UIcon name="warning" size="xs" class="text-warning shrink-0 mt-0.5" />
              <p class="text-xs text-warning">{{ warning }}</p>
            </div>
          </div>

          <!-- Private Toggle -->
          <ToggleRow
            v-model="formData.is_private"
            title="Приватный"
            description="Скрыть долг из общего списка"
          />
        </div>

        <!-- Calendar Portal -->
        <div ref="calendarPortalRef" />

        <!-- Footer -->
        <div ref="footerRef" class="px-5 pt-3 pb-5 safe-area-inset-bottom">
          <UButton
            variant="primary"
            size="md"
            full-width
            :loading="isSubmitting"
            :disabled="!isValid || !isDirty"
            @click="handleSubmit"
          >
            Сохранить
          </UButton>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
```

- [ ] **Step 2: Create barrel exports**

```typescript
// frontend/src/features/edit-debt/ui/index.ts
export { default as EditDebtDrawer } from './EditDebtDrawer.vue';
```

```typescript
// frontend/src/features/edit-debt/index.ts
export { EditDebtDrawer } from './ui';
export { useEditDebt, type EditDebtFormData } from './model/useEditDebt';
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `cd frontend && bunx vue-tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to `EditDebtDrawer`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/edit-debt/
git commit -m "feat(edit-debt): add EditDebtDrawer component with responsive layout"
```

---

## Task 3: Integrate `EditDebtDrawer` into `DebtDetailPage`

**Files:**
- Modify: `frontend/src/pages/debts/detail/DebtDetailPage.vue:59-61`

- [ ] **Step 1: Replace toast with drawer**

In `frontend/src/pages/debts/detail/DebtDetailPage.vue`:

Add import:
```typescript
import { EditDebtDrawer } from '@/features/edit-debt';
```

Replace `handleEdit()` function (line 59-61):
```typescript
// OLD:
function handleEdit() {
  toast({ title: 'Редактирование пока недоступно' });
}

// NEW:
const showEditDrawer = ref(false);
function handleEdit() {
  showEditDrawer.value = true;
}
```

Add drawer to template after `PartialPaymentModal` (after line 143):
```vue
<!-- Edit Debt Drawer -->
<EditDebtDrawer
  :open="showEditDrawer"
  :debt="debt"
  :accounts="accounts"
  @update:open="showEditDrawer = $event"
  @saved="showEditDrawer = false"
/>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd frontend && bunx vue-tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Manual smoke test**

Run: `cd frontend && bun run dev`
1. Navigate to Debts → click a debt → click Edit
2. Verify drawer opens with prefilled data
3. Change a field → verify warning appears → click Save
4. Verify debt updates and drawer closes

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/debts/detail/DebtDetailPage.vue
git commit -m "feat(edit-debt): integrate EditDebtDrawer into DebtDetailPage"
```

---

## Task 4: Create `useSplitTransactionEdit` composable

**Files:**
- Create: `frontend/src/features/split-expense/model/useSplitTransactionEdit.ts`

- [ ] **Step 1: Create the composable**

```typescript
// frontend/src/features/split-expense/model/useSplitTransactionEdit.ts
import { ref, computed, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { debtsApi, debtQueryKeys, buildDebtName, type Debt } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { useToast } from '@/shared/ui';

export interface SplitParticipantView {
  debtId: string;
  personName: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  isClosed: boolean;
  hasPayments: boolean;
  isLocked: boolean;
  isNew: boolean;
}

interface PendingAdd {
  personName: string;
  amount: number;
}

interface PendingUpdate {
  amount?: number;
  personName?: string;
}

export function useSplitTransactionEdit(
  transactionId: MaybeRefOrGetter<string | null>,
  userId: MaybeRefOrGetter<string | null>,
  transactionAmount: MaybeRefOrGetter<number>,
) {
  const { toast } = useToast();

  const splitDebts = ref<Debt[]>([]);
  const isLoading = ref(false);

  // Track local changes
  const pendingAdds = ref<PendingAdd[]>([]);
  const pendingDeletes = ref<Set<string>>(new Set());
  const pendingUpdates = ref<Map<string, PendingUpdate>>(new Map());

  const hasSplit = computed(() => splitDebts.value.length > 0 || pendingAdds.value.length > 0);

  // Load split debts for transaction
  async function loadSplitDebts() {
    const txId = toValue(transactionId);
    const uid = toValue(userId);
    if (!txId || !uid) {
      splitDebts.value = [];
      return;
    }

    isLoading.value = true;
    try {
      // Try to read from query cache first
      const cached = queryClient.getQueryData<Debt[]>(debtQueryKeys.list(uid));
      if (cached) {
        splitDebts.value = cached.filter((d) => d.source_transaction_id === txId);
      } else {
        const allDebts = await debtsApi.getAll();
        splitDebts.value = allDebts.filter((d) => d.source_transaction_id === txId);
      }
    } catch {
      splitDebts.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  watch(
    () => toValue(transactionId),
    () => {
      resetLocal();
      loadSplitDebts();
    },
    { immediate: true },
  );

  // Build participant views
  const participants = computed<SplitParticipantView[]>(() => {
    const existing = splitDebts.value
      .filter((d) => !pendingDeletes.value.has(d.id))
      .map((d) => {
        const update = pendingUpdates.value.get(d.id);
        const paidAmount = d.total_amount - d.remaining_amount;
        return {
          debtId: d.id,
          personName: update?.personName ?? d.person_name ?? '',
          amount: update?.amount ?? d.total_amount,
          paidAmount,
          remainingAmount: d.remaining_amount,
          isClosed: d.is_closed,
          hasPayments: paidAmount > 0,
          isLocked: paidAmount > 0,
          isNew: false,
        };
      });

    const added = pendingAdds.value.map((a, i) => ({
      debtId: `new-${i}`,
      personName: a.personName,
      amount: a.amount,
      paidAmount: 0,
      remainingAmount: a.amount,
      isClosed: false,
      hasPayments: false,
      isLocked: false,
      isNew: true,
    }));

    return [...existing, ...added];
  });

  const myShare = computed(() => {
    const total = toValue(transactionAmount);
    const participantTotal = participants.value.reduce((sum, p) => sum + p.amount, 0);
    return total - participantTotal;
  });

  const totalAssigned = computed(() => {
    return participants.value.reduce((sum, p) => sum + p.amount, 0) + Math.max(0, myShare.value);
  });

  const isBalanced = computed(() => {
    return Math.abs(totalAssigned.value - toValue(transactionAmount)) <= 1;
  });

  const lockedParticipantIds = computed(() =>
    participants.value.filter((p) => p.isLocked).map((p) => p.debtId),
  );

  function canEditParticipant(debtId: string): boolean {
    const p = participants.value.find((x) => x.debtId === debtId);
    return p ? !p.isLocked : false;
  }

  function canDeleteParticipant(debtId: string): boolean {
    return canEditParticipant(debtId);
  }

  function updateParticipantAmount(debtId: string, amount: number) {
    if (!canEditParticipant(debtId)) return;

    const p = participants.value.find((x) => x.debtId === debtId);
    if (!p) return;

    if (p.isNew) {
      const idx = pendingAdds.value.findIndex((_, i) => `new-${i}` === debtId);
      if (idx > -1) pendingAdds.value[idx].amount = Math.max(0, amount);
    } else {
      const existing = pendingUpdates.value.get(debtId) ?? {};
      pendingUpdates.value.set(debtId, { ...existing, amount: Math.max(0, amount) });
    }
  }

  function updateParticipantName(debtId: string, name: string) {
    if (!canEditParticipant(debtId) || !name.trim()) return;

    const p = participants.value.find((x) => x.debtId === debtId);
    if (!p) return;

    if (p.isNew) {
      const idx = pendingAdds.value.findIndex((_, i) => `new-${i}` === debtId);
      if (idx > -1) pendingAdds.value[idx].personName = name.trim();
    } else {
      const existing = pendingUpdates.value.get(debtId) ?? {};
      pendingUpdates.value.set(debtId, { ...existing, personName: name.trim() });
    }
  }

  function addParticipant(name: string, amount: number) {
    if (!name.trim()) return;
    pendingAdds.value.push({ personName: name.trim(), amount: Math.max(0, amount) });
  }

  function removeParticipant(debtId: string) {
    if (!canDeleteParticipant(debtId)) return;

    const p = participants.value.find((x) => x.debtId === debtId);
    if (!p) return;

    if (p.isNew) {
      const idx = pendingAdds.value.findIndex((_, i) => `new-${i}` === debtId);
      if (idx > -1) pendingAdds.value.splice(idx, 1);
    } else {
      pendingDeletes.value.add(debtId);
      pendingUpdates.value.delete(debtId);
    }
  }

  function handleTransactionAmountChange(
    newAmount: number,
    strategy: 'redistribute' | 'keep',
  ) {
    if (strategy === 'keep') {
      // Keep all participant amounts, myShare absorbs the difference
      return;
    }

    // Redistribute: only change unlocked participants
    const locked = participants.value.filter((p) => p.isLocked);
    const unlocked = participants.value.filter((p) => !p.isLocked);

    const lockedTotal = locked.reduce((sum, p) => sum + p.amount, 0);
    const availableForRedistribution = newAmount - lockedTotal;

    // Count = unlocked participants + user's share
    const count = unlocked.length + 1; // +1 for user
    if (count <= 0) return;

    const sharePerPerson = Math.floor(availableForRedistribution / count);

    for (const p of unlocked) {
      updateParticipantAmount(p.debtId, sharePerPerson);
    }
    // myShare is computed automatically as remainder
  }

  async function saveChanges(): Promise<boolean> {
    const uid = toValue(userId);
    const txId = toValue(transactionId);
    if (!uid || !txId) return false;

    try {
      // 1. Delete removed debts
      for (const debtId of pendingDeletes.value) {
        await debtsApi.delete(debtId);
      }

      // 2. Update modified debts
      for (const [debtId, update] of pendingUpdates.value) {
        const debt = splitDebts.value.find((d) => d.id === debtId);
        if (!debt) continue;

        const updates: Partial<Debt> = {};
        if (update.amount !== undefined) {
          updates.total_amount = update.amount;
          updates.remaining_amount = update.amount; // Reset remaining for unlocke debts (no payments)
        }
        if (update.personName !== undefined) {
          updates.person_name = update.personName;
          updates.name = buildDebtName('given', update.personName);
        }

        if (Object.keys(updates).length > 0) {
          await debtsApi.update(debtId, updates);
        }
      }

      // 3. Create new debts
      for (const add of pendingAdds.value) {
        if (add.amount <= 0) continue;

        const debt = splitDebts.value[0]; // Use first debt as template for currency/account
        await debtsApi.create({
          user_id: uid,
          name: buildDebtName('given', add.personName),
          total_amount: add.amount,
          remaining_amount: add.amount,
          debt_type: 'given',
          person_name: add.personName,
          account_id: debt?.account_id ?? '',
          transaction_id: null,
          source_transaction_id: txId,
          is_closed: false,
          currency: debt?.currency ?? 'UZS',
          created_at: new Date().toISOString(),
        });
      }

      // 4. Invalidate caches
      await queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(uid) });

      resetLocal();
      return true;
    } catch {
      toast({ title: 'Не удалось сохранить изменения', variant: 'destructive' });
      return false;
    }
  }

  function resetLocal() {
    pendingAdds.value = [];
    pendingDeletes.value = new Set();
    pendingUpdates.value = new Map();
  }

  return {
    splitDebts,
    hasSplit,
    isLoading,
    participants,
    myShare,
    totalAssigned,
    isBalanced,
    lockedParticipantIds,
    canEditParticipant,
    canDeleteParticipant,
    updateParticipantAmount,
    updateParticipantName,
    addParticipant,
    removeParticipant,
    handleTransactionAmountChange,
    saveChanges,
    loadSplitDebts,
  };
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd frontend && bunx vue-tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/split-expense/model/useSplitTransactionEdit.ts
git commit -m "feat(split-expense): add useSplitTransactionEdit composable"
```

---

## Task 5: Create `SplitParticipantList` component

**Files:**
- Create: `frontend/src/features/split-expense/ui/SplitParticipantList.vue`
- Modify: `frontend/src/features/split-expense/index.ts`

- [ ] **Step 1: Create the component**

```vue
<!-- frontend/src/features/split-expense/ui/SplitParticipantList.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { UInput, UButton, UIcon, InitialAvatar } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { SplitParticipantView } from '../model/useSplitTransactionEdit';

defineProps<{
  participants: SplitParticipantView[];
  myShare: number;
  currency: string;
  editable?: boolean;
}>();

const emit = defineEmits<{
  'update-amount': [debtId: string, amount: number];
  'update-name': [debtId: string, name: string];
  remove: [debtId: string];
  add: [name: string, amount: number];
}>();

const newName = ref('');
const newAmount = ref(0);

function handleAdd() {
  if (!newName.value.trim() || newAmount.value <= 0) return;
  emit('add', newName.value.trim(), newAmount.value);
  newName.value = '';
  newAmount.value = 0;
}
</script>

<template>
  <div class="space-y-2">
    <!-- Header -->
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <UIcon name="group" size="sm" class="text-text-secondary-light dark:text-text-secondary-dark" />
        <span class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
          Разделение расхода
        </span>
      </div>
      <span class="text-xs text-accent-green bg-accent-green/10 px-2 py-0.5 rounded-md">
        {{ participants.length + 1 }} участн.
      </span>
    </div>

    <!-- My Share -->
    <div class="flex items-center justify-between p-2.5 rounded-lg bg-surface-secondary-light dark:bg-surface-secondary-dark">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs text-white font-medium">
          Я
        </div>
        <span class="text-sm text-text-primary-light dark:text-text-primary-dark">Моя доля</span>
      </div>
      <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        {{ formatCurrency(myShare, currency) }}
      </span>
    </div>

    <!-- Participant rows -->
    <div
      v-for="p in participants"
      :key="p.debtId"
      class="flex items-center justify-between p-2.5 rounded-lg bg-surface-secondary-light dark:bg-surface-secondary-dark"
    >
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <InitialAvatar :name="p.personName" size="sm" />
        <div class="min-w-0">
          <div class="text-sm text-text-primary-light dark:text-text-primary-dark truncate">
            {{ p.personName }}
          </div>
          <div
            v-if="p.hasPayments"
            class="text-[11px] text-warning"
          >
            Оплачено {{ formatCurrency(p.paidAmount, currency) }} / {{ formatCurrency(p.amount, currency) }}
          </div>
          <div
            v-else-if="p.isClosed"
            class="text-[11px] text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            Закрыт
          </div>
          <div v-else class="text-[11px] text-accent-green">
            Не оплачено
          </div>
        </div>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Amount: editable or display -->
        <template v-if="editable && !p.isLocked">
          <input
            :value="p.amount"
            type="number"
            class="w-20 text-right text-sm font-medium bg-transparent border-b border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark outline-none px-1 py-0.5"
            @input="emit('update-amount', p.debtId, Number(($event.target as HTMLInputElement).value) || 0)"
          />
          <button
            class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-danger/10 transition-colors"
            @click="emit('remove', p.debtId)"
          >
            <UIcon name="close" size="xs" class="text-danger" />
          </button>
        </template>
        <template v-else>
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ formatCurrency(p.amount, currency) }}
          </span>
          <UIcon
            v-if="p.isLocked"
            name="lock"
            size="xs"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </template>
      </div>
    </div>

    <!-- Warning for locked participants -->
    <div
      v-if="participants.some((p) => p.isLocked)"
      class="p-2 rounded-lg bg-warning-light border border-warning/20"
    >
      <div class="flex gap-1.5">
        <UIcon name="info" size="xs" class="text-warning shrink-0 mt-0.5" />
        <p class="text-[11px] text-warning leading-relaxed">
          Участники с платежами заблокированы для редактирования
        </p>
      </div>
    </div>

    <!-- Add participant -->
    <div v-if="editable" class="flex gap-2 pt-1">
      <UInput
        v-model="newName"
        placeholder="Имя"
        class="flex-1"
        @keyup.enter="handleAdd"
      />
      <input
        v-model.number="newAmount"
        type="number"
        placeholder="Сумма"
        class="w-24 text-sm px-2.5 py-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark outline-none"
        @keyup.enter="handleAdd"
      />
      <UButton
        variant="secondary"
        size="sm"
        :disabled="!newName.trim() || newAmount <= 0"
        @click="handleAdd"
      >
        <UIcon name="add" size="xs" />
      </UButton>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Update barrel export**

In `frontend/src/features/split-expense/index.ts`, add:
```typescript
export { default as SplitParticipantList } from './ui/SplitParticipantList.vue';
export { useSplitTransactionEdit, type SplitParticipantView } from './model/useSplitTransactionEdit';
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `cd frontend && bunx vue-tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/split-expense/
git commit -m "feat(split-expense): add SplitParticipantList and useSplitTransactionEdit"
```

---

## Task 6: Update `useTransactionSelection` to load all split debts

**Files:**
- Modify: `frontend/src/features/edit-transaction/model/useTransactionSelection.ts`

- [ ] **Step 1: Expand to return split debt data**

Replace `frontend/src/features/edit-transaction/model/useTransactionSelection.ts`:

```typescript
import { ref, type MaybeRefOrGetter, toValue } from 'vue';
import { debtsApi, type Debt } from '@/entities/debt';
import type { Transaction } from '@/shared/api/database.types';

export function useTransactionSelection(userId: MaybeRefOrGetter<string | null>) {
  const selectedTransaction = ref<Transaction | null>(null);
  const hasSplitDebts = ref(false);
  const splitDebts = ref<Debt[]>([]);
  const showEditModal = ref(false);

  async function select(transaction: Transaction) {
    selectedTransaction.value = transaction;
    hasSplitDebts.value = false;
    splitDebts.value = [];

    const uid = toValue(userId);
    if (!transaction.is_debt_related && uid) {
      try {
        const allDebts = await debtsApi.getAll(uid);
        const linked = allDebts.filter(
          (d) => d.source_transaction_id === transaction.id,
        );
        splitDebts.value = linked;
        hasSplitDebts.value = linked.some((d) => !d.is_closed);
      } catch {
        hasSplitDebts.value = false;
        splitDebts.value = [];
      }
    }

    showEditModal.value = true;
  }

  function close() {
    showEditModal.value = false;
  }

  return { selectedTransaction, hasSplitDebts, splitDebts, showEditModal, select, close };
}
```

Key changes:
- Added `splitDebts` ref that holds ALL linked debts (not just open)
- `hasSplitDebts` still checks for open debts only (for backward compat)
- Removed `!d.is_closed` filter from `splitDebts` — we show all participants including closed

- [ ] **Step 2: Update `useTransactionEditFlow` to pass splitDebts**

In `frontend/src/features/edit-transaction/model/useTransactionEditFlow.ts`, add `splitDebts` to destructuring:

```typescript
const {
  selectedTransaction,
  hasSplitDebts,
  splitDebts,  // ADD THIS
  showEditModal,
  select: handleTransactionClick,
  close: closeEditModal,
} = useTransactionSelection(userId);
```

And add `splitDebts` to the return:

```typescript
return {
  selectedTransaction,
  hasSplitDebts,
  splitDebts,  // ADD THIS
  // ... rest unchanged
};
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `cd frontend && bunx vue-tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/edit-transaction/model/useTransactionSelection.ts frontend/src/features/edit-transaction/model/useTransactionEditFlow.ts
git commit -m "feat(edit-transaction): load all split debts in transaction selection"
```

---

## Task 7: Extend `EditTransactionModal` with split section

**Files:**
- Modify: `frontend/src/features/edit-transaction/ui/EditTransactionModal.vue`

- [ ] **Step 1: Add split section to EditTransactionModal**

This is the main change. Modify `EditTransactionModal.vue`:

**Add imports** (after existing imports):
```typescript
import { SplitParticipantList, useSplitTransactionEdit } from '@/features/split-expense';
import type { Debt } from '@/entities/debt';
```

**Add new prop** — add `splitDebts` to props:
```typescript
const props = defineProps<{
  modelValue: boolean;
  transaction: Transaction | null;
  accounts: AccountWithBalances[];
  currency: string;
  isUpdating?: boolean;
  error?: string | null;
  hasSplitDebts?: boolean;
  splitDebts?: Debt[];  // ADD
}>();
```

**Add new emit** — `splitSaved` for split changes:
```typescript
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [updates: Partial<Transaction>];
  cancel: [];
  delete: [];
  'split-saved': [];  // ADD
}>();
```

**Add split composable** (after existing composables):
```typescript
const splitEdit = useSplitTransactionEdit(
  () => props.transaction?.id ?? null,
  userId,
  () => amount.value,
);

const showAmountChangeDialog = ref(false);
const pendingNewAmount = ref(0);

function handleAmountInput(value: string | number) {
  const newAmount = Number(value) || 0;

  if (splitEdit.hasSplit.value && newAmount !== amount.value) {
    pendingNewAmount.value = newAmount;
    showAmountChangeDialog.value = true;
  } else {
    amount.value = newAmount;
  }
}

function handleAmountStrategy(strategy: 'redistribute' | 'keep') {
  amount.value = pendingNewAmount.value;
  splitEdit.handleTransactionAmountChange(pendingNewAmount.value, strategy);
  showAmountChangeDialog.value = false;
}
```

**Replace the protected mode template** (lines 129-180) — replace the `isProtected` block with split-aware UI:

Replace:
```html
<!-- Protected Mode (debt-related OR has split debts): View Only -->
<div v-if="isProtected && transaction" class="py-2">
  ...entire protected block...
</div>
```

With:
```html
<!-- Debt-related (non-split) Protected Mode: View Only -->
<div v-if="isDebtRelated && transaction" class="py-2">
  <div class="text-center mb-4">
    <div class="w-12 h-12 mx-auto mb-3 rounded-xl bg-warning-light flex items-center justify-center">
      <UIcon name="account_balance_wallet" size="md" class="text-warning" />
    </div>
    <p class="text-sm text-text-primary-light dark:text-text-primary-dark font-medium mb-0.5">
      Транзакция связана с долгом
    </p>
    <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
      Управляйте долгом в разделе "Долги"
    </p>
  </div>
  <div class="space-y-2 p-3 rounded-lg bg-surface-light dark:bg-surface-dark">
    <div class="flex justify-between items-center">
      <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark">Сумма</span>
      <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        {{ formatCurrency(transaction.amount, transaction.currency) }}
      </span>
    </div>
    <div v-if="transaction.description" class="flex justify-between items-center">
      <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark">Описание</span>
      <span class="text-xs text-text-primary-light dark:text-text-primary-dark">
        {{ transaction.description }}
      </span>
    </div>
  </div>
  <div class="mt-3 p-2.5 rounded-lg bg-warning-light border border-warning/20">
    <div class="flex gap-1.5">
      <UIcon name="info" size="xs" class="text-warning shrink-0 mt-0.5" />
      <p class="text-xs text-warning">
        Эту транзакцию нельзя редактировать или удалять напрямую. Перейдите в раздел "Долги" для управления.
      </p>
    </div>
  </div>
</div>
```

**Update the `isProtected` computed** to exclude split debts (they're now editable):
```typescript
// Change from:
const isProtected = computed(() => isDebtRelated.value || hasSplitDebts.value);
// To:
const isProtected = computed(() => isDebtRelated.value);
```

**Add split section after the regular edit form** (inside the `v-else-if="transaction"` block, after description/date row, before `</div>`):

```html
<!-- Split Expense Section (shown for transactions with splits) -->
<div v-if="splitEdit.hasSplit.value" class="border-t border-border-light dark:border-border-dark pt-4">
  <SplitParticipantList
    :participants="splitEdit.participants.value"
    :my-share="splitEdit.myShare.value"
    :currency="transaction!.currency"
    editable
    @update-amount="splitEdit.updateParticipantAmount"
    @update-name="splitEdit.updateParticipantName"
    @remove="splitEdit.removeParticipant"
    @add="splitEdit.addParticipant"
  />
</div>

<!-- Amount Change Strategy Dialog -->
<div
  v-if="showAmountChangeDialog"
  class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
  @click.self="showAmountChangeDialog = false"
>
  <div class="bg-surface-light dark:bg-surface-dark rounded-xl p-5 mx-4 max-w-sm w-full shadow-xl">
    <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-3">
      Сумма изменилась. Как пересчитать доли?
    </p>
    <div class="flex gap-2">
      <UButton variant="secondary" size="sm" full-width @click="handleAmountStrategy('keep')">
        Оставить как есть
      </UButton>
      <UButton variant="primary" size="sm" full-width @click="handleAmountStrategy('redistribute')">
        Поровну
      </UButton>
    </div>
  </div>
</div>
```

**Update confirm() to also save split changes:**
```typescript
async function confirm() {
  // Save split changes first (if any)
  if (splitEdit.hasSplit.value) {
    const splitSuccess = await splitEdit.saveChanges();
    if (!splitSuccess) return;
    emit('split-saved');
  }

  emit('confirm', {
    type: type.value,
    amount: amount.value,
    account_id: accountId.value,
    category_id: categoryId.value,
    description: description.value || null,
    date: date.value,
  });
}
```

**Update amount input** to use `handleAmountInput` when splits exist:
```html
<!-- Amount (replace existing) -->
<UInput
  :model-value="String(amount)"
  label="Сумма"
  placeholder="0"
  variant="currency"
  type="number"
  :suffix="transaction!.currency"
  @update:model-value="splitEdit.hasSplit.value ? handleAmountInput($event) : (amount = Number($event) || 0)"
/>
```

**Update actions section** — replace `isProtected` with `isDebtRelated`:
```html
<!-- Protected (debt-related ONLY, not split debts) Actions: Close Only -->
<div v-if="isDebtRelated" class="flex gap-2 w-full">
  <UButton variant="secondary" size="sm" full-width @click="close">Закрыть</UButton>
</div>
```

**Add delete confirmation for split transactions** — update the delete emit to warn about cascade:

Add a computed and handler in `<script setup>`:
```typescript
const openSplitDebtsCount = computed(() =>
  splitEdit.participants.value.filter((p) => !p.isClosed && !p.isNew).length,
);

function handleDelete() {
  if (splitEdit.hasSplit.value && openSplitDebtsCount.value > 0) {
    // Show inline confirmation before emitting delete
    showSplitDeleteConfirm.value = true;
  } else {
    emit('delete');
  }
}
const showSplitDeleteConfirm = ref(false);

function confirmSplitDelete() {
  showSplitDeleteConfirm.value = false;
  emit('delete');
}
```

Add confirmation dialog in the template (next to the amount strategy dialog):
```html
<!-- Split Delete Confirmation Dialog -->
<div
  v-if="showSplitDeleteConfirm"
  class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
  @click.self="showSplitDeleteConfirm = false"
>
  <div class="bg-surface-light dark:bg-surface-dark rounded-xl p-5 mx-4 max-w-sm w-full shadow-xl">
    <div class="flex items-center gap-2 mb-2">
      <UIcon name="warning" size="sm" class="text-danger" />
      <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        Удалить транзакцию?
      </p>
    </div>
    <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-4">
      Эта транзакция связана с {{ openSplitDebtsCount }} незакрытыми долгами. Они тоже будут удалены.
    </p>
    <div class="flex gap-2">
      <UButton variant="secondary" size="sm" full-width @click="showSplitDeleteConfirm = false">
        Отмена
      </UButton>
      <UButton variant="primary" size="sm" full-width class="!bg-danger hover:!bg-danger/90" @click="confirmSplitDelete">
        Удалить
      </UButton>
    </div>
  </div>
</div>
```

Replace all `@click="emit('delete')"` in the regular actions section with `@click="handleDelete()"` — this ensures split transactions get the confirmation dialog.

- [ ] **Step 2: Pass splitDebts through pages**

In every page that uses `EditTransactionModal`, add the `split-debts` prop. The key pages are:

**`frontend/src/pages/history/HistoryPage.vue`** — add `:split-debts="splitDebts"` to EditTransactionModal and destructure `splitDebts` from `useTransactionEditFlow`.

**`frontend/src/pages/accounts/AccountDetailPage.vue`** — same pattern if it uses EditTransactionModal.

Search for all usages:
Run: `cd frontend && grep -r "EditTransactionModal" --include="*.vue" -l`

For each page, add `:split-debts="splitDebts"` prop and ensure `splitDebts` is destructured from `useTransactionEditFlow`.

- [ ] **Step 3: Verify no TypeScript errors**

Run: `cd frontend && bunx vue-tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 4: Manual smoke test**

Run: `cd frontend && bun run dev`
1. Create a transaction with split expense
2. Click on the transaction in history
3. Verify split section appears with participants
4. Try editing an unlocked participant's amount
5. Try adding a new participant
6. Change transaction amount → verify strategy dialog
7. Save → verify all changes persist

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/edit-transaction/ frontend/src/pages/
git commit -m "feat(edit-transaction): add split expense viewing and editing in EditTransactionModal"
```

---

## Task 8: Run tests and verify

**Files:** None (validation only)

- [ ] **Step 1: Run frontend build to catch type errors**

Run: `cd frontend && bun run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Run backend tests**

Run: `cd backend && bun run test`
Expected: All tests pass (no backend changes made)

- [ ] **Step 3: Run frontend tests (if any)**

Run: `cd frontend && bun run test 2>&1 | tail -30` (if test script exists)

- [ ] **Step 4: Run /simplify (round 1)**

Run simplify skill on all changed files.

- [ ] **Step 5: Run /simplify (round 2)**

Re-run on remaining issues.

- [ ] **Step 6: Run /simplify (round 3)**

Final simplify pass.

- [ ] **Step 7: Run /crq (round 1)**

Code review on all changed files.

- [ ] **Step 8: Run /crq (round 2)**

Address issues from round 1.

- [ ] **Step 9: Run /crq (round 3)**

Final review pass.

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "fix: address review feedback from simplify and crq passes"
```
