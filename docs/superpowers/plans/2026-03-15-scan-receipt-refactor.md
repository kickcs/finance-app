# Scan Receipt Refactoring — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose large scan-receipt components into focused units (<250 lines each) while keeping external API unchanged.

**Architecture:** Extract 4 sub-composables from monolithic wizard, extract 8 UI components from 3 Step components. ScanReceiptPage.vue requires zero changes.

**Tech Stack:** Vue 3, TypeScript, Composition API

**Spec:** `docs/superpowers/specs/2026-03-15-scan-receipt-refactor-design.md`

**Verification:** `cd frontend && bun run build` (type-check + Vite build) after each task. This is a pure refactoring — no new behavior, no new tests.

---

## Chunk 1: Wizard Composable Split

Split `useReceiptWizard.ts` (486 lines) into orchestrator + 4 step composables. External return API stays identical.

### Task 1: Extract usePhotoStep

**Files:**
- Create: `frontend/src/features/scan-receipt/model/usePhotoStep.ts`
- Modify: `frontend/src/features/scan-receipt/model/useReceiptWizard.ts`

- [ ] **Step 1: Create usePhotoStep.ts**

Extract from `useReceiptWizard.ts` lines 33–220: photo state (selectedFile, previewUrl, isOcrLoading, isOcrSuccess, ocrError), storeName, currency, and functions (selectFile, resetPhoto, scanReceipt). Also extract `items` population and `formData` seeding from OCR result into a callback.

**Note:** Spec defines signature as `usePhotoStep(goNext)`, but the orchestrator needs a callback to seed items/charges/formData from OCR results. Extending to `usePhotoStep(onOcrSuccess, goNext)` — intentional deviation from spec for clean data flow.

```ts
// frontend/src/features/scan-receipt/model/usePhotoStep.ts
import { ref, onUnmounted } from 'vue';
import { useHaptics } from '@/shared/lib/haptics';
import { receiptApi, type ScanReceiptResponse } from '../api/receiptApi';

export interface OcrResult {
  items: ScanReceiptResponse['items'];
  currency: string;
  storeName: string | null;
  serviceChargePercent: number | null;
  hashtags: string[];
  date: string | null;
}

export function usePhotoStep(onOcrSuccess: (result: OcrResult) => void, goNext: () => void) {
  const { trigger } = useHaptics();

  const selectedFile = ref<File | null>(null);
  const previewUrl = ref<string | null>(null);
  const isOcrLoading = ref(false);
  const isOcrSuccess = ref(false);
  const ocrError = ref<string | null>(null);

  function selectFile(file: File) {
    selectedFile.value = file;
    previewUrl.value = URL.createObjectURL(file);
    ocrError.value = null;
    scanReceipt();
  }

  function resetPhoto() {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    selectedFile.value = null;
    previewUrl.value = null;
    isOcrLoading.value = false;
    isOcrSuccess.value = false;
    ocrError.value = null;
  }

  async function scanReceipt() {
    if (!selectedFile.value) return;
    isOcrLoading.value = true;
    ocrError.value = null;

    try {
      const result: ScanReceiptResponse = await receiptApi.scan(selectedFile.value);

      onOcrSuccess({
        items: result.items,
        currency: result.currency,
        storeName: result.storeName,
        serviceChargePercent: result.serviceChargePercent ?? null,
        hashtags: result.hashtags ?? [],
        date: result.date ?? null,
      });

      isOcrSuccess.value = true;
      trigger('success');
      setTimeout(() => goNext(), 600);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const fileInfo = selectedFile.value
        ? `[${selectedFile.value.type || 'unknown'}, ${Math.round(selectedFile.value.size / 1024)}KB]`
        : '';
      ocrError.value = `${msg} ${fileInfo}`.trim();
      trigger('error');
    } finally {
      isOcrLoading.value = false;
    }
  }

  onUnmounted(() => {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = null;
    }
  });

  return {
    selectedFile,
    previewUrl,
    isOcrLoading,
    isOcrSuccess,
    ocrError,
    selectFile,
    resetPhoto,
    scanReceipt,
  };
}
```

- [ ] **Step 2: Wire usePhotoStep into useReceiptWizard**

In `useReceiptWizard.ts`, replace the photo state/functions block (lines 33–220) with:

```ts
import { usePhotoStep, type OcrResult } from './usePhotoStep';

// Inside useReceiptWizard:
const photo = usePhotoStep(handleOcrResult, goNext);

function handleOcrResult(result: OcrResult) {
  // Filter out service charge / tax / discount line items
  const serviceKeywords =
    /обслуживание|service|чаевые|tip|ндс|vat|tax|скидка|discount|delivery|доставка/i;
  const productItems = result.items.filter((item) => !serviceKeywords.test(item.name));

  items.value = productItems.map((item) => ({
    id: uid(),
    name: item.name,
    qty: item.quantity,
    unitPrice: item.unitPrice,
    ocrTotalPrice: item.totalPrice ?? null,
    assignedParticipantIds: [],
  }));
  currency.value = result.currency;
  formData.value.currency = result.currency;
  storeName.value = result.storeName;

  const rawPercent = result.serviceChargePercent;
  if (rawPercent && rawPercent >= 0.1) {
    charges.value = [{ id: uid(), label: 'Обслуживание', percent: rawPercent, enabled: true }];
  } else {
    charges.value = [];
  }

  if (result.hashtags.length > 0) {
    formData.value.description = result.hashtags.join(' ');
  } else if (result.storeName) {
    formData.value.description = `#${result.storeName.replace(/[^a-zа-яёA-ZА-ЯЁ0-9]/g, '').toLowerCase()}`;
  }
  if (result.date) {
    formData.value.date = new Date(result.date).getTime();
  }
}
```

Update the return block to spread `photo`:

```ts
return {
  currentStep,
  direction,
  goNext,
  goBack,
  // Step 1 — from usePhotoStep
  ...photo,
  // ... rest stays same for now
};
```

Note: `handleOcrResult` stays in the orchestrator because it writes to `items`, `charges`, `formData`, `storeName`, `currency` — all owned by other steps that aren't extracted yet. This callback will be simplified in Task 5 once all steps are extracted.

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`
Expected: successful build, zero type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/model/usePhotoStep.ts frontend/src/features/scan-receipt/model/useReceiptWizard.ts
git commit -m "refactor(receipt): extract usePhotoStep from wizard"
```

---

### Task 2: Extract useItemsStep

**Files:**
- Create: `frontend/src/features/scan-receipt/model/useItemsStep.ts`
- Modify: `frontend/src/features/scan-receipt/model/useReceiptWizard.ts`

- [ ] **Step 1: Create useItemsStep.ts**

Extract from `useReceiptWizard.ts`: `items` ref, `currency` ref, `storeName` ref, `charges` ref, all computeds (subtotal, totalChargePercent, chargesAmount, totalAmount, getItemWithChargesTotal), and all CRUD functions (updateItem, deleteItem, addItem, splitItem, addCharge, removeCharge, toggleCharge, updateChargePercent). Also move `uid()` helper here.

```ts
// frontend/src/features/scan-receipt/model/useItemsStep.ts
import { ref, computed } from 'vue';
import { useHaptics } from '@/shared/lib/haptics';
import { calcLineTotal, calcLineTotalWithCharges, getTotalChargePercent } from './calcLineTotal';
import type { ReceiptItem, ReceiptCharge } from './types';

let nextId = 0;
export function uid(): string {
  return `ri_${++nextId}_${Date.now()}`;
}

