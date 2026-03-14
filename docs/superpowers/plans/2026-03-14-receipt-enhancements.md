# Receipt Scanner Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add desktop delete button, split item functionality, and "paid by" participant linking to the scan-receipt wizard.

**Architecture:** All changes are frontend-only within `frontend/src/features/scan-receipt/`. Types are updated first, then wizard logic, then UI components from inner (ReceiptItemRow) to outer (ScanReceiptPage). No backend changes needed.

**Tech Stack:** Vue 3, TypeScript, Tailwind CSS v4, Reka UI

**Spec:** `docs/superpowers/specs/2026-03-14-receipt-enhancements-design.md`

---

## Chunk 1: Types + Wizard Logic

### Task 1: Update types

**Files:**
- Modify: `frontend/src/features/scan-receipt/model/types.ts`

- [ ] **Step 1: Add `paidById` to `Participant` and `paidByName` to `ParticipantSummary`**

In `frontend/src/features/scan-receipt/model/types.ts`:

```typescript
export interface Participant {
  id: string;
  name: string;
  isMe: boolean;
  color: string;
  paidById: string | null;
}
```

Add `paidByName` to `ParticipantSummary`:

```typescript
export interface ParticipantSummary {
  id: string;
  name: string;
  isMe: boolean;
  color: string;
  itemCount: number;
  total: number;
  items: ParticipantSummaryItem[];
  paidByName?: string;
}
```

- [ ] **Step 2: Fix `allParticipantChip` in Step3AssignParticipants**

In `frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue`, add `paidById: null` to the `allParticipantChip` computed (around line 47–52):

```typescript
const allParticipantChip = computed<Participant>(() => ({
  id: ALL_PARTICIPANTS_ID,
  name: 'На всех',
  color: ALL_PARTICIPANTS_COLOR,
  isMe: false,
  paidById: null,
}));
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS. The `addParticipant` third param is optional so existing call sites won't break. The `allParticipantChip` fix above prevents the only TS error.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/model/types.ts frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue
git commit -m "feat(receipt): add paidById to Participant and paidByName to ParticipantSummary types"
```

---

### Task 2: Add `splitItem` and update wizard logic

**Files:**
- Modify: `frontend/src/features/scan-receipt/model/useReceiptWizard.ts`

- [ ] **Step 1: Add `paidById` to `addParticipant` and fix all `Participant` creation sites**

Update `addParticipant` signature to accept `paidById`:

```typescript
function addParticipant(name: string, isMe = false, paidById: string | null = null) {
  const colorIndex = participants.value.length % ENTITY_COLORS.length;
  participants.value.push({
    id: uid(),
    name,
    isMe,
    color: ENTITY_COLORS[colorIndex] as string,
    paidById,
  });
  trigger('selection');
}
```

- [ ] **Step 2: Update `removeParticipant` to clear stale `paidById` references**

Add to `removeParticipant`, after the existing `participants.value = participants.value.filter(...)` line and before the `items.value.forEach(...)` loop:

```typescript
function removeParticipant(id: string) {
  participants.value = participants.value.filter((p) => p.id !== id);
  // Clear paidById references to the removed participant
  participants.value.forEach((p) => {
    if (p.paidById === id) p.paidById = null;
  });
  // Remove from all item assignments
  items.value.forEach((item) => {
    item.assignedParticipantIds = item.assignedParticipantIds.filter((pid) => pid !== id);
  });
  trigger('warning');
}
```

- [ ] **Step 3: Add `splitItem` function**

Add after the `addItem` function (around line 240):

```typescript
function splitItem(id: string, firstQty: number) {
  const idx = items.value.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const original = items.value[idx];
  const secondQty = original.qty - firstQty;
  if (firstQty <= 0 || secondQty <= 0) return;

  const ratio1 = firstQty / original.qty;

  const item1: ReceiptItem = {
    id: uid(),
    name: `${original.name} (1/2)`,
    qty: firstQty,
    unitPrice: original.unitPrice,
    ocrTotalPrice: original.ocrTotalPrice
      ? Math.round(original.ocrTotalPrice * ratio1)
      : null,
    assignedParticipantIds: [],
  };

  const item2: ReceiptItem = {
    id: uid(),
    name: `${original.name} (2/2)`,
    qty: secondQty,
    unitPrice: original.unitPrice,
    ocrTotalPrice: original.ocrTotalPrice
      ? original.ocrTotalPrice - Math.round(original.ocrTotalPrice * ratio1)
      : null,
    assignedParticipantIds: [],
  };

  items.value.splice(idx, 1, item1, item2);
  trigger('success');
}
```

