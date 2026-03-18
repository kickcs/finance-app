# Create Debt Drawer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the full-page `DebtForm.vue` at `/debts/new` with `CreateDebtDrawer.vue` — a vaul-vue bottom-sheet drawer opened inline on `DebtsListPage`, adding `is_private` toggle and `due_date` picker (reusing `next_payment_date` column).

**Architecture:** New `CreateDebtDrawer.vue` lives in `features/create-debt/ui/` and is triggered from `DebtsListPage` via `v-model:open`. The backend's `create-debt` chain gains `isPrivate` support (4 files). `AddDebtPage.vue` becomes a redirect stub. All iOS keyboard fixes from `SplitExpenseDrawer.vue` are replicated.

**Tech Stack:** Vue 3 + vaul-vue, TanStack Vue Query, Tailwind CSS v4, NestJS CQRS, class-validator

**Spec:** `docs/superpowers/specs/2026-03-18-create-debt-drawer-redesign.md`

---

## Task 1: Backend — wire `isPrivate` through create chain

**Files:**
- Modify: `backend/src/modules/debt/presentation/dto/create-debt.dto.ts`
- Modify: `backend/src/modules/debt/application/commands/create-debt/create-debt.command.ts`
- Modify: `backend/src/modules/debt/presentation/controllers/debts.controller.ts`
- Modify: `backend/src/modules/debt/application/commands/create-debt/create-debt.handler.ts`

- [ ] **Step 1: Add `isPrivate` to `CreateDebtDto`**

  File: `backend/src/modules/debt/presentation/dto/create-debt.dto.ts`

  Add after `description` field:
  ```typescript
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
  ```
  Import `IsBoolean` is already imported (check — add if missing).

- [ ] **Step 2: Add `isPrivate` to `CreateDebtCommand`**

  File: `backend/src/modules/debt/application/commands/create-debt/create-debt.command.ts`

  Add as last constructor parameter:
  ```typescript
  export class CreateDebtCommand {
    constructor(
      public readonly userId: string,
      public readonly name: string,
      public readonly totalAmount: number,
      public readonly remainingAmount: number,
      public readonly debtType: 'given' | 'taken',
      public readonly currency: string = 'USD',
      public readonly personName?: string,
      public readonly accountId?: string,
      public readonly monthlyPayment?: number,
      public readonly nextPaymentDate?: Date,
      public readonly transactionId?: string,
      public readonly sourceTransactionId?: string,
      public readonly createdAt?: Date,
      public readonly description?: string,
      public readonly isPrivate?: boolean,
    ) {}
  }
  ```

- [ ] **Step 3: Thread `isPrivate` through controller**

  File: `backend/src/modules/debt/presentation/controllers/debts.controller.ts`

  In the `create()` method, add `dto.isPrivate` as the last argument to `new CreateDebtCommand(...)`:
  ```typescript
  new CreateDebtCommand(
    userId,
    dto.name,
    dto.totalAmount,
    dto.remainingAmount,
    dto.debtType,
    dto.currency,
    dto.personName,
    dto.accountId,
    dto.monthlyPayment,
    dto.nextPaymentDate ? new Date(dto.nextPaymentDate) : undefined,
    dto.transactionId,
    dto.sourceTransactionId,
    dto.createdAt ? new Date(dto.createdAt) : undefined,
    dto.description,
    dto.isPrivate,
  ),
  ```

- [ ] **Step 4: Apply `isPrivate` in handler**

  File: `backend/src/modules/debt/application/commands/create-debt/create-debt.handler.ts`

  After the `sourceTransactionId` block and before `debtRepository.save()`, add:
  ```typescript
  if (command.isPrivate) {
    debt.update({ isPrivate: true });
  }
  ```