export function useItemsStep() {
  const { trigger } = useHaptics();

  const items = ref<ReceiptItem[]>([]);
  const currency = ref('UZS');
  const storeName = ref<string | null>(null);
  const charges = ref<ReceiptCharge[]>([]);

  const subtotal = computed(() => items.value.reduce((sum, item) => sum + calcLineTotal(item), 0));
  const totalChargePercent = computed(() => getTotalChargePercent(charges.value));
  const chargesAmount = computed(() => {
    if (!totalChargePercent.value) return 0;
    return Math.round((subtotal.value * totalChargePercent.value) / 100);
  });
  const totalAmount = computed(() => subtotal.value + chargesAmount.value);

  function getItemWithChargesTotal(item: ReceiptItem): number {
    return calcLineTotalWithCharges(item, charges.value);
  }

  function updateItem(id: string, updates: Partial<ReceiptItem>) {
    const idx = items.value.findIndex((i) => i.id === id);
    if (idx !== -1) {
      if ('qty' in updates || 'unitPrice' in updates) {
        updates.ocrTotalPrice = null;
      }
      items.value[idx] = { ...items.value[idx], ...updates };
    }
  }

  function deleteItem(id: string) {
    items.value = items.value.filter((i) => i.id !== id);
    trigger('warning');
  }

  function addItem(): string {
    const id = uid();
    items.value.push({
      id,
      name: '',
      qty: 1,
      unitPrice: 0,
      ocrTotalPrice: null,
      assignedParticipantIds: [],
    });
    trigger('selection');
    return id;
  }

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
      ocrTotalPrice: original.ocrTotalPrice ? Math.round(original.ocrTotalPrice * ratio1) : null,
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

  function addCharge(label: string, percent: number) {
    charges.value.push({ id: uid(), label, percent, enabled: true });
    trigger('selection');
  }

  function removeCharge(id: string) {
    charges.value = charges.value.filter((c) => c.id !== id);
    trigger('warning');
  }

  function toggleCharge(id: string) {
    const charge = charges.value.find((c) => c.id === id);
    if (charge) {
      charge.enabled = !charge.enabled;
      trigger('selection');
    }
  }

  function updateChargePercent(id: string, percent: number) {
    const charge = charges.value.find((c) => c.id === id);
    if (charge) {
      charge.percent = percent;
    }
  }

  return {
    items,
    currency,
    storeName,
    charges,
    subtotal,
    totalChargePercent,
    chargesAmount,
    totalAmount,
    getItemWithChargesTotal,
    updateItem,
    deleteItem,
    addItem,
    splitItem,
    addCharge,
    removeCharge,
    toggleCharge,
    updateChargePercent,
  };
}
```

- [ ] **Step 2: Wire useItemsStep into useReceiptWizard**

Replace items/charges state, computeds, and CRUD functions with:

```ts
import { useItemsStep, uid } from './useItemsStep';

// Inside useReceiptWizard:
const itemsStep = useItemsStep();
const { items, currency, storeName, charges } = itemsStep;
```

Update `handleOcrResult` to use `uid` from useItemsStep import. Spread `itemsStep` in return.

Remove: `uid()` function, `items` ref, `currency` ref, `storeName` ref, `charges` ref, all computeds (subtotal, totalChargePercent, chargesAmount, totalAmount, getItemWithChargesTotal), and all item/charge CRUD functions.

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/model/useItemsStep.ts frontend/src/features/scan-receipt/model/useReceiptWizard.ts
git commit -m "refactor(receipt): extract useItemsStep from wizard"
```

---

### Task 3: Extract useParticipantsStep

**Files:**
- Create: `frontend/src/features/scan-receipt/model/useParticipantsStep.ts`
- Modify: `frontend/src/features/scan-receipt/model/useReceiptWizard.ts`

- [ ] **Step 1: Create useParticipantsStep.ts**

Extract from `useReceiptWizard.ts`: `participants` ref, `addParticipant`, `removeParticipant`, `toggleItemParticipant`, `hasMe` computed, `unassignedCount` computed.

```ts
// frontend/src/features/scan-receipt/model/useParticipantsStep.ts
import { ref, computed, type Ref } from 'vue';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { useHaptics } from '@/shared/lib/haptics';
import { ALL_PARTICIPANTS_ID } from './constants';
import type { ReceiptItem, Participant } from './types';

let nextPId = 0;
function puid(): string {
  return `rp_${++nextPId}_${Date.now()}`;
}

export function useParticipantsStep(items: Ref<ReceiptItem[]>) {
  const { trigger } = useHaptics();

  const participants = ref<Participant[]>([]);

  const hasMe = computed(() => participants.value.some((p) => p.isMe));

  const unassignedCount = computed(
    () => items.value.filter((item) => item.assignedParticipantIds.length === 0).length,
  );

  function addParticipant(name: string, isMe = false, paidById: string | null = null) {
    const colorIndex = participants.value.length % ENTITY_COLORS.length;
    participants.value.push({
      id: puid(),
      name,
      isMe,
      color: ENTITY_COLORS[colorIndex] as string,
      paidById,
    });
    trigger('selection');
  }

  function removeParticipant(id: string) {
    participants.value = participants.value.filter((p) => p.id !== id);
    participants.value.forEach((p) => {
      if (p.paidById === id) p.paidById = null;
    });
    items.value.forEach((item) => {
      item.assignedParticipantIds = item.assignedParticipantIds.filter((pid) => pid !== id);
    });
    trigger('warning');
  }

  function toggleItemParticipant(itemId: string, participantId: string) {
    const item = items.value.find((i) => i.id === itemId);
    if (!item) return;

    if (participantId === ALL_PARTICIPANTS_ID) {
      const allIds = participants.value.map((p) => p.id);
      const isAssignedToAll = allIds.every((id) => item.assignedParticipantIds.includes(id));
      if (isAssignedToAll) {
        item.assignedParticipantIds = [];
      } else {
        item.assignedParticipantIds = [...allIds];
      }
    } else {
      const idx = item.assignedParticipantIds.indexOf(participantId);
      if (idx === -1) {
        item.assignedParticipantIds.push(participantId);
      } else {
        item.assignedParticipantIds.splice(idx, 1);
      }
    }
    trigger('selection');
  }

  return {
    participants,
    hasMe,
    unassignedCount,
    addParticipant,
    removeParticipant,
    toggleItemParticipant,
  };
}
```

