# Quick Actions Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional amount field (enables one-tap transactions), custom names, and compact sizing (6 slots) to Quick Actions.

**Architecture:** Backend adds nullable `amount` column via migration, threading through domain→ORM→mapper→command→response→controller→DTO. Frontend adds amount to types/API, branches click handler (one-tap vs navigate), adds name/amount inputs to modal, shrinks buttons to fit 6.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Vue 3, TanStack Vue Query, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-20-quick-actions-enhancement-design.md`

---

### Task 1: Backend — Migration

**Files:**
- Create: `backend/src/database/migrations/1773770000000-AddQuickActionAmount.ts`

- [ ] **Step 1: Create migration file**

```typescript
// backend/src/database/migrations/1773770000000-AddQuickActionAmount.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuickActionAmount1773770000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quick_actions" ADD "amount" numeric(12,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quick_actions" DROP COLUMN "amount"`,
    );
  }
}
```

- [ ] **Step 2: Verify migration compiles**

Run: `cd backend && bun run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/database/migrations/1773770000000-AddQuickActionAmount.ts
git commit -m "feat(quick-actions): add amount column migration"
```

---

### Task 2: Backend — Domain Aggregate

**Files:**
- Modify: `backend/src/modules/accounting/domain/aggregates/quick-action/quick-action.aggregate.ts`

- [ ] **Step 1: Add `amount` to `QuickActionProps`**

In `quick-action.aggregate.ts`, add `amount` to the interface:

```typescript
export interface QuickActionProps {
  id: string;
  userId: string;
  categoryId: string;
  accountId: string;
  label: string;
  position: number;
  amount: number | null;  // <-- ADD
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Add private field, constructor assignment, getter, and methods**

Add private field after `_position`:

```typescript
private _amount: number | null;
```

In the constructor, after `this._position = props.position;` add:

```typescript
this._amount = props.amount;
```

Add `amount` parameter to static `create` (after `position`):

```typescript
static create(
  id: string,
  userId: string,
  categoryId: string,
  accountId: string,
  label: string,
  position: number,
  amount: number | null = null,
): QuickAction {
  return new QuickAction({
    id,
    userId,
    categoryId,
    accountId,
    label,
    position,
    amount,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
```

Add getter after `position` getter:

```typescript
get amount(): number | null {
  return this._amount;
}
```

Update `update` method signature to include `amount`:

```typescript
update(data: { categoryId?: string; accountId?: string; label?: string; amount?: number | null }): void {
  if (data.categoryId !== undefined) this._categoryId = data.categoryId;
  if (data.accountId !== undefined) this._accountId = data.accountId;
  if (data.label !== undefined) this._label = data.label;
  if (data.amount !== undefined) this._amount = data.amount;
  this._updatedAt = new Date();
}
```

- [ ] **Step 3: Verify build**

Run: `cd backend && bun run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/accounting/domain/aggregates/quick-action/quick-action.aggregate.ts
git commit -m "feat(quick-actions): add amount to domain aggregate"
```

---

### Task 3: Backend — ORM Entity & Mapper

**Files:**
- Modify: `backend/src/modules/accounting/infrastructure/persistence/typeorm/quick-action.orm-entity.ts`
- Modify: `backend/src/modules/accounting/infrastructure/persistence/mappers/quick-action.mapper.ts`

- [ ] **Step 1: Add `amount` column to ORM entity**

In `quick-action.orm-entity.ts`, add after the `position` column:

```typescript
@Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
amount: string | null;
```

- [ ] **Step 2: Update mapper — toDomain**

In `quick-action.mapper.ts`, `toDomain` method, add `amount` to the reconstitute call:

```typescript
static toDomain(orm: QuickActionOrmEntity): QuickAction {
  return QuickAction.reconstitute({
    id: orm.id,
    userId: orm.userId,
    categoryId: orm.categoryId,
    accountId: orm.accountId,
    label: orm.label,
    position: orm.position,
    amount: orm.amount !== null ? parseFloat(orm.amount) : null,
    createdAt: orm.createdAt,
    updatedAt: orm.updatedAt,
  });
}
```

- [ ] **Step 3: Update mapper — toOrm**

In `toOrm`, add after `orm.position`:

```typescript
orm.amount = domain.amount !== null ? domain.amount.toString() : null;
```

- [ ] **Step 4: Verify build**

Run: `cd backend && bun run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/accounting/infrastructure/persistence/typeorm/quick-action.orm-entity.ts backend/src/modules/accounting/infrastructure/persistence/mappers/quick-action.mapper.ts
git commit -m "feat(quick-actions): add amount to ORM entity and mapper"
```

---

### Task 4: Backend — Commands, Response, DTOs, Controller

**Files:**
- Modify: `backend/src/modules/accounting/application/commands/create-quick-action/create-quick-action.command.ts`
- Modify: `backend/src/modules/accounting/application/commands/create-quick-action/create-quick-action.handler.ts`
- Modify: `backend/src/modules/accounting/application/commands/update-quick-action/update-quick-action.command.ts`
- Modify: `backend/src/modules/accounting/application/commands/update-quick-action/update-quick-action.handler.ts`
- Modify: `backend/src/modules/accounting/application/commands/quick-action-response.ts`
- Modify: `backend/src/modules/accounting/presentation/dto/create-quick-action.dto.ts`
- Modify: `backend/src/modules/accounting/presentation/dto/update-quick-action.dto.ts`
- Modify: `backend/src/modules/accounting/presentation/controllers/quick-actions.controller.ts`

- [ ] **Step 1: Update `CreateQuickActionCommand`**

Replace the full file content:

```typescript
export class CreateQuickActionCommand {
  constructor(
    public readonly userId: string,
    public readonly categoryId: string,
    public readonly accountId: string,
    public readonly label: string,
    public readonly amount?: number,
  ) {}
}
```

- [ ] **Step 2: Update `CreateQuickActionHandler`**

Change `MAX_QUICK_ACTIONS` from 4 to 6:

```typescript
const MAX_QUICK_ACTIONS = 6;
```

Update the error message:

```typescript
throw new BadRequestException('Maximum of 6 quick actions allowed');
```

Update `QuickAction.create` call to pass `amount`:

```typescript
const quickAction = QuickAction.create(
  crypto.randomUUID(),
  command.userId,
  command.categoryId,
  command.accountId,
  command.label,
  count,
  command.amount ?? null,
);
```

- [ ] **Step 3: Update `UpdateQuickActionCommand`**

Replace the full file content:

```typescript
export class UpdateQuickActionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly data: {
      categoryId?: string;
      accountId?: string;
      label?: string;
      amount?: number | null;
    },
  ) {}
}
```

- [ ] **Step 4: Update `quick-action-response.ts`**

Add `amount` to response:

```typescript
export function toQuickActionResponse(a: QuickAction) {
  return {
    id: a.id,
    userId: a.userId,
    categoryId: a.categoryId,
    accountId: a.accountId,
    label: a.label,
    position: a.position,
    amount: a.amount ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 5: Update `CreateQuickActionDto`**

Add to `create-quick-action.dto.ts`:

```typescript
import { IsString, IsUUID, MaxLength, IsOptional, IsNumber, IsPositive } from 'class-validator';

export class CreateQuickActionDto {
  @IsUUID()
  categoryId: string;