- [ ] **Step 5: Build backend to verify no TypeScript errors**

  ```bash
  cd backend && bun run build
  ```
  Expected: exits with code 0, no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/modules/debt/presentation/dto/create-debt.dto.ts \
    backend/src/modules/debt/application/commands/create-debt/create-debt.command.ts \
    backend/src/modules/debt/presentation/controllers/debts.controller.ts \
    backend/src/modules/debt/application/commands/create-debt/create-debt.handler.ts
  git commit -m "feat(backend): wire isPrivate through debt create chain"
  ```

---

## Task 2: Frontend model — extend `DebtFormData` + API call

**Files:**
- Modify: `frontend/src/features/create-debt/model/useCreateDebt.ts`
- Modify: `frontend/src/entities/debt/api/debtsApi.ts`

- [ ] **Step 1: Add fields to `DebtFormData` in `useCreateDebt.ts`**

  File: `frontend/src/features/create-debt/model/useCreateDebt.ts`

  Update the `DebtFormData` interface — add two fields:
  ```typescript
  export interface DebtFormData {
    debt_type: DebtDirection;
    person_name: string;
    amount: number;
    currency: string;
    account_id: string | null;
    debt_date: string | null;
    description: string;
    skipTransaction: boolean;
    is_private: boolean;       // NEW
    due_date: string | null;   // NEW — maps to next_payment_date
  }
  ```

  Update `initialFormData`:
  ```typescript
  const initialFormData: DebtFormData = {
    debt_type: 'taken',
    person_name: '',
    amount: 0,
    currency: DEFAULT_CURRENCY,
    account_id: null,
    debt_date: getTodayISO(),
    description: '',
    skipTransaction: false,
    is_private: false,
    due_date: null,
  };
  ```

- [ ] **Step 2: Pass new fields in `debtsApi.create()` call**

  In `useCreateDebt.ts`, inside the `mutationFn`, update the `debtsApi.create()` call to pass the new fields:
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
    currency,
    description: formData.value.description || null,
    is_private: formData.value.is_private,
    next_payment_date: formData.value.due_date,
  });
  ```

- [ ] **Step 3: Add `resetForm()` call in `onSuccess` (after toast)**

  In `onSuccess`, the toast is shown and then `resetForm()` must be called. Currently `resetForm()` is NOT called in `onSuccess`. Add it after the toast:
  ```typescript
  onSuccess: async (_, userId) => {
    await invalidateDebtRelated(queryClient, userId);
    const isGiven = formData.value.debt_type === 'given';
    toast({
      title: 'Долг создан',
      description: isGiven
        ? `Вы дали в долг ${formData.value.person_name}`
        : `Вы взяли в долг у ${formData.value.person_name}`,
      variant: 'success',
      duration: 2500,
    });
    resetForm(); // ADDED: clear form after success
  },
  ```

- [ ] **Step 4: Expose `resetForm` in return value**

  Ensure `resetForm` is in the return object of `useCreateDebt()`:
  ```typescript
  return {
    formData,
    isValid,
    isSubmitting,
    error,
    createDebt,
    updateField,
    resetForm,  // already exported — verify it's there
  };
  ```

- [ ] **Step 5: Update `debtsApi.create()` to send `isPrivate` and `nextPaymentDate`**

  File: `frontend/src/entities/debt/api/debtsApi.ts`

  In the `create()` method, add to the POST body:
  ```typescript
  async create(debt: DebtInsert): Promise<Debt> {
    const data = await http.post<DebtResponse>('/debts', {
      name: debt.name,
      totalAmount: debt.total_amount,
      remainingAmount: debt.remaining_amount,
      monthlyPayment: debt.monthly_payment,
      nextPaymentDate: debt.next_payment_date ?? undefined,  // CHANGED: ?? undefined to avoid null→400
      debtType: debt.debt_type ?? 'taken',
      personName: debt.person_name,
      accountId: debt.account_id,
      transactionId: debt.transaction_id ?? undefined,
      currency: debt.currency,
      sourceTransactionId: debt.source_transaction_id,
      description: debt.description,
      createdAt: debt.created_at,
      isPrivate: debt.is_private ?? false,  // NEW
    });
    return transformDebt(data);
  },
  ```