- [ ] **Step 2: Wire useParticipantsStep into useReceiptWizard**

```ts
import { useParticipantsStep } from './useParticipantsStep';

const participantsStep = useParticipantsStep(items);
const { participants } = participantsStep;
```

Remove participants ref, hasMe, unassignedCount, addParticipant, removeParticipant, toggleItemParticipant from wizard. Spread `participantsStep` in return.

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/model/useParticipantsStep.ts frontend/src/features/scan-receipt/model/useReceiptWizard.ts
git commit -m "refactor(receipt): extract useParticipantsStep from wizard"
```

---

### Task 4: Extract useSubmitStep

**Files:**
- Create: `frontend/src/features/scan-receipt/model/useSubmitStep.ts`
- Modify: `frontend/src/features/scan-receipt/model/useReceiptWizard.ts`

- [ ] **Step 1: Create useSubmitStep.ts**

Extract from `useReceiptWizard.ts`: `formData` ref, `isSubmitting`, `submitError`, `isSuccess`, `participantSummaries` computed, `handleSubmit`, `isFormValid`.

```ts
// frontend/src/features/scan-receipt/model/useSubmitStep.ts
import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useHaptics } from '@/shared/lib/haptics';
import { transactionsApi } from '@/entities/transaction';
import { debtsApi, debtQueryKeys } from '@/entities/debt';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import type {
  ReceiptItem,
  Participant,
  ParticipantSummary,
  ScanReceiptFormData,
} from './types';

export function useSubmitStep(
  userId: () => string | null,
  items: Ref<ReceiptItem[]>,
  participants: Ref<Participant[]>,
  storeName: Ref<string | null>,
  totalAmount: ComputedRef<number>,
  getItemWithChargesTotal: (item: ReceiptItem) => number,
) {
  const { trigger } = useHaptics();
  const queryClient = useQueryClient();

  const formData = ref<ScanReceiptFormData>({
    accountId: null,
    categoryId: '',
    description: '',
    date: Date.now(),
    createDebts: true,
    currency: 'UZS',
  });
  const isSubmitting = ref(false);
  const submitError = ref<string | null>(null);
  const isSuccess = ref(false);

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
          return { id: item.id, name: item.name, lineTotal, share, sharedWith };
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

    for (const summary of summaries) {
      const participant = participants.value.find((p) => p.id === summary.id);
      if (participant?.paidById) {
        const payer = summaries.find((s) => s.id === participant.paidById);
        if (payer) {
          payer.total += summary.total;
          summary.paidById = participant.paidById;
          summary.paidByName = payer.name;
        }
      }
    }

    return summaries;
  });

  async function handleSubmit() {
    const uid_ = userId();
    if (!uid_ || !formData.value.accountId || !formData.value.categoryId) return;

    isSubmitting.value = true;
    submitError.value = null;

    try {
      const transaction = await transactionsApi.create({
        user_id: uid_,
        account_id: formData.value.accountId,
        category_id: formData.value.categoryId,
        amount: totalAmount.value,
        currency: formData.value.currency,
        type: 'expense',
        description: formData.value.description || null,
        date: new Date(formData.value.date).toISOString(),
      });

      if (formData.value.createDebts) {
        const nonMeSummaries = participantSummaries.value.filter((p) => {
          if (p.isMe) return false;
          if (p.total <= 0) return false;
          const participant = participants.value.find((pp) => pp.id === p.id);
          if (participant?.paidById) return false;
          return true;
        });
        for (const summary of nonMeSummaries) {
          await debtsApi.create({
            user_id: uid_,
            name: `Чек: ${storeName.value || 'Без названия'}`,
            total_amount: summary.total,
            remaining_amount: summary.total,
            debt_type: 'given',
            person_name: summary.name,
            account_id: formData.value.accountId,
            currency: formData.value.currency,
            source_transaction_id: transaction.id,
          });
        }
      }

      invalidateTransactionRelated(queryClient, uid_);
      invalidateAccountRelated(queryClient, uid_);
      queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(uid_) });

      isSuccess.value = true;
      trigger('success');
    } catch (error: unknown) {
      console.error('Receipt submit failed:', error);
      submitError.value = error instanceof Error ? error.message : 'Произошла ошибка';
      trigger('error');
    } finally {
      isSubmitting.value = false;
    }
  }

  const isFormValid = computed(
    () => !!formData.value.accountId && !!formData.value.categoryId && totalAmount.value > 0,
  );

  return {
    formData,
    isSubmitting,
    submitError,
    isSuccess,
    participantSummaries,
    handleSubmit,
    isFormValid,
  };
}
```

- [ ] **Step 2: Wire useSubmitStep into useReceiptWizard**

```ts
import { useSubmitStep } from './useSubmitStep';