  @IsUUID()
  accountId: string;

  @IsString()
  @MaxLength(50)
  label: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;
}
```

- [ ] **Step 6: Update `UpdateQuickActionDto`**

Replace with:

```typescript
import { IsString, IsOptional, IsUUID, MaxLength, IsNumber, IsPositive, ValidateIf } from 'class-validator';

export class UpdateQuickActionDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsNumber()
  @IsPositive()
  amount?: number | null;
}
```

- [ ] **Step 7: Update controller**

In `quick-actions.controller.ts`, update the `create` method to pass `dto.amount`:

```typescript
@Post()
async create(
  @CurrentUser('sub') userId: string,
  @Body() dto: CreateQuickActionDto,
): Promise<unknown> {
  return this.commandBus.execute(
    new CreateQuickActionCommand(userId, dto.categoryId, dto.accountId, dto.label, dto.amount),
  );
}
```

- [ ] **Step 8: Verify build**

Run: `cd backend && bun run build`
Expected: No errors

- [ ] **Step 9: Run tests**

Run: `cd backend && bun run test`
Expected: All tests pass

- [ ] **Step 10: Commit**

```bash
git add backend/src/modules/accounting/application/commands/ backend/src/modules/accounting/presentation/
git commit -m "feat(quick-actions): add amount to commands, DTOs, controller, bump max to 6"
```

---

### Task 5: Frontend — Types & API Layer

**Files:**
- Modify: `frontend/src/shared/api/database.types.ts`
- Modify: `frontend/src/features/configure-quick-action/model/types.ts`
- Modify: `frontend/src/entities/quick-action/api/quickActionApi.ts`

- [ ] **Step 1: Add `amount` to `database.types.ts`**

In the `quick_actions` section, add `amount` to Row, Insert, and Update:

**Row** (after `position: number;`):
```typescript
amount: number | null;
```

**Insert** (after `position?: number;`):
```typescript
amount?: number | null;
```

**Update** (find the quick_actions Update type, add):
```typescript
amount?: number | null;
```

- [ ] **Step 2: Add `amount` to feature-layer type**

In `frontend/src/features/configure-quick-action/model/types.ts`:

```typescript
export interface QuickAction {
  id: string;
  label: string;
  categoryId: string;
  accountId: string;
  amount: number | null;
}
```

- [ ] **Step 3: Update `quickActionApi.ts`**

Add `amount` to `QuickActionResponse` interface:

```typescript
interface QuickActionResponse {
  id: string;
  userId: string;
  categoryId: string;
  accountId: string;
  label: string;
  position: number;
  amount: number | null;
  createdAt: string;
  updatedAt: string;
}
```

Add `amount` to `transformQuickAction`:

```typescript
function transformQuickAction(qa: QuickActionResponse): QuickAction {
  return {
    id: qa.id,
    user_id: qa.userId,
    category_id: qa.categoryId,
    account_id: qa.accountId,
    label: qa.label,
    position: qa.position,
    amount: qa.amount,
    created_at: qa.createdAt,
    updated_at: qa.updatedAt,
  };
}
```

Update `create` params type:

```typescript
async create(params: {
  categoryId: string;
  accountId: string;
  label: string;
  amount?: number | null;
}): Promise<QuickAction> {
```

Update `update` params type:

```typescript
async update(
  id: string,
  params: { categoryId?: string; accountId?: string; label?: string; amount?: number | null },
): Promise<QuickAction> {
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && bun run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/api/database.types.ts frontend/src/features/configure-quick-action/model/types.ts frontend/src/entities/quick-action/api/quickActionApi.ts
git commit -m "feat(quick-actions): add amount to frontend types and API layer"
```

---

### Task 6: Frontend — Entity & Feature Composables

**Files:**
- Modify: `frontend/src/entities/quick-action/api/useQuickActions.ts`
- Modify: `frontend/src/features/configure-quick-action/model/useQuickActions.ts`

- [ ] **Step 1: Update `useQuickActions.ts` (entity layer)**

Change `MAX_SLOTS` from 4 to 6:

```typescript
const MAX_SLOTS = 6;
```

Update `createMutation` params type to include `amount`:

```typescript
const createMutation = useMutation({
  mutationFn: (params: { categoryId: string; accountId: string; label: string; amount?: number | null }) =>
    quickActionApi.create(params),
  onSettled: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
});
```

Update `updateMutation` type to include `amount`:

```typescript
const updateMutation = useMutation({
  mutationFn: ({
    id,
    ...params
  }: {
    id: string;
    categoryId?: string;
    accountId?: string;
    label?: string;
    amount?: number | null;
  }) => quickActionApi.update(id, params),
  onMutate: async ({ id, ...updates }) => {
    await queryClient.cancelQueries({ queryKey: queryKey.value });
    const previous = queryClient.getQueryData<QuickAction[]>(queryKey.value);
    queryClient.setQueryData<QuickAction[]>(
      queryKey.value,
      (old) =>
        old?.map((a) => {
          if (a.id !== id) return a;
          return {
            ...a,
            ...(updates.categoryId !== undefined && { category_id: updates.categoryId }),
            ...(updates.accountId !== undefined && { account_id: updates.accountId }),
            ...(updates.label !== undefined && { label: updates.label }),
            ...(updates.amount !== undefined && { amount: updates.amount }),
          };
        }) ?? [],
    );
    return { previous };
  },
  onError: (_err, _vars, context) => {
    if (context?.previous) queryClient.setQueryData(queryKey.value, context.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
});
```

Update `addAction` params:

```typescript
async function addAction(params: { label: string; categoryId: string; accountId: string; amount?: number | null }) {
  if (actions.value.length >= MAX_SLOTS) return;
  return createMutation.mutateAsync(params);
}
```

Update `updateAction` signature:

```typescript
async function updateAction(
  id: string,
  updates: { categoryId?: string; accountId?: string; label?: string; amount?: number | null },
) {
  return updateMutation.mutateAsync({ id, ...updates });
}
```

- [ ] **Step 2: Update feature-layer `useQuickActions.ts`**

Add `amount` to the slot transform:

```typescript
const slots = computed<(QuickAction | null)[]>(() =>
  api.slots.value.map((a) =>
    a
      ? {
          id: a.id,
          label: a.label,
          categoryId: a.category_id,
          accountId: a.account_id,
          amount: a.amount,
        }
      : null,
  ),
);
```

Update `handleSave` to pass `amount`:

```typescript
async function handleSave(data: { label: string; categoryId: string; accountId: string; amount?: number | null }) {
  if (editingAction.value) {
    await api.updateAction(editingAction.value.id, data);
  } else {
    await api.addAction(data);
  }
  editingAction.value = null;
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/entities/quick-action/api/useQuickActions.ts frontend/src/features/configure-quick-action/model/useQuickActions.ts
git commit -m "feat(quick-actions): update composables for amount and 6 slots"
```

---

### Task 7: Frontend — Quick Action Modal (name + amount inputs)

**Files:**
- Modify: `frontend/src/features/configure-quick-action/ui/QuickActionModal.vue`

- [ ] **Step 1: Add name and amount inputs, update emit types**

Update the emit type to include `amount`:

```typescript
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [action: { label: string; categoryId: string; accountId: string; amount?: number | null }];
  delete: [];
}>();
```

Add refs for `customLabel` and `customAmount` after existing refs:

```typescript
const customLabel = ref('');
const customAmount = ref<string>('');
```

Update the `watch` to initialize them:

```typescript
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (props.editAction) {
        selectedCategoryId.value = props.editAction.categoryId;
        selectedAccountId.value = props.editAction.accountId;
        customLabel.value = props.editAction.label ?? '';
        customAmount.value = props.editAction.amount != null ? String(props.editAction.amount) : '';
      } else {
        selectedCategoryId.value = '';
        selectedAccountId.value = props.accounts[0]?.id ?? '';
        customLabel.value = '';
        customAmount.value = '';
      }
    }
  },
);
```

Add computed for selected account currency:

```typescript
const selectedAccountCurrency = computed(() => {
  const account = props.accounts.find((a) => a.id === selectedAccountId.value);
  return account?.balances[0]?.currency ?? 'USD';
});
```

Update `handleSave`:

```typescript
function handleSave() {
  if (!canSave.value) return;
  trigger('success');
  const cat = props.expenseCategories.find((c) => c.id === selectedCategoryId.value);
  const parsedAmount = customAmount.value ? parseFloat(customAmount.value) : null;
  emit('save', {
    label: customLabel.value.trim() || cat?.name || 'Расход',
    categoryId: selectedCategoryId.value,
    accountId: selectedAccountId.value,
    amount: parsedAmount && parsedAmount > 0 ? parsedAmount : null,
  });
  emit('update:modelValue', false);
}
```

- [ ] **Step 2: Add template inputs**

In the template, replace the `<div class="space-y-4">` section with:

```html
<div class="space-y-4">
  <div>
    <label class="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5">
      Название
    </label>
    <UInput
      v-model="customLabel"
      placeholder="По умолчанию — имя категории"
    />
  </div>

  <CategoryChips
    :categories="expenseCategories"
    :selected-id="selectedCategoryId"
    :rows="4"
    label="Категория"
    @select="selectCategory"
  />

  <AccountSelector
    :accounts="accounts"
    :selected-id="selectedAccountId"
    label="Счёт списания"
    @select="selectAccount"
  />

  <div>
    <label class="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5">
      Сумма
    </label>
    <UInput
      v-model="customAmount"
      variant="currency"
      :suffix="selectedAccountCurrency"
      placeholder="Не указана"
    />
    <p class="mt-1 text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
      Для мгновенного создания транзакции
    </p>
  </div>
</div>
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/configure-quick-action/ui/QuickActionModal.vue
git commit -m "feat(quick-actions): add name and amount inputs to modal"
```

---

### Task 8: Frontend — One-tap Transaction Creation

**Files:**
- Modify: `frontend/src/pages/dashboard/model/useDashboardQuickActions.ts`

- [ ] **Step 1: Add one-tap creation logic**

Replace the full file:

```typescript
import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue';
import { useRouter } from 'vue-router';
import { useQuickActions, type QuickAction } from '@/features/configure-quick-action';
import { useKeyboardTrigger } from '@/shared/lib/composables';
import { useHaptics } from '@/shared/lib/haptics';
import { useToast } from '@/shared/ui';
import { useTransactions } from '@/entities/transaction';
import { useAccounts } from '@/entities/account';
import { getTodayISO } from '@/shared/lib/date';

export function useDashboardQuickActions(
  allCategories: ComputedRef<Array<{ id: string; icon: string; color: string }>>,
  userId: MaybeRefOrGetter<string | null>,
) {
  const router = useRouter();
  const { trigger: triggerKeyboard } = useKeyboardTrigger();
  const { trigger: triggerHaptic } = useHaptics();
  const { toast } = useToast();
  const { getAccountById, updateBalance } = useAccounts(userId);
  const { createTransaction } = useTransactions(userId);

  const {
    slots: quickActionSlots,
    hidden: quickActionsHidden,
    hintDismissed: quickActionsHintDismissed,
    isLoading: quickActionsLoading,
    dismissHint,
    editingAction,
    showModal: showQuickActionModal,
    handleSave,
    handleDelete,
  } = useQuickActions(userId);

  const categoryMap = computed(() => {
    const map = new Map<string, { icon: string; color: string }>();
    for (const cat of allCategories.value) {
      map.set(cat.id, { icon: cat.icon, color: cat.color });
    }
    return map;
  });

  async function handleClick(action: QuickAction | null) {
    if (!action) {
      editingAction.value = null;
      showQuickActionModal.value = true;
      return;
    }

    // One-tap: create transaction immediately if amount is set
    if (action.amount != null && action.amount > 0) {
      const uid = toValue(userId);
      if (!uid) return;

      const account = getAccountById(action.accountId);
      if (!account) return;

      const currency = account.balances[0]?.currency ?? 'USD';

      try {
        await createTransaction(
          {
            account_id: action.accountId,
            category_id: action.categoryId,
            amount: action.amount,
            currency,
            type: 'expense',
            date: getTodayISO(),
          },
          updateBalance,
        );

        triggerHaptic('success');
        toast({
          title: 'Транзакция создана',
          description: `${action.label} — ${action.amount} ${currency}`,
          variant: 'default',
        });
      } catch {
        triggerHaptic('error');
        toast({
          title: 'Ошибка',
          description: 'Не удалось создать транзакцию',
          variant: 'destructive',
        });
      }
      return;
    }

    // No amount: navigate to form
    triggerKeyboard();
    router.push(
      `/transactions/new?type=expense&categoryId=${action.categoryId}&accountId=${action.accountId}`,
    );
  }

  function handleLongPress(action: QuickAction | null) {
    if (!action) {
      editingAction.value = null;
      showQuickActionModal.value = true;
      return;
    }
    editingAction.value = action;
    showQuickActionModal.value = true;
  }

  return {
    quickActionSlots,
    quickActionsHidden,
    quickActionsHintDismissed,
    quickActionsLoading,
    dismissHint,
    showQuickActionModal,
    editingAction,
    categoryMap,
    handleClick,
    handleLongPress,
    handleSave,
    handleDelete,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/dashboard/model/useDashboardQuickActions.ts
git commit -m "feat(quick-actions): one-tap transaction creation when amount set"
```

---

### Task 9: Frontend — Compact Button Sizing

**Files:**
- Modify: `frontend/src/pages/dashboard/ui/DashboardQuickActions.vue`

- [ ] **Step 1: Update skeleton sizes**

Change the loading skeleton section:

```html
<div v-if="loading" class="flex gap-2 pb-1">
  <Skeleton
    v-for="i in showScanButton ? 7 : 6"
    :key="i"
    class="shrink-0 w-[calc((100%-40px)/6)] h-[60px] md:h-[72px] rounded-xl md:rounded-2xl"
  />
</div>
```

- [ ] **Step 2: Update scroll container gap**

Change `gap-3 md:gap-4` to `gap-2`:

```html
<div
  v-else
  class="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 pt-1.5 -mt-1.5 px-1.5 -mx-1.5"
>
```

- [ ] **Step 3: Update scan button width**

Change scan button width class from `w-[calc((100%-36px)/4)]` to `w-[calc((100%-40px)/6)]`:

```html
<div v-if="showScanButton" class="relative snap-start shrink-0 w-[calc((100%-40px)/6)]">
```

Update scan button inner styling — reduce padding and icon size:

```html
<button
  type="button"
  aria-label="Сканировать чек"
  class="relative flex flex-col items-center gap-1 py-2 md:py-3 rounded-xl md:rounded-2xl bg-surface-light dark:bg-surface-dark border-2 border-primary/20 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-primary/40 active:scale-95 active:translate-y-0 active:shadow-sm transition-[transform,box-shadow,border-color] duration-200 group cursor-pointer w-full"
  @click="emit('scan-click')"
>
```

Update scan icon container size from `w-10 h-10 md:w-12 md:h-12` to `w-8 h-8 md:w-9 md:h-9`:

```html
<div
  class="relative z-10 w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center bg-primary transition-transform duration-200 group-hover:scale-110 shadow-sm shadow-primary/30"
>
```

Update scan label size to `text-[10px] md:text-xs`:

```html
<span
  class="relative z-10 text-[10px] md:text-xs font-semibold text-text-primary-light dark:text-text-primary-dark whitespace-nowrap transition-colors"
>
  Скан
</span>
```

- [ ] **Step 4: Update quick action button dimensions**

Change the button class — width, height, padding, gap:

```html
<button
  v-for="(action, index) in slots"
  :key="action?.id ?? `empty-${index}`"
  :aria-label="
    action
      ? `Добавить расход: ${action.label}`
      : `Настроить быстрое действие, слот ${index + 1}`
  "
  class="flex flex-col items-center gap-1 py-2 md:py-3 rounded-xl md:rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-md hover:-translate-y-1 hover:bg-card-light dark:hover:bg-card-dark active:scale-95 active:translate-y-0 active:shadow-sm transition-[transform,box-shadow,background-color] duration-200 group cursor-pointer snap-start shrink-0 w-[calc((100%-40px)/6)]"
  @click="emit('click', action)"
  @contextmenu.prevent="emit('long-press', action)"
>
```

- [ ] **Step 5: Update filled slot icon and label sizes**

Change icon container from `w-10 h-10 md:w-12 md:h-12` to `w-8 h-8 md:w-9 md:h-9`:

```html
<div
  class="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
  :style="{
    backgroundColor: (categoryMap.get(action.categoryId)?.color ?? '#64748b') + '1A',
  }"
>
  <UIcon
    :name="categoryMap.get(action.categoryId)?.icon ?? 'receipt_long'"
    size="xs"
    :style="{
      color: categoryMap.get(action.categoryId)?.color ?? '#64748b',
    }"
  />
</div>
```

Update label to `text-[10px]` and truncate:

```html
<span
  class="text-[10px] md:text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark truncate w-full text-center px-0.5 leading-tight"
>
  {{ action.label }}
</span>
```

Add amount display after label (inside the `v-if="action"` template):

```html
<span
  v-if="action.amount != null"
  class="text-[9px] md:text-[10px] font-medium text-text-tertiary-light dark:text-text-tertiary-dark leading-tight"
>
  {{ action.amount }}
</span>
```

- [ ] **Step 6: Update empty slot icon and label sizes**

Change empty icon container to `w-8 h-8 md:w-9 md:h-9 rounded-lg`:

```html
<div
  class="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center bg-border-light/50 dark:bg-border-dark/50 group-hover:bg-border-light dark:group-hover:bg-border-dark transition-colors duration-200"
>
  <UIcon
    name="add"
    size="xs"
    class="text-text-tertiary-light dark:text-text-tertiary-dark group-hover:text-text-secondary-light dark:group-hover:text-text-secondary-dark"
  />
</div>
```

Change empty label size to `text-[10px] md:text-xs`:

```html
<span
  class="text-[10px] md:text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark group-hover:text-text-secondary-light dark:group-hover:text-text-secondary-dark"
>
  Добавить
</span>
```

- [ ] **Step 7: Verify build**

Run: `cd frontend && bun run build`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/dashboard/ui/DashboardQuickActions.vue
git commit -m "feat(quick-actions): compact button sizing for 6 slots"
```

---

### Task 10: Frontend — Settings Page Update

**Files:**
- Modify: `frontend/src/pages/settings/quick-actions/QuickActionsSettingsPage.vue`

- [ ] **Step 1: Update description text**

Change "до 4" to "до 6":

```html
<p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
  Настройте до 6 быстрых кнопок на главном экране. Каждая кнопка открывает добавление расхода
  с выбранной категорией и счётом, или создаёт транзакцию мгновенно, если указана сумма.
</p>
```

- [ ] **Step 2: Add amount display to filled slots**

After the account name display (the `<div class="flex items-center gap-1.5 mt-0.5 ...">` block), add amount display:

```html
<div
  v-if="action.amount != null"
  class="flex items-center gap-1.5 mt-0.5 text-text-tertiary-light dark:text-text-tertiary-dark"
>
  <UIcon name="payments" size="xs" class="opacity-70" />
  <p class="text-sm font-medium">
    {{ action.amount }}
  </p>
</div>
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/settings/quick-actions/QuickActionsSettingsPage.vue
git commit -m "feat(quick-actions): update settings page for 6 slots and amount display"
```

---

### Task 11: Full Build Verification & Changelog

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

- [ ] **Step 1: Full backend build**

Run: `cd backend && bun run build`
Expected: No errors

- [ ] **Step 2: Full frontend build**

Run: `cd frontend && bun run build`
Expected: No errors

- [ ] **Step 3: Backend tests**

Run: `cd backend && bun run test`
Expected: All pass

- [ ] **Step 4: Add changelog entry**

Add at the top of `CHANGELOG_ENTRIES` array in `frontend/src/features/changelog/model/changelogData.ts`:

```typescript
{
  version: '1.0.39',
  date: '2026-03-20',
  entries: [
    {
      type: 'feature',
      description: 'Быстрые действия: указание суммы для мгновенного создания транзакций',
    },
    {
      type: 'feature',
      description: 'Быстрые действия: кастомные названия кнопок',
    },
    {
      type: 'improvement',
      description: 'Быстрые действия: 6 слотов вместо 4, компактный размер кнопок',
    },
  ],
},
```

(Verify the correct version number by checking the current latest version in the file first)

- [ ] **Step 5: Final commit**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "feat(quick-actions): add changelog entry for v1.0.39"
```