- [ ] **Step 6: Build frontend to verify types**

  ```bash
  cd frontend && bun run build
  ```
  Expected: exits with code 0.

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/src/features/create-debt/model/useCreateDebt.ts \
    frontend/src/entities/debt/api/debtsApi.ts
  git commit -m "feat(create-debt): add is_private + due_date fields to form model and API"
  ```

---

## Task 3: Create `CreateDebtDrawer.vue`

**Files:**
- Create: `frontend/src/features/create-debt/ui/CreateDebtDrawer.vue`

This is the main new component. It replaces `DebtForm.vue` entirely. Reference `SplitExpenseDrawer.vue` at `frontend/src/features/split-expense/ui/SplitExpenseDrawer.vue` for the iOS keyboard fix pattern.

- [ ] **Step 1: Create the file with full implementation**

  File: `frontend/src/features/create-debt/ui/CreateDebtDrawer.vue`

  ```vue
  <script setup lang="ts">
  import { ref, computed, watch, nextTick, onBeforeUnmount, type ComponentPublicInstance } from 'vue';
  import { CalendarDate, type DateValue } from '@internationalized/date';
  import {
    DrawerRoot,
    DrawerPortal,
    DrawerOverlay,
    DrawerContent,
    DrawerHandle,
    DrawerTitle,
  } from 'vaul-vue';
  import { UInput, UButton, UTabs, UIcon, UToggle, SelectChips } from '@/shared/ui';
  import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
  import { Calendar } from '@/shared/ui/primitives/calendar';
  import { DEBT_DIRECTION_LABELS, type DebtDirection } from '@/entities/debt';
  import { getCurrencyByCode, DEFAULT_CURRENCY } from '@/entities/currency';
  import { PersonSelector, usePeople } from '@/entities/person';
  import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
  import { getTodayISO } from '@/shared/lib/date';
  import { formatLocalDate } from '@/shared/lib/format/date';
  import { useCreateDebt } from '../model/useCreateDebt';
  import type { AccountWithBalances } from '@/entities/account';

  const props = defineProps<{
    open: boolean;
    accounts: AccountWithBalances[];
  }>();

  const emit = defineEmits<{
    'update:open': [value: boolean];
  }>();

  const { userId } = useCurrentUser();
  const { people, createPerson } = usePeople(userId);
  const { formData, isValid, isSubmitting, error, createDebt, updateField, resetForm } =
    useCreateDebt();

  // ── Debt type tabs ────────────────────────────────────────────────────────
  const debtTypeTabs = Object.entries(DEBT_DIRECTION_LABELS).map(([id, label]) => ({ id, label }));

  // ── Account chips ─────────────────────────────────────────────────────────
  const accountItems = computed(() =>
    props.accounts.map((a) => ({ id: a.id, label: a.name })),
  );

  function handleAccountChange(accountId: string | null) {
    if (!accountId) {
      updateField('account_id', null);
      return;
    }
    const account = props.accounts.find((a) => a.id === accountId);
    const firstCurrency = account?.balances[0]?.currency || DEFAULT_CURRENCY;
    updateField('account_id', accountId);
    updateField('currency', firstCurrency);
  }

  // ── Currency ──────────────────────────────────────────────────────────────
  const selectedAccount = computed(() =>
    props.accounts.find((a) => a.id === formData.value.account_id),
  );
  const availableCurrencies = computed(() =>
    selectedAccount.value ? selectedAccount.value.balances.map((b) => b.currency) : [],
  );
  const isMultiCurrency = computed(() => availableCurrencies.value.length > 1);
  const currencySymbol = computed(() => {
    const c = getCurrencyByCode(formData.value.currency);
    return c?.symbol || formData.value.currency;
  });

  // ── Debt date (when debt was created) ─────────────────────────────────────
  const isDebtDateOpen = ref(false);
  const debtDateCalendarValue = computed(() => {
    const s = formData.value.debt_date || getTodayISO();
    const [y, m, d] = s.split('-').map(Number);
    return new CalendarDate(y, m, d);
  });
  const debtDisplayDate = computed(() => {
    const s = formData.value.debt_date || getTodayISO();
    const [y, m, d] = s.split('-').map(Number);
    return formatLocalDate(new Date(y, m - 1, d).getTime());
  });
  function handleDebtDateChange(value: DateValue | undefined) {
    if (!value) return;
    const y = value.year;
    const m = String(value.month).padStart(2, '0');
    const d = String(value.day).padStart(2, '0');
    updateField('debt_date', `${y}-${m}-${d}`);
    isDebtDateOpen.value = false;
  }

  // ── Due date (when debt should be returned) ───────────────────────────────
  const isDueDateOpen = ref(false);
  const dueDateCalendarValue = computed<DateValue | undefined>(() => {
    if (!formData.value.due_date) return undefined;
    const [y, m, d] = formData.value.due_date.split('-').map(Number);
    return new CalendarDate(y, m, d);
  });
  const dueDateDisplay = computed(() => {
    if (!formData.value.due_date) return null;
    const [y, m, d] = formData.value.due_date.split('-').map(Number);
    return formatLocalDate(new Date(y, m - 1, d).getTime());
  });
  function handleDueDateChange(value: DateValue | undefined) {
    if (!value) return;
    const y = value.year;
    const m = String(value.month).padStart(2, '0');
    const d = String(value.day).padStart(2, '0');
    updateField('due_date', `${y}-${m}-${d}`);
    isDueDateOpen.value = false;
  }
  function clearDueDate() {
    updateField('due_date', null);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!userId.value) return;
    const debtId = await createDebt(userId.value);
    if (debtId) {
      emit('update:open', false);
    }
  }

  // ── iOS virtual keyboard fix ──────────────────────────────────────────────
  // Direct DOM manipulation — NOT reactive state — to avoid Vue re-renders
  // that cause input focus loss when the keyboard appears (same fix as SplitExpenseDrawer).
  const drawerContentRef = ref<InstanceType<typeof DrawerContent> | null>(null);
  // ComponentPublicInstance imported to allow .$el access on the component ref
  const footerRef = ref<HTMLDivElement | null>(null);
  const scrollContainerRef = ref<HTMLDivElement | null>(null);
  let cleanupViewport: (() => void) | null = null;

  function setupKeyboardListener() {
    cleanupKeyboardListener();
    const vv = window.visualViewport;
    if (!vv) return;
    const drawerEl = drawerContentRef.value?.$el as HTMLElement | undefined;
    const footerEl = footerRef.value;
    const scrollEl = scrollContainerRef.value;
    if (!drawerEl) return;

    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height);
      const keyboardVisible = offset > 0;
      drawerEl.style.bottom = keyboardVisible ? `${offset}px` : '';
      drawerEl.style.top = keyboardVisible ? 'env(safe-area-inset-top, 0px)' : '';
      drawerEl.style.maxHeight = keyboardVisible ? `${window.innerHeight - offset}px` : '';
      if (footerEl) footerEl.style.paddingBottom = keyboardVisible ? '0.75rem' : '';
      if (scrollEl) scrollEl.style.paddingBottom = keyboardVisible ? '1rem' : '';
      if (keyboardVisible) {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    };

    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    cleanupViewport = () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
      drawerEl.style.bottom = '';
      drawerEl.style.top = '';
      drawerEl.style.maxHeight = '';
      if (footerEl) footerEl.style.paddingBottom = '';
      if (scrollEl) scrollEl.style.paddingBottom = '';
    };
    onResize();
  }

  function cleanupKeyboardListener() {
    cleanupViewport?.();
    cleanupViewport = null;
  }

  watch(
    () => props.open,
    async (isOpen) => {
      if (isOpen) {
        await nextTick();
        if (!props.open) return; // race condition guard
        setupKeyboardListener();
      } else {
        cleanupKeyboardListener();
        nextTick(resetForm); // clear stale values when drawer closes
      }
    },
  );

  onBeforeUnmount(() => {
    cleanupKeyboardListener();
  });
  </script>

  <template>
    <DrawerRoot :open="open" @update:open="$emit('update:open', $event)">
      <DrawerPortal>
        <DrawerOverlay class="fixed inset-0 z-50 bg-black/40" />
        <DrawerContent
          ref="drawerContentRef"
          class="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-card-light dark:bg-card-dark border-t border-border-light dark:border-border-dark max-h-[90dvh]"
        >
          <!-- Handle -->
          <div class="flex justify-center pt-3 pb-1">
            <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
          </div>

          <!-- Header -->
          <div class="flex items-center justify-between px-5 pb-3">
            <DrawerTitle
              class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
            >
              Новый долг
            </DrawerTitle>
            <button
              type="button"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
              @click="$emit('update:open', false)"
            >
              <UIcon name="close" size="sm" />
            </button>
          </div>

          <!-- Scrollable content -->
          <div
            ref="scrollContainerRef"
            class="flex-1 overflow-y-auto px-5 pb-5 space-y-5 overscroll-contain"
            data-vaul-no-drag
          >
            <!-- Debt type -->
            <div class="space-y-2">
              <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                Тип долга
              </label>
              <UTabs
                :model-value="formData.debt_type"
                :items="debtTypeTabs"
                @update:model-value="updateField('debt_type', $event as DebtDirection)"
              />
            </div>

            <!-- Person -->
            <div class="space-y-2">
              <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                {{ formData.debt_type === 'given' ? 'Кому дали в долг' : 'У кого взяли в долг' }}
              </label>
              <PersonSelector
                :model-value="formData.person_name"
                :people="people"
                placeholder="Имя человека"
                @update:model-value="updateField('person_name', $event as string)"
                @select="updateField('person_name', $event as string)"
                @save-person="(name) => createPerson({ name })"
              />
            </div>

            <!-- Amount + currency -->
            <div class="space-y-2">
              <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                Сумма
              </label>
              <div class="flex gap-2">
                <div v-if="isMultiCurrency" class="relative shrink-0">
                  <select
                    :value="formData.currency"
                    class="appearance-none h-full bg-surface-light dark:bg-surface-dark rounded-xl px-3 pr-8 text-sm font-medium border border-border-light dark:border-border-dark focus:outline-none focus:ring-2 focus:ring-primary"
                    @change="updateField('currency', ($event.target as HTMLSelectElement).value)"
                  >
                    <option v-for="c in availableCurrencies" :key="c" :value="c">
                      {{ getCurrencyByCode(c)?.flag }} {{ c }}
                    </option>
                  </select>
                  <UIcon
                    name="expand_more"
                    size="sm"
                    class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary-light dark:text-text-tertiary-dark"
                  />
                </div>
                <div class="flex-1">
                  <UInput
                    :model-value="String(formData.amount || '')"
                    placeholder="0"
                    variant="currency"
                    type="number"
                    :suffix="currencySymbol"
                    @update:model-value="updateField('amount', Number($event) || 0)"
                  />
                </div>
              </div>
            </div>

            <!-- Account (SelectChips) -->
            <div class="space-y-2">
              <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                {{ formData.debt_type === 'given' ? 'С какого счёта' : 'На какой счёт' }}
              </label>
              <SelectChips
                :model-value="formData.account_id"
                :items="accountItems"
                all-label="Счёт не выбран"
                @update:model-value="handleAccountChange($event)"
              />
            </div>

            <!-- Debt date -->
            <div class="space-y-2">
              <label class="text-xs font-medium text-text-primary-light dark:text-text-primary-dark">
                Дата
              </label>
              <Popover v-model:open="isDebtDateOpen">
                <PopoverTrigger as-child>
                  <button
                    type="button"
                    class="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:border-primary/50 transition-all"
                  >
                    <div class="flex items-center gap-2">
                      <UIcon name="calendar_month" size="sm" class="text-text-secondary-light dark:text-text-secondary-dark" />
                      <span class="text-sm">{{ debtDisplayDate }}</span>
                    </div>
                    <UIcon
                      name="expand_more"
                      size="sm"
                      class="text-text-secondary-light dark:text-text-secondary-dark transition-transform"
                      :class="{ 'rotate-180': isDebtDateOpen }"
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0" align="start">
                  <Calendar :model-value="debtDateCalendarValue" locale="ru-RU" @update:model-value="handleDebtDateChange" />
                </PopoverContent>
              </Popover>
            </div>

            <!-- Due date -->
            <div class="space-y-2">
              <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                Срок возврата
              </label>
              <Popover v-model:open="isDueDateOpen">
                <PopoverTrigger as-child>
                  <button
                    type="button"
                    class="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark hover:border-primary/50 transition-all"
                    :class="formData.due_date ? 'text-text-primary-light dark:text-text-primary-dark' : 'text-text-tertiary-light dark:text-text-tertiary-dark'"
                  >
                    <div class="flex items-center gap-2">
                      <UIcon name="event" size="sm" />
                      <span class="text-sm">{{ dueDateDisplay ?? 'Без срока' }}</span>
                    </div>
                    <button
                      v-if="formData.due_date"
                      type="button"
                      class="p-0.5 rounded hover:text-danger transition-colors"
                      @click.stop="clearDueDate"
                    >
                      <UIcon name="close" size="xs" />
                    </button>
                    <UIcon
                      v-else
                      name="expand_more"
                      size="sm"
                      class="transition-transform"
                      :class="{ 'rotate-180': isDueDateOpen }"
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0" align="start">
                  <Calendar :model-value="dueDateCalendarValue" locale="ru-RU" @update:model-value="handleDueDateChange" />
                </PopoverContent>
              </Popover>
            </div>

            <!-- Description -->
            <UInput
              :model-value="formData.description"
              label="Комментарий (необязательно)"
              placeholder="Добавьте описание..."
              @update:model-value="updateField('description', $event as string)"
            />

            <!-- Is private toggle -->
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                  Скрыть сумму
                </p>
                <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                  Сумма не будет видна в общем списке
                </p>
              </div>
              <UToggle
                :model-value="formData.is_private"
                @update:model-value="updateField('is_private', $event)"
              />
            </div>

            <!-- Skip transaction -->
            <label class="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                :checked="formData.skipTransaction"
                class="w-5 h-5 rounded border-border-light dark:border-border-dark text-primary focus:ring-primary"
                @change="updateField('skipTransaction', ($event.target as HTMLInputElement).checked)"
              />
              <span class="text-sm text-text-primary-light dark:text-text-primary-dark">
                {{ formData.debt_type === 'given' ? 'Не списывать с баланса' : 'Не добавлять на баланс' }}
              </span>
            </label>

            <!-- Info box -->
            <div v-if="!formData.skipTransaction" class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
              <div class="flex items-start gap-3">
                <UIcon name="info" size="sm" class="text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5" />
                <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {{
                    formData.debt_type === 'given'
                      ? `Сумма ${formData.amount > 0 ? formData.amount + ' ' + formData.currency : ''} будет списана с выбранного счёта`
                      : `Сумма ${formData.amount > 0 ? formData.amount + ' ' + formData.currency : ''} будет добавлена на выбранный счёт`
                  }}
                </p>
              </div>
            </div>

            <!-- Error -->
            <p v-if="error" class="text-sm text-danger">{{ error }}</p>
          </div>

          <!-- Footer -->
          <div
            ref="footerRef"
            class="px-5 py-3 border-t border-border-light dark:border-border-dark"
            style="padding-bottom: calc(env(safe-area-inset-bottom, 16px) + 0.75rem)"
          >
            <UButton
              type="button"
              variant="primary"
              size="xl"
              full-width
              :loading="isSubmitting"
              :disabled="!isValid"
              @click="handleSubmit"
            >
              Создать долг
            </UButton>
          </div>
        </DrawerContent>
      </DrawerPortal>
    </DrawerRoot>
  </template>
  ```

- [ ] **Step 2: Build frontend to verify no TypeScript errors**

  ```bash
  cd frontend && bun run build
  ```
  Expected: exits with code 0.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/features/create-debt/ui/CreateDebtDrawer.vue
  git commit -m "feat(create-debt): add CreateDebtDrawer with vaul-vue, SelectChips, is_private, due_date"
  ```