- [ ] **Step 4: Update `participantSummaries` to redistribute paidBy amounts**

Replace the existing `participantSummaries` computed (lines 84–116) with:

```typescript
const participantSummaries = computed<ParticipantSummary[]>(() => {
  const summaries = participants.value.map((p) => {
    const assignedItems = items.value
      .filter((item) => item.assignedParticipantIds.includes(p.id))
      .map((item) => {
        const sharedWith = item.assignedParticipantIds.length;
        const lineTotal = getItemWithChargesTotal(item);
        const isLast =
          item.assignedParticipantIds[item.assignedParticipantIds.length - 1] === p.id;
        const baseShare = Math.floor(lineTotal / sharedWith);
        const share = isLast ? lineTotal - baseShare * (sharedWith - 1) : baseShare;
        return {
          id: item.id,
          name: item.name,
          lineTotal,
          share,
          sharedWith,
        };
      });

    return {
      id: p.id,
      name: p.name,
      isMe: p.isMe,
      color: p.color,
      itemCount: assignedItems.length,
      total: assignedItems.reduce((sum, i) => sum + i.share, 0),
      items: assignedItems,
    } as ParticipantSummary;
  });

  // Redistribute paidBy amounts: add paid-for participant's total to their payer
  for (const summary of summaries) {
    const participant = participants.value.find((p) => p.id === summary.id);
    if (participant?.paidById) {
      const payer = summaries.find((s) => s.id === participant.paidById);
      if (payer) {
        payer.total += summary.total;
        summary.paidByName = payer.name;
      }
    }
  }

  return summaries;
});
```

- [ ] **Step 5: Update `handleSubmit` to skip paid-for participants in debt creation**

Replace the `nonMeSummaries` filter in `handleSubmit` (around line 337):

```typescript
const nonMeSummaries = participantSummaries.value.filter((p) => {
  if (p.isMe) return false;
  if (p.total <= 0) return false;
  const participant = participants.value.find((pp) => pp.id === p.id);
  if (participant?.paidById) return false;
  return true;
});
```

- [ ] **Step 6: Add `splitItem` to the return object**

Add `splitItem` to the return object, in the `// Step 2` section:

```typescript
// Step 2
items,
currency,
storeName,
receiptDate,
subtotal,
charges,
chargesAmount,
totalChargePercent,
totalAmount,
getItemWithChargesTotal,
updateItem,
deleteItem,
addItem,
splitItem,  // <-- add this
addCharge,
removeCharge,
toggleCharge,
updateChargePercent,
```

- [ ] **Step 7: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS. The `addParticipant` third param is optional and `allParticipantChip` was already patched in Task 1.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/scan-receipt/model/useReceiptWizard.ts
git commit -m "feat(receipt): add splitItem, paidBy logic, and updated debt creation"
```

---

## Chunk 2: ReceiptItemRow + Step2EditItems UI

### Task 3: Add desktop delete button and split trigger to ReceiptItemRow

**Files:**
- Modify: `frontend/src/features/scan-receipt/ui/ReceiptItemRow.vue`

- [ ] **Step 1: Add `useIsDesktop` import and split emit**

Add import at top of `<script setup>`:

```typescript
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
```

Add `const isDesktop = useIsDesktop();` after `const { trigger } = useHaptics();`.

Add `split` to emits:

```typescript
const emit = defineEmits<{
  update: [updates: Partial<ReceiptItem>];
  delete: [];
  split: [];
  focusNext: [currentField: 'name' | 'price' | 'qty'];
}>();
```

- [ ] **Step 2: Add right swipe action for split on mobile**

Change the `SwipeableItem` props from:

```html
<SwipeableItem
  :left-action="{ icon: 'delete', color: '#ef4444', label: 'Удалить' }"
  :right-action="undefined"
  @action-left="emit('delete')"