const submitStep = useSubmitStep(userId, items, participants, storeName, itemsStep.totalAmount, itemsStep.getItemWithChargesTotal);
const { formData } = submitStep;
```

Remove formData, isSubmitting, submitError, isSuccess, participantSummaries, handleSubmit, isFormValid, and the private `getItemWithChargesTotal` from wizard. Spread `submitStep` in return.

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/model/useSubmitStep.ts frontend/src/features/scan-receipt/model/useReceiptWizard.ts
git commit -m "refactor(receipt): extract useSubmitStep from wizard"
```

---

### Task 5: Clean up useReceiptWizard orchestrator

**Files:**
- Modify: `frontend/src/features/scan-receipt/model/useReceiptWizard.ts`

- [ ] **Step 1: Simplify handleOcrResult**

Now that `items`, `charges`, `currency`, `storeName`, `formData` are accessible via destructured refs from sub-composables, `handleOcrResult` should be the only significant logic left in the orchestrator. Clean up imports — remove everything that's now in sub-composables.

The final orchestrator should be ~100-120 lines: imports, `goNext`/`goBack`, `handleOcrResult` callback, sub-composable instantiation, and the return object that proxies all APIs.

- [ ] **Step 2: Verify external API is identical**

Check that the return object of `useReceiptWizard` has exactly the same keys as the original. `ScanReceiptPage.vue` must compile without changes.

Run: `cd frontend && bun run build`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/scan-receipt/model/useReceiptWizard.ts
git commit -m "refactor(receipt): clean up wizard orchestrator"
```

---

## Chunk 2: Step2 UI Extractions

### Task 6: Extract SplitItemModal

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/SplitItemModal.vue`
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step2EditItems.vue`

- [ ] **Step 1: Create SplitItemModal.vue**

Extract from `Step2EditItems.vue` lines 329–418 (template) and lines 44–73 (script: splitModalOpen, splitItem, splitFirstQty, splitSecondQty, splitValid, splitPreviewAmounts, openSplitModal, confirmSplit).

The component receives `v-model:open` (mapped to `splitModalOpen`), `item` (the ReceiptItem being split), `currency`, and emits `confirm(firstQty: number)`.

All split state (splitFirstQty, splitSecondQty computed, splitValid computed, splitPreviewAmounts computed) moves into the new component. Import `calcSplitAmounts` from `../../model/calcLineTotal`.

- [ ] **Step 2: Update Step2EditItems to use SplitItemModal**

Replace the inline `<UModal>` block with:

```vue
<SplitItemModal
  v-model:open="splitModalOpen"
  :item="splitItem"
  :currency="currency"
  @confirm="(firstQty) => { emit('splitItem', splitItem!.id, firstQty); splitModalOpen = false; splitItem = null; }"
/>
```

Keep `splitModalOpen` and `splitItem` refs in Step2 (they control which item is being split). Remove `splitFirstQty`, `splitSecondQty`, `splitValid`, `splitPreviewAmounts`, `confirmSplit` — all move into the modal.

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/SplitItemModal.vue frontend/src/features/scan-receipt/ui/steps/Step2EditItems.vue
git commit -m "refactor(receipt): extract SplitItemModal from Step2"
```