---

## Task 4: Update feature index + wire into DebtsListPage

**Files:**
- Modify: `frontend/src/features/create-debt/index.ts`
- Modify: `frontend/src/pages/debts/list/useDebtsPageState.ts`
- Modify: `frontend/src/pages/debts/list/DebtsListPage.vue`

- [ ] **Step 1: Update `features/create-debt/index.ts`**

  Replace `DebtForm` export with `CreateDebtDrawer`:
  ```typescript
  export { default as CreateDebtDrawer } from './ui/CreateDebtDrawer.vue';
  export { useCreateDebt, type DebtFormData } from './model/useCreateDebt';
  ```

- [ ] **Step 2: Add `showCreateDrawer` to `useDebtsPageState.ts`**

  File: `frontend/src/pages/debts/list/useDebtsPageState.ts`

  Add `showCreateDrawer` ref near the top of `useDebtsPageState()`:
  ```typescript
  const showCreateDrawer = ref(false);
  ```

  Change `handleAddDebt` to open the drawer instead of navigating:
  ```typescript
  function handleAddDebt() {
    showCreateDrawer.value = true;
  }
  ```

  Add `showCreateDrawer` to the return object.

- [ ] **Step 3: Add `CreateDebtDrawer` to `DebtsListPage.vue`**

  File: `frontend/src/pages/debts/list/DebtsListPage.vue`

  Add import at the top of `<script setup>`:
  ```typescript
  import { CreateDebtDrawer } from '@/features/create-debt';
  ```

  Destructure `showCreateDrawer` and `accounts` from `useDebtsPageState()`. `accounts` is already in the return value of `useDebtsPageState` (confirmed: line 304 of the file). Ensure it is also destructured in `DebtsListPage.vue`.

  Add the drawer component right before the closing `</div>` of the root element (after the modals section):
  ```html
  <CreateDebtDrawer
    v-model:open="showCreateDrawer"
    :accounts="accounts"
  />
  ```