>
```

To:

```html
<SwipeableItem
  :left-action="{ icon: 'delete', color: '#ef4444', label: 'Удалить' }"
  :right-action="{ icon: 'call_split', color: '#8b5cf6', label: 'Разделить' }"
  @action-left="emit('delete')"
  @action-right="emit('split')"
>
```

- [ ] **Step 3: Add desktop action buttons (delete + split) next to the line total**

In Row 1 (the `<div class="flex items-center gap-2 mb-1.5">` block), replace the line total `<span>` and add action buttons after it. Replace from the closing `</input>` tag of the name input to the end of the `mb-1.5` div:

```html
        <span class="text-body-sm font-bold tabular-nums shrink-0 text-primary">
          {{ formatCurrency(hasCharges ? lineTotalWithCharges : lineTotal, currency) }}
        </span>

        <!-- Desktop action buttons -->
        <div v-if="isDesktop" class="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            :aria-label="`Разделить позицию ${index + 1}`"
            class="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary-light dark:text-text-tertiary-dark hover:text-primary hover:bg-primary/5 active:scale-90 transition-all"
            @click.stop="emit('split')"
          >
            <UIcon name="call_split" size="xs" />
          </button>
          <button
            type="button"
            :aria-label="`Удалить позицию ${index + 1}`"
            class="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary-light dark:text-text-tertiary-dark hover:text-danger hover:bg-danger/5 active:scale-90 transition-all"
            @click.stop="emit('delete')"
          >
            <UIcon name="delete" size="xs" />
          </button>
        </div>
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/ReceiptItemRow.vue
git commit -m "feat(receipt): add desktop delete/split buttons and mobile split swipe"
```

---

### Task 4: Add split modal to Step2EditItems

**Files:**
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step2EditItems.vue`

- [ ] **Step 1: Add split emit and modal state**

Add `splitItem` to emits:

```typescript
const emit = defineEmits<{
  updateItem: [id: string, updates: Partial<ReceiptItem>];
  deleteItem: [id: string];
  addItem: [];
  splitItem: [id: string, firstQty: number];
  addCharge: [label: string, percent: number];
  removeCharge: [id: string];
  toggleCharge: [id: string];
  updateChargePercent: [id: string, percent: number];
  next: [];
  back: [];
}>();
```

Add `UModal` to imports:

```typescript
import { UButton, UBadge, UIcon, UModal } from '@/shared/ui';
```

Add split modal state after `const addChargeOpen = ref(false);`:

```typescript
// Split modal state
const splitModalOpen = ref(false);
const splitItem = ref<ReceiptItem | null>(null);
const splitFirstQty = ref(0);

const splitSecondQty = computed(() => {
  if (!splitItem.value) return 0;
  return splitItem.value.qty - splitFirstQty.value;
});

const splitValid = computed(() => {
  return splitFirstQty.value > 0 && splitSecondQty.value > 0;
});

function openSplitModal(item: ReceiptItem) {
  splitItem.value = item;
  splitFirstQty.value = Math.floor(item.qty / 2);
  splitModalOpen.value = true;
}

function confirmSplit() {
  if (!splitItem.value || !splitValid.value) return;
  emit('splitItem', splitItem.value.id, splitFirstQty.value);
  splitModalOpen.value = false;
  splitItem.value = null;
  trigger('success');
}
```

- [ ] **Step 2: Add `@split` handler on ReceiptItemRow**

Update the `<ReceiptItemRow>` in the template to add the split handler:

```html
<ReceiptItemRow
  v-for="(item, index) in items"
  ref="itemRows"
  :key="item.id"
  :item="item"
  :index="index"
  :currency="currency"
  :charges="charges"
  :is-invalid="invalidItemId === item.id"
  @update="
    emit('updateItem', item.id, $event);
    if (invalidItemId === item.id) {
      validationError = null;
      invalidItemId = null;
    }
  "
  @delete="emit('deleteItem', item.id)"
  @split="openSplitModal(item)"
  @focus-next="handleFocusNext(index, $event)"
/>
```