---

### Task 7: Extract TotalFooter

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/TotalFooter.vue`
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step2EditItems.vue`

- [ ] **Step 1: Create TotalFooter.vue**

Extract from `Step2EditItems.vue` lines 224–326 (template: the sticky glass footer div) and script lines 41 (`addChargeOpen` ref) + 75–93 (enabledCharges, hasCharges, availablePresets, getChargeAmount, handleAddPreset).

Props: `subtotal, charges, chargesAmount, totalAmount, currency, itemCount, validationError, disabled`.
Emits: `addCharge(label, percent)`, `removeCharge(id)`, `toggleCharge(id)`, `updateChargePercent(id, percent)`, `requestNext`.

The component owns `addChargeOpen` ref internally. Import `ChargeRow`, `CHARGE_PRESETS`, `Popover`/`PopoverTrigger`/`PopoverContent`.

- [ ] **Step 2: Update Step2EditItems to use TotalFooter**

Replace the sticky footer div with:

```vue
<TotalFooter
  :subtotal="subtotal"
  :charges="charges"
  :charges-amount="chargesAmount"
  :total-amount="totalAmount"
  :currency="currency"
  :item-count="items.length"
  :validation-error="validationError"
  :disabled="items.length === 0"
  @add-charge="emit('addCharge', $event.label, $event.percent)"
  @remove-charge="emit('removeCharge', $event)"
  @toggle-charge="emit('toggleCharge', $event)"
  @update-charge-percent="emit('updateChargePercent', $event.id, $event.percent)"
  @request-next="validateAndNext"
/>
```

Remove: `enabledCharges`, `hasCharges`, `availablePresets`, `getChargeAmount`, `handleAddPreset`, `addChargeOpen` from Step2. Remove `Popover`/`PopoverContent`/`PopoverTrigger`, `ChargeRow`, `CHARGE_PRESETS` imports.

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/TotalFooter.vue frontend/src/features/scan-receipt/ui/steps/Step2EditItems.vue
git commit -m "refactor(receipt): extract TotalFooter from Step2"
```

---

## Chunk 3: Step3 UI Extractions

### Task 8: Extract AddParticipantModal

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/AddParticipantModal.vue`
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue`

- [ ] **Step 1: Create AddParticipantModal.vue**

Extract from `Step3AssignParticipants.vue` lines 403–613 (template: the `<UModal>` block) and lines 69–175 (script: modal state and logic).

Props: `v-model:open`, `participants`, `hasMe`.
Emits: `addParticipant(name, isMe, paidById)`, `removeParticipant(id)`.

Component internally calls `usePeople(userId)` via `useCurrentUser()`. Encapsulates: `newName`, `nameError`, `selectedContactIds`, `selectedPaidById`, `pendingNames`, `existingNames`, `availableContacts`, `ME_PAYER_ID`, `manualInputRef`.

Functions that move in: `toggleContactSelection`, `addMe` (emits addParticipant), `resolvePaidById`, `confirmAddManual`, `confirmAddAll`, `handleSaveAndAdd`.

**Important:** `openAddParticipantSheet` (lines 97–104) stays in Step3 — it owns `addParticipantOpen` and resets modal state. The modal resets its own internal state via a `watch` on its `open` prop (reset `newName`, `selectedContactIds`, etc. when opened).

**Timing note:** `resolvePaidById()` emits `addParticipant('Я')` then reads `participants` prop — works because Vue emits are synchronous.

- [ ] **Step 2: Update Step3 to use AddParticipantModal**

Replace the `<UModal>` block with:

```vue
<AddParticipantModal
  v-model:open="addParticipantOpen"
  :participants="participants"
  :has-me="hasMe"
  @add-participant="(name, isMe, paidById) => emit('addParticipant', name, isMe, paidById)"
  @remove-participant="handleRemoveParticipant"
/>
```

Keep `addParticipantOpen` ref in Step3 (controls modal visibility). Remove all modal-internal state and logic. Remove `usePeople`, `useCurrentUser` imports if no longer used in Step3 (they move to the modal). Keep `handleRemoveParticipant` in Step3 since it also manages `activeParticipantId`.

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/AddParticipantModal.vue frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue
git commit -m "refactor(receipt): extract AddParticipantModal from Step3"
```

---

### Task 9: Extract ParticipantsBar

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/ParticipantsBar.vue`
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue`