- [ ] **Step 4: Build frontend**

  ```bash
  cd frontend && bun run build
  ```
  Expected: exits with code 0.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/features/create-debt/index.ts \
    frontend/src/pages/debts/list/useDebtsPageState.ts \
    frontend/src/pages/debts/list/DebtsListPage.vue
  git commit -m "feat(debts): open CreateDebtDrawer inline from DebtsListPage"
  ```

---

## Task 5: Migrate AddDebtPage + clean up route

**Files:**
- Modify: `frontend/src/pages/debts/new/AddDebtPage.vue`
- Modify: `frontend/src/pages/dashboard/model/useDashboardNavigation.ts`
- Modify: `frontend/src/app/router/index.ts`
- Modify: `frontend/src/app/router/routeNames.ts`
- Delete: `frontend/src/features/create-debt/ui/DebtForm.vue`
- Delete: `frontend/src/pages/debts/new/AddDebtPage.spec.ts`

- [ ] **Step 1: Replace `AddDebtPage.vue` with redirect**

  File: `frontend/src/pages/debts/new/AddDebtPage.vue`

  Replace entire file content:
  ```vue
  <script setup lang="ts">
  import { useRouter } from 'vue-router';
  import { ROUTE_NAMES } from '@/app/router/routeNames';
  useRouter().replace({ name: ROUTE_NAMES.DEBTS_LIST });
  </script>
  <template><div /></template>
  ```

- [ ] **Step 2: Update `useDashboardNavigation.ts`**

  File: `frontend/src/pages/dashboard/model/useDashboardNavigation.ts`

  Change `toNewDebt`:
  ```typescript
  toNewDebt: () => router.push({ name: ROUTE_NAMES.DEBTS_LIST }),
  ```

- [ ] **Step 3: Check `routeNames.ts` and `router/index.ts` for `NEW_DEBT`**

  Grep for `NEW_DEBT` in the router files:
  ```bash
  grep -r "NEW_DEBT" frontend/src/app/router/
  ```
  If only the route definition remains (no other callers), remove the `NEW_DEBT` entry from `routeNames.ts` and its route definition from `router/index.ts`.

- [ ] **Step 4: Delete `DebtForm.vue`**

  ```bash
  rm frontend/src/features/create-debt/ui/DebtForm.vue
  ```

- [ ] **Step 5: Delete `AddDebtPage.spec.ts`**

  ```bash
  rm frontend/src/pages/debts/new/AddDebtPage.spec.ts
  ```

- [ ] **Step 6: Build frontend to verify everything still compiles**

  ```bash
  cd frontend && bun run build
  ```
  Expected: exits with code 0. If `DebtForm` import appears anywhere else, fix it now.

- [ ] **Step 7: Commit**

  ```bash
  git rm frontend/src/features/create-debt/ui/DebtForm.vue
  git rm frontend/src/pages/debts/new/AddDebtPage.spec.ts
  git add frontend/src/pages/debts/new/AddDebtPage.vue \
    frontend/src/pages/dashboard/model/useDashboardNavigation.ts \
    frontend/src/app/router/index.ts \
    frontend/src/app/router/routeNames.ts
  git commit -m "feat(debts): migrate AddDebtPage to redirect, remove DebtForm, clean up NEW_DEBT route"
  ```

---

## Task 6: Run /simplify × 2 then /crq × 2

- [ ] **Step 1: Run first `/simplify`**

  Invoke the `simplify` skill targeting the changed code.

- [ ] **Step 2: Run second `/simplify`**

  Invoke the `simplify` skill a second time.

- [ ] **Step 3: Run first `/crq`**

  Invoke the `crq` skill for code review.

- [ ] **Step 4: Run second `/crq`**

  Invoke the `crq` skill a second time.

- [ ] **Step 5: Final build verification**

  ```bash
  cd frontend && bun run build && cd ../backend && bun run build
  ```
  Expected: both exit with code 0.

- [ ] **Step 6: Final commit if any changes from review**

  ```bash
  git add -A && git commit -m "refactor(create-debt): simplify and review pass"
  ```