- [ ] **Step 3: Add split modal template**

Add before the closing `</div>` of the root element (after the sticky glass footer):

```html
<!-- Split Modal -->
<UModal v-model="splitModalOpen" title="Разделить позицию">
  <div v-if="splitItem" class="space-y-4">
    <!-- Item being split -->
    <div class="px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark">
      <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        {{ splitItem.name }}
      </p>
      <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
        Количество: {{ splitItem.qty }}
      </p>
    </div>

    <!-- First part input -->
    <div>
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block">
        Первая часть
      </label>
      <input
        v-model.number="splitFirstQty"
        type="number"
        inputmode="decimal"
        step="0.01"
        min="0.01"
        :max="splitItem.qty - 0.01"
        class="w-full px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-medium text-text-primary-light dark:text-text-primary-dark outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 tabular-nums"
      />
    </div>

    <!-- Second part (auto-calculated) -->
    <div>
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block">
        Вторая часть
      </label>
      <div
        class="w-full px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-medium tabular-nums"
        :class="splitSecondQty > 0 ? 'text-text-primary-light dark:text-text-primary-dark' : 'text-danger'"
      >
        {{ splitSecondQty > 0 ? splitSecondQty : 'Некорректное значение' }}
      </div>
    </div>

    <!-- Preview of amounts -->
    <div v-if="splitValid" class="space-y-1.5 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/10">
      <div class="flex justify-between text-xs">
        <span class="text-text-secondary-light dark:text-text-secondary-dark">Часть 1 ({{ splitFirstQty }})</span>
        <span class="font-medium text-text-primary-light dark:text-text-primary-dark tabular-nums">
          {{ formatCurrency(Math.round(splitItem.unitPrice * splitFirstQty), currency) }}
        </span>
      </div>
      <div class="flex justify-between text-xs">
        <span class="text-text-secondary-light dark:text-text-secondary-dark">Часть 2 ({{ splitSecondQty }})</span>
        <span class="font-medium text-text-primary-light dark:text-text-primary-dark tabular-nums">
          {{ formatCurrency(Math.round(splitItem.unitPrice * splitSecondQty), currency) }}
        </span>
      </div>
    </div>
  </div>

  <template #actions>
    <UButton
      variant="primary"
      size="lg"
      full-width
      :disabled="!splitValid"
      @click="confirmSplit"
    >
      <UIcon name="call_split" size="sm" class="mr-2" />
      Разделить
    </UButton>
  </template>
</UModal>
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/steps/Step2EditItems.vue
git commit -m "feat(receipt): add split item modal with proportional preview"
```

---

### Task 5: Wire splitItem in ScanReceiptPage

**Files:**
- Modify: `frontend/src/pages/scan-receipt/ScanReceiptPage.vue`

- [ ] **Step 1: Add `@split-item` binding on Step2EditItems**

In `ScanReceiptPage.vue`, add `@split-item` to the `<Step2EditItems>` component (around line 93–111):

```html
<Step2EditItems
  v-else-if="wizard.currentStep.value === 2"
  key="step-2"
  :items="wizard.items.value"
  :currency="wizard.currency.value"
  :subtotal="wizard.subtotal.value"
  :charges="wizard.charges.value"
  :charges-amount="wizard.chargesAmount.value"
  :total-amount="wizard.totalAmount.value"
  @update-item="wizard.updateItem"
  @delete-item="wizard.deleteItem"
  @add-item="wizard.addItem"
  @split-item="wizard.splitItem"
  @add-charge="wizard.addCharge"
  @remove-charge="wizard.removeCharge"
  @toggle-charge="wizard.toggleCharge"
  @update-charge-percent="wizard.updateChargePercent"
  @next="wizard.goNext"
  @back="wizard.goBack"
/>
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/scan-receipt/ScanReceiptPage.vue
git commit -m "feat(receipt): wire splitItem event from Step2 to wizard"
```