- [ ] **Step 1: Create ParticipantsBar.vue**

Extract from `Step3AssignParticipants.vue` lines 212–279 (template: the participants bar div with chips + actions).

Props: `participants`, `activeParticipantId`, `unassignedCount`.
Emits: `setActive(id)`, `remove(id)`, `assignAll(id)`, `openAdd`.

Component internally creates the `allParticipantChip` computed (virtual "На всех" participant). Imports `ParticipantChip`, `ALL_PARTICIPANTS_ID`, `ALL_PARTICIPANTS_COLOR`.

- [ ] **Step 2: Update Step3 to use ParticipantsBar**

Replace the participants bar div with:

```vue
<ParticipantsBar
  :participants="participants"
  :active-participant-id="activeParticipantId"
  :unassigned-count="unassignedCount"
  @set-active="setActiveParticipant"
  @remove="handleRemoveParticipant"
  @assign-all="assignAllTo"
  @open-add="openAddParticipantSheet"
/>
```

Remove `allParticipantChip` computed, `ParticipantChip` import, `ALL_PARTICIPANTS_ID`/`ALL_PARTICIPANTS_COLOR` imports from Step3 (if not used elsewhere in Step3).

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/ParticipantsBar.vue frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue
git commit -m "refactor(receipt): extract ParticipantsBar from Step3"
```

---

## Chunk 4: Step4 UI Extractions

### Task 10: Extract SuccessOverlay

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/SuccessOverlay.vue`
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue`

- [ ] **Step 1: Create SuccessOverlay.vue**

Extract from `Step4Summary.vue` lines 161–308 (template: the `<Transition name="receipt-slide-up">` block) and lines 788–848 (styles: receipt-slide-up, success-icon, success-hero, success-list, success-actions, success-done, scaleIn, fadeSlideUp, receipt-edge).

Props: `isSuccess`, `totalAmount`, `currency`, `storeName`, `displayDate` (pre-formatted string), `owers` (pre-filtered ParticipantSummary[]), `hasCharges`, `enabledCharges` (ReceiptCharge[]), `isSharing`, `shareActions`.

Component imports: `UButton`, `UIcon`, `InitialAvatar`, `formatCurrency`, `ROUTE_NAMES`, `useRouter`.

- [ ] **Step 2: Update Step4Summary to use SuccessOverlay**

Replace the Transition block with:

```vue
<SuccessOverlay
  :is-success="isSuccess"
  :total-amount="totalAmount"
  :currency="currency"
  :store-name="storeName"
  :display-date="displayDate"
  :owers="owers"
  :has-charges="hasCharges"
  :enabled-charges="enabledCharges"
  :is-sharing="isSharing"
  :share-actions="shareActions"
/>
```

Keep `owers`, `displayDate`, `enabledCharges`, `hasCharges`, `shareActions`, `isSharing` computeds in Step4 — they're passed as props.

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/SuccessOverlay.vue frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue
git commit -m "refactor(receipt): extract SuccessOverlay from Step4"
```

---

### Task 11: Extract ReceiptTotalCard

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/ReceiptTotalCard.vue`
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue`

- [ ] **Step 1: Create ReceiptTotalCard.vue**

Extract from `Step4Summary.vue` lines 316–374 (template: the skeuomorphic receipt div with receipt-edge).

Props: `subtotal`, `charges` (ReceiptCharge[]), `chargesAmount`, `totalAmount`, `currency`.

Component computes `enabledCharges` and `hasCharges` internally from `charges` prop. Imports `formatCurrency`. Includes receipt-edge CSS.

**Note:** `enabledCharges` is computed in both ReceiptTotalCard (for display) and Step4 (for SuccessOverlay prop). This is intentional — each component filters independently from the same `charges` source, avoiding prop threading of derived state.

- [ ] **Step 2: Update Step4Summary**

Replace the receipt div with:

```vue
<ReceiptTotalCard
  :subtotal="subtotal"
  :charges="charges"
  :charges-amount="chargesAmount"
  :total-amount="totalAmount"
  :currency="currency"
/>
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/ReceiptTotalCard.vue frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue
git commit -m "refactor(receipt): extract ReceiptTotalCard from Step4"
```

---

### Task 12: Extract TransactionFormSection

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/TransactionFormSection.vue`
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue`

- [ ] **Step 1: Create TransactionFormSection.vue**