---

## Chunk 3: PaidBy UI (Step3 + ParticipantChip + Step4)

### Task 6: Add "Кто платит?" to Step3AssignParticipants modal

**Files:**
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue`

- [ ] **Step 1: Update `addParticipant` emit signature**

Change the emit type:

```typescript
const emit = defineEmits<{
  addParticipant: [name: string, isMe: boolean, paidById: string | null];
  removeParticipant: [id: string];
  toggleItemParticipant: [itemId: string, participantId: string];
  next: [];
  back: [];
}>();
```

- [ ] **Step 2: Add paidBy state and available payers computed**

After `const selectedContactIds = ref<Set<string>>(new Set());` add:

```typescript
const selectedPaidById = ref<string | null>(null);

/** Participants eligible to be a payer (not themselves paid-for, excludes "Я" from payer list only if "Я" already exists) */
const availablePayers = computed(() =>
  props.participants.filter((p) => !p.paidById),
);
```

- [ ] **Step 3: Update `addMe` to pass `paidById: null`**

```typescript
function addMe() {
  trigger('selection');
  emit('addParticipant', 'Я', true, null);
}
```

- [ ] **Step 4: Update `confirmAddManual` to pass `paidById`**

```typescript
function confirmAddManual() {
  const trimmed = newName.value.trim();
  if (!trimmed) return;
  if (existingNames.value.has(trimmed.toLowerCase())) {
    nameError.value = 'Этот участник уже добавлен';
    return;
  }
  pendingNames.value.add(trimmed.toLowerCase());
  emit('addParticipant', trimmed, false, selectedPaidById.value);
  newName.value = '';
  nameError.value = '';
  selectedPaidById.value = null;
  trigger('selection');
  nextTick(() => {
    manualInputRef.value?.focus();
  });
}
```

- [ ] **Step 5: Update `confirmAddAll` to pass `paidById`**

```typescript
function confirmAddAll() {
  for (const contactId of selectedContactIds.value) {
    const person = people.value.find((p) => p.id === contactId);
    if (person && !existingNames.value.has(person.name.toLowerCase())) {
      emit('addParticipant', person.name, false, selectedPaidById.value);
    }
  }
  trigger('success');
  selectedPaidById.value = null;
  addParticipantOpen.value = false;
}
```

- [ ] **Step 6: Reset paidBy state in `openAddParticipantSheet`**

Add `selectedPaidById.value = null;` to `openAddParticipantSheet()`.

- [ ] **Step 7: Add "Кто платит?" UI in modal**

In the modal template, add the paidBy select **after** the manual name input section (`<!-- Manual name input -->`) and **before** the `<!-- Added participants preview -->` section:

```html
<!-- "Кто платит?" selector -->
<div v-if="participants.length > 1">
  <p class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">
    Кто платит?
  </p>
  <div class="flex flex-wrap gap-1.5">
    <button
      type="button"
      class="px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95"
      :class="
        selectedPaidById === null
          ? 'bg-primary text-white'
          : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark'
      "
      @click="selectedPaidById = null"
    >
      Сам
    </button>
    <button
      v-for="payer in availablePayers"
      :key="payer.id"
      type="button"
      class="px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95"
      :class="
        selectedPaidById === payer.id
          ? 'text-white'
          : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark'
      "
      :style="selectedPaidById === payer.id ? { backgroundColor: payer.color } : {}"
      @click="selectedPaidById = payer.id"
    >
      {{ payer.name }}
    </button>
  </div>
</div>
```

- [ ] **Step 8: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue
git commit -m "feat(receipt): add 'Кто платит?' paidBy selector in add participant modal"
```

---

### Task 7: Show "→ Name" on ParticipantChip for paidBy participants

**Files:**
- Modify: `frontend/src/features/scan-receipt/ui/ParticipantChip.vue`

- [ ] **Step 1: Add `paidByName` prop**

Add a new optional prop. Update the `defineProps`:

```typescript
const props = defineProps<{
  participant: Participant;
  isActive: boolean;
  paidByName?: string;
}>();
```