Extract from `Step4Summary.vue` lines 607–690 (template: the transaction parameters section) and lines 44–65 (script: calendarOpen, calendarValue, displayDate — but only the calendar-specific ones).

Props: `formData` (ScanReceiptFormData), `accounts` (AccountWithBalances[]).
Emits: `update:formData`.

Component owns `calendarOpen` ref internally. Computes `calendarValue` and local `displayDate` (for the date button label) from `formData.date`. Imports `AccountSelector`, `CategoryChips`, `EXPENSE_CATEGORIES`, `Popover`/`PopoverTrigger`/`PopoverContent`, `Calendar`, `CalendarDate`.

**Note:** Step4Summary also uses `displayDate` for SuccessOverlay. After extraction, Step4 keeps its own `displayDate` computed for passing to SuccessOverlay, while TransactionFormSection has its own internal one.

- [ ] **Step 2: Update Step4Summary**

Replace the transaction parameters section with:

```vue
<TransactionFormSection
  :form-data="formData"
  :accounts="accounts"
  @update:form-data="$emit('update:formData', $event)"
/>
```

Remove `calendarOpen`, `calendarValue`, `onDateSelect` from Step4. Keep `displayDate` computed (used by SuccessOverlay). Remove `AccountSelector`, `CategoryChips`, `EXPENSE_CATEGORIES`, `Popover`/`PopoverTrigger`/`PopoverContent`, `Calendar`, `CalendarDate` imports from Step4 if not used elsewhere.

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/TransactionFormSection.vue frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue
git commit -m "refactor(receipt): extract TransactionFormSection from Step4"
```

---

### Task 13: Extract CreateDebtsToggle

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/CreateDebtsToggle.vue`
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue`

- [ ] **Step 1: Create CreateDebtsToggle.vue**

Extract from `Step4Summary.vue` lines 693–754 (template: the debts toggle section).

Props: `modelValue` (boolean, for v-model), `debtCount`, `participantSummaries`.
Emits: `update:modelValue`.

Imports `UIcon`, `pluralize`.

- [ ] **Step 2: Update Step4Summary**

Replace the debts toggle section with:

```vue
<CreateDebtsToggle
  v-model="createDebts"
  :debt-count="debtCount"
  :participant-summaries="participantSummaries"
/>
```

Remove the `createDebts` computed (or keep it as a simple v-model bridge if `formData.createDebts` still needs it). The `debtCount` computed stays in Step4.

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/CreateDebtsToggle.vue frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue
git commit -m "refactor(receipt): extract CreateDebtsToggle from Step4"
```

---

## Chunk 5: Final Verification

### Task 14: Full build + dev server check

- [ ] **Step 1: Full build**

Run: `cd frontend && bun run build`
Expected: successful build, zero errors.

- [ ] **Step 2: Dev server smoke test**

Run: `cd frontend && bun run dev`
Navigate to scan-receipt page, verify all 4 steps render correctly.

- [ ] **Step 3: Verify file sizes**

Check that all modified/new files are under the 250-line target:

```bash
wc -l frontend/src/features/scan-receipt/model/useReceiptWizard.ts \
  frontend/src/features/scan-receipt/model/usePhotoStep.ts \
  frontend/src/features/scan-receipt/model/useItemsStep.ts \
  frontend/src/features/scan-receipt/model/useParticipantsStep.ts \
  frontend/src/features/scan-receipt/model/useSubmitStep.ts \
  frontend/src/features/scan-receipt/ui/steps/Step2EditItems.vue \
  frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue \
  frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue \
  frontend/src/features/scan-receipt/ui/SplitItemModal.vue \
  frontend/src/features/scan-receipt/ui/TotalFooter.vue \
  frontend/src/features/scan-receipt/ui/AddParticipantModal.vue \
  frontend/src/features/scan-receipt/ui/ParticipantsBar.vue \
  frontend/src/features/scan-receipt/ui/SuccessOverlay.vue \
  frontend/src/features/scan-receipt/ui/ReceiptTotalCard.vue \
  frontend/src/features/scan-receipt/ui/TransactionFormSection.vue \
  frontend/src/features/scan-receipt/ui/CreateDebtsToggle.vue
```

- [ ] **Step 4: Verify ScanReceiptPage.vue is unchanged**

```bash
git diff HEAD~13 -- frontend/src/pages/scan-receipt/ScanReceiptPage.vue
```

Expected: no diff (file untouched).