- [ ] **Step 2: Add paidBy label in template**

After the participant name `<span>`, add a paidBy indicator:

```html
<span class="text-sm font-medium whitespace-nowrap">
  {{ participant.name }}
</span>
<span
  v-if="paidByName"
  class="text-[10px] opacity-70 whitespace-nowrap"
  :class="isActive ? 'text-white/70' : 'text-text-tertiary-light dark:text-text-tertiary-dark'"
>
  → {{ paidByName }}
</span>
```

- [ ] **Step 3: Update Step3AssignParticipants to pass paidByName to ParticipantChip**

In `Step3AssignParticipants.vue`, update the `<ParticipantChip>` rendering to pass `paidByName`. Find the participant chips section and update:

```html
<ParticipantChip
  v-for="p in participants"
  :key="p.id"
  :participant="p"
  :is-active="activeParticipantId === p.id"
  :paid-by-name="p.paidById ? participants.find(pp => pp.id === p.paidById)?.name : undefined"
  @click="setActiveParticipant(p.id)"
/>
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/ParticipantChip.vue frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue
git commit -m "feat(receipt): show paidBy indicator on participant chips"
```

---

### Task 8: Update Step4Summary and PersonSummaryCard for paidBy display

**Files:**
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue`
- Modify: `frontend/src/features/scan-receipt/ui/PersonSummaryCard.vue`

- [ ] **Step 1: Add paidByName display to PersonSummaryCard**

In `PersonSummaryCard.vue`, after the `(вы)` span inside the header button, add:

```html
<span
  v-if="participant.paidByName"
  class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark font-normal"
>
  · платит {{ participant.paidByName }}
</span>
```

- [ ] **Step 2: Update `owers` computed in Step4Summary to exclude paid-for participants**

In `Step4Summary.vue`, update the `owers` computed (line 76):

```typescript
const owers = computed(() =>
  props.participantSummaries.filter((p) => !p.isMe && p.total > 0 && !p.paidByName),
);
```

And update `debtCount` (line 79):

```typescript
const debtCount = computed(
  () => props.participantSummaries.filter((p) => !p.isMe && p.itemCount > 0 && !p.paidByName).length,
);
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue frontend/src/features/scan-receipt/ui/PersonSummaryCard.vue
git commit -m "feat(receipt): show paidBy labels in summary and exclude from debt count"
```

---

## Chunk 4: Icon mapping + Final verification

### Task 9: Add `call_split` icon mapping

**Files:**
- Modify: `frontend/src/shared/ui/icon/iconMap.ts`

- [ ] **Step 1: Update `call_split` icon mapping**

`call_split` already exists in `frontend/src/shared/ui/icon/iconMap.ts` (line 156) but maps to `Share2` — the same icon as `share`. Replace it with `Scissors` for better semantic clarity.

Add `Scissors` to the import block (after `Search,`):

```typescript
Scissors,
```

Then change the mapping:

```typescript
call_split: Scissors,
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/ui/icon/iconMap.ts
git commit -m "feat(icons): add call_split icon mapping for split item feature"
```

---

### Task 10: Full build verification and manual test

- [ ] **Step 1: Run full build**

Run: `cd frontend && bun run build`
Expected: PASS with no errors

- [ ] **Step 2: Start dev server and manually test**

Run: `cd frontend && bun run dev`

Manual test checklist:
1. Go to scan-receipt page
2. Upload/scan a receipt photo
3. On Step 2: verify desktop delete button visible, click to delete an item
4. On Step 2: click split icon → modal opens, enter qty, verify preview, confirm split → two items appear
5. On Step 2: on mobile, swipe right on item → split action triggers
6. On Step 3: add "Я", then add another participant with "Кто платит?" set to "Я"
7. On Step 3: verify participant chip shows "→ Я" label
8. On Step 4: verify payer's total includes paid-for participant's share
9. On Step 4: verify paid-for participant shows "платит [Name]" label
10. On Step 4: verify debt count excludes paid-for participants
11. Submit and verify correct debt creation

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(receipt): address issues found during manual testing"
```
