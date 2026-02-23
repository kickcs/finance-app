# Scan Receipt & Split by Items — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a premium wizard that lets users photograph a receipt, OCR-parse items via GPT-4o Vision, assign items to participants, and create transactions + debts.

**Architecture:** New stateless `receipt` backend module with a single `POST /api/receipts/scan` endpoint (multer + OpenAI). New `scan-receipt` frontend feature with a 4-step wizard page. Integrates with existing `debtsApi.create()` and `transactionsApi.create()`.

**Tech Stack:** NestJS (multer, OpenAI SDK), Vue 3, TanStack Query, Tailwind CSS v4, Reka UI

**Design docs:**
- `docs/plans/2026-02-24-scan-receipt-design.md` — technical design
- `docs/plans/2026-02-24-scan-receipt-ui-design.md` — full UI/UX specification

---

## Task 1: Backend — Install OpenAI SDK and add env vars

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/.env.example`

**Step 1: Install openai package and multer types**

Run: `cd backend && bun add openai && bun add -d @types/multer`

**Step 2: Add env vars to .env.example**

Add to `backend/.env.example`:
```
OPENAI_API_KEY=your-openai-api-key
```

**Step 3: Add env var to your local .env**

Run: Ensure `OPENAI_API_KEY` is set in `backend/.env`

**Step 4: Commit**

```bash
git add backend/package.json backend/bun.lock backend/.env.example
git commit -m "chore: add openai SDK and multer types for receipt scanning"
```

---

## Task 2: Backend — Create receipt module with scan endpoint

**Files:**
- Create: `backend/src/modules/receipt/receipt.module.ts`
- Create: `backend/src/modules/receipt/presentation/controllers/receipt.controller.ts`
- Create: `backend/src/modules/receipt/presentation/dto/scan-receipt-response.dto.ts`
- Create: `backend/src/modules/receipt/application/services/receipt-ocr.service.ts`
- Modify: `backend/src/app.module.ts` — register ReceiptModule

**Step 1: Create the OCR service**

```typescript
// backend/src/modules/receipt/application/services/receipt-ocr.service.ts
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ScanResult {
  items: ReceiptItem[];
  totalAmount: number;
  currency: string;
  date: string | null;
  storeName: string | null;
}

@Injectable()
export class ReceiptOcrService {
  private readonly logger = new Logger(ReceiptOcrService.name);
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async scanReceipt(imageBuffer: Buffer, mimeType: string): Promise<ScanResult> {
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a receipt parser. Extract line items from the receipt image.
Return a JSON object with this exact structure:
{
  "items": [{ "name": "string", "quantity": number, "unitPrice": number, "totalPrice": number }],
  "totalAmount": number,
  "currency": "string (3-letter ISO code, e.g. UZS, USD, RUB)",
  "date": "string (YYYY-MM-DD) or null",
  "storeName": "string or null"
}
Rules:
- All prices in the smallest unit of the currency (e.g. 35000 for 35,000 UZS, NOT 35.000)
- If quantity is unclear, use 1
- totalPrice = quantity * unitPrice
- totalAmount = sum of all totalPrice values
- If currency is unclear, default to "UZS"
- If date is unclear, use null
- Ignore service charges, taxes, discounts — list them as separate items
- Handle Uzbek, Russian, and English text`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all line items from this receipt:' },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(content) as ScanResult;
    this.logger.log(`Parsed ${parsed.items.length} items, total: ${parsed.totalAmount} ${parsed.currency}`);
    return parsed;
  }
}
```

**Step 2: Create the response DTO**

```typescript
// backend/src/modules/receipt/presentation/dto/scan-receipt-response.dto.ts
export class ReceiptItemDto {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export class ScanReceiptResponseDto {
  items: ReceiptItemDto[];
  totalAmount: number;
  currency: string;
  date: string | null;
  storeName: string | null;
}
```

**Step 3: Create the controller**

```typescript
// backend/src/modules/receipt/presentation/controllers/receipt.controller.ts
import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../../../common';
import { PremiumGuard } from '../../../subscription/application/guards/premium.guard';
import { ReceiptOcrService, ScanResult } from '../../application/services/receipt-ocr.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Controller('receipts')
export class ReceiptController {
  private readonly logger = new Logger(ReceiptController.name);

  constructor(private readonly ocrService: ReceiptOcrService) {}

  @Post('scan')
  @UseGuards(PremiumGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async scanReceipt(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ScanResult> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    this.logger.log(`User ${userId} scanning receipt: ${file.originalname} (${file.size} bytes)`);

    try {
      return await this.ocrService.scanReceipt(file.buffer, file.mimetype);
    } catch (error) {
      this.logger.error(`OCR failed for user ${userId}:`, error);
      throw new InternalServerErrorException('Failed to scan receipt. Please try again.');
    }
  }
}
```

**Step 4: Create the module**

```typescript
// backend/src/modules/receipt/receipt.module.ts
import { Module } from '@nestjs/common';
import { ReceiptController } from './presentation/controllers/receipt.controller';
import { ReceiptOcrService } from './application/services/receipt-ocr.service';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [SubscriptionModule],
  controllers: [ReceiptController],
  providers: [ReceiptOcrService],
})
export class ReceiptModule {}
```

**Step 5: Register in AppModule**

Add `ReceiptModule` to the `imports` array in `backend/src/app.module.ts`.

**Step 6: Verify it builds**

Run: `cd backend && bun run build`
Expected: Build succeeds without errors.

**Step 7: Commit**

```bash
git add backend/src/modules/receipt/ backend/src/app.module.ts
git commit -m "feat(backend): add receipt scan endpoint with GPT-4o Vision OCR"
```

---

## Task 3: Backend — Verify PremiumGuard import and SubscriptionModule export

**Files:**
- Potentially modify: `backend/src/modules/subscription/subscription.module.ts` — ensure `PremiumGuard` is exported

**Step 1: Check that SubscriptionModule exports PremiumGuard**

Read `backend/src/modules/subscription/subscription.module.ts` and verify `PremiumGuard` is in the `exports` array. If not, add it.

**Step 2: Check PremiumGuard import path**

Read `backend/src/modules/subscription/application/guards/premium.guard.ts` and verify the exact import path used in Task 2's controller is correct. Adjust if needed.

**Step 3: Run build**

Run: `cd backend && bun run build`
Expected: Build succeeds.

**Step 4: Commit if changes were made**

```bash
git add -A && git commit -m "fix(backend): export PremiumGuard from SubscriptionModule"
```

---

## Task 4: Frontend — Add receipt API client

**Files:**
- Create: `frontend/src/features/scan-receipt/api/receiptApi.ts`

**Step 1: Create the API client**

```typescript
// frontend/src/features/scan-receipt/api/receiptApi.ts
import { API_URL, getAccessToken } from '@/shared/api/http';

export interface ReceiptItemResponse {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ScanReceiptResponse {
  items: ReceiptItemResponse[];
  totalAmount: number;
  currency: string;
  date: string | null;
  storeName: string | null;
}

export const receiptApi = {
  async scan(imageFile: File): Promise<ScanReceiptResponse> {
    const formData = new FormData();
    formData.append('image', imageFile);

    const token = getAccessToken();
    const response = await fetch(`${API_URL}/receipts/scan`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Scan failed: ${response.status}`);
    }

    return response.json();
  },
};
```

**Step 2: Commit**

```bash
git add frontend/src/features/scan-receipt/api/
git commit -m "feat(frontend): add receipt scan API client"
```

---

## Task 5: Frontend — Create types and wizard state composable

**Files:**
- Create: `frontend/src/features/scan-receipt/model/types.ts`
- Create: `frontend/src/features/scan-receipt/model/useReceiptWizard.ts`

**Step 1: Create types**

```typescript
// frontend/src/features/scan-receipt/model/types.ts

export interface ReceiptItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  assignedParticipantIds: string[];
}

export interface Participant {
  id: string;
  name: string;
  isMe: boolean;
  color: string;
}

export interface ParticipantSummaryItem {
  id: string;
  name: string;
  lineTotal: number;
  share: number;
  sharedWith: number;
}

export interface ParticipantSummary {
  id: string;
  name: string;
  isMe: boolean;
  color: string;
  itemCount: number;
  total: number;
  items: ParticipantSummaryItem[];
}

export interface ScanReceiptFormData {
  accountId: string | null;
  categoryId: string;
  description: string;
  date: number;
  createDebts: boolean;
  currency: string;
}

export type WizardDirection = 'forward' | 'back';
```

**Step 2: Create wizard composable**

```typescript
// frontend/src/features/scan-receipt/model/useReceiptWizard.ts
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { receiptApi, type ScanReceiptResponse } from '../api/receiptApi';
import { transactionsApi } from '@/entities/transaction';
import { debtsApi, debtQueryKeys } from '@/entities/debt';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useQueryClient } from '@tanstack/vue-query';
import { useToast } from '@/shared/ui';
import { haptics } from '@/shared/lib/haptics';
import type {
  ReceiptItem,
  Participant,
  ParticipantSummary,
  ScanReceiptFormData,
  WizardDirection,
} from './types';

let nextId = 0;
function uid(): string {
  return `ri_${++nextId}_${Date.now()}`;
}

export function useReceiptWizard(userId: () => string | null) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Step state
  const currentStep = ref(1);
  const direction = ref<WizardDirection>('forward');

  // Step 1: Photo
  const selectedFile = ref<File | null>(null);
  const previewUrl = ref<string | null>(null);
  const isOcrLoading = ref(false);
  const isOcrSuccess = ref(false);
  const ocrError = ref<string | null>(null);

  // Step 2: Items
  const items = ref<ReceiptItem[]>([]);
  const currency = ref('UZS');
  const storeName = ref<string | null>(null);
  const receiptDate = ref<string | null>(null);

  // Step 3: Participants
  const participants = ref<Participant[]>([]);

  // Step 4: Form
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

  // Computed
  const totalAmount = computed(() =>
    items.value.reduce((sum, item) => sum + item.qty * item.unitPrice, 0),
  );

  const unassignedCount = computed(() =>
    items.value.filter((item) => item.assignedParticipantIds.length === 0).length,
  );

  const participantSummaries = computed<ParticipantSummary[]>(() => {
    return participants.value.map((p) => {
      const assignedItems = items.value
        .filter((item) => item.assignedParticipantIds.includes(p.id))
        .map((item) => {
          const sharedWith = item.assignedParticipantIds.length;
          const lineTotal = item.qty * item.unitPrice;
          const share = Math.round(lineTotal / sharedWith);
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
      };
    });
  });

  // Step navigation
  function goNext() {
    if (currentStep.value < 4) {
      direction.value = 'forward';
      currentStep.value++;
      haptics.tap();
    }
  }

  function goBack() {
    if (currentStep.value > 1) {
      direction.value = 'back';
      currentStep.value--;
      haptics.tap();
    }
  }

  // Step 1: Photo handling
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
      items.value = result.items.map((item) => ({
        id: uid(),
        name: item.name,
        qty: item.quantity,
        unitPrice: item.unitPrice,
        assignedParticipantIds: [],
      }));
      currency.value = result.currency;
      formData.value.currency = result.currency;
      storeName.value = result.storeName;
      receiptDate.value = result.date;
      if (result.storeName) {
        formData.value.description = result.storeName;
      }
      if (result.date) {
        formData.value.date = new Date(result.date).getTime();
      }
      isOcrSuccess.value = true;
      haptics.success();
      // Auto-advance after 600ms
      setTimeout(() => goNext(), 600);
    } catch (error) {
      ocrError.value = error instanceof Error ? error.message : 'Не удалось распознать чек';
      haptics.error();
    } finally {
      isOcrLoading.value = false;
    }
  }

  // Step 2: Item editing
  function updateItem(id: string, updates: Partial<ReceiptItem>) {
    const idx = items.value.findIndex((i) => i.id === id);
    if (idx !== -1) {
      items.value[idx] = { ...items.value[idx], ...updates };
    }
  }

  function deleteItem(id: string) {
    items.value = items.value.filter((i) => i.id !== id);
    haptics.warning();
  }

  function addItem(): string {
    const id = uid();
    items.value.push({
      id,
      name: '',
      qty: 1,
      unitPrice: 0,
      assignedParticipantIds: [],
    });
    haptics.tap();
    return id;
  }

  // Step 3: Participants
  function addParticipant(name: string, isMe = false) {
    const colorIndex = participants.value.length % ENTITY_COLORS.length;
    participants.value.push({
      id: uid(),
      name,
      isMe,
      color: ENTITY_COLORS[colorIndex],
    });
    haptics.tap();
  }

  function removeParticipant(id: string) {
    participants.value = participants.value.filter((p) => p.id !== id);
    // Remove from all item assignments
    items.value.forEach((item) => {
      item.assignedParticipantIds = item.assignedParticipantIds.filter((pid) => pid !== id);
    });
    haptics.warning();
  }

  function toggleItemParticipant(itemId: string, participantId: string) {
    const item = items.value.find((i) => i.id === itemId);
    if (!item) return;
    const idx = item.assignedParticipantIds.indexOf(participantId);
    if (idx === -1) {
      item.assignedParticipantIds.push(participantId);
    } else {
      item.assignedParticipantIds.splice(idx, 1);
    }
    haptics.tap();
  }

  const hasMe = computed(() => participants.value.some((p) => p.isMe));

  // Step 4: Submit
  async function handleSubmit() {
    const uid_ = userId();
    if (!uid_ || !formData.value.accountId || !formData.value.categoryId) return;

    isSubmitting.value = true;
    submitError.value = null;

    try {
      // Create the main expense transaction
      const transaction = await transactionsApi.create({
        account_id: formData.value.accountId,
        category_id: formData.value.categoryId,
        amount: totalAmount.value,
        currency: formData.value.currency,
        type: 'expense',
        description: formData.value.description || null,
        date: new Date(formData.value.date).toISOString(),
      });

      // Create debts for non-me participants
      if (formData.value.createDebts) {
        const nonMeSummaries = participantSummaries.value.filter((p) => !p.isMe && p.total > 0);
        for (const summary of nonMeSummaries) {
          await debtsApi.create({
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

      // Invalidate caches
      invalidateTransactionRelated(queryClient, uid_);
      invalidateAccountRelated(queryClient, uid_);
      queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(uid_) });

      isSuccess.value = true;
      haptics.success();

      // Auto-navigate after 1.5s
      setTimeout(() => {
        toast({
          title: 'Чек добавлен',
          description: `Создана транзакция${formData.value.createDebts ? ` и ${participantSummaries.value.filter((p) => !p.isMe && p.total > 0).length} долгов` : ''}`,
          variant: 'success',
        });
        router.push('/');
      }, 1500);
    } catch (error) {
      submitError.value = error instanceof Error ? error.message : 'Произошла ошибка';
      haptics.error();
    } finally {
      isSubmitting.value = false;
    }
  }

  const isFormValid = computed(
    () => !!formData.value.accountId && !!formData.value.categoryId && totalAmount.value > 0,
  );

  return {
    // Step state
    currentStep,
    direction,
    goNext,
    goBack,
    // Step 1
    selectedFile,
    previewUrl,
    isOcrLoading,
    isOcrSuccess,
    ocrError,
    selectFile,
    resetPhoto,
    scanReceipt,
    // Step 2
    items,
    currency,
    storeName,
    receiptDate,
    totalAmount,
    updateItem,
    deleteItem,
    addItem,
    // Step 3
    participants,
    hasMe,
    unassignedCount,
    addParticipant,
    removeParticipant,
    toggleItemParticipant,
    // Step 4
    formData,
    participantSummaries,
    isSubmitting,
    submitError,
    isSuccess,
    isFormValid,
    handleSubmit,
  };
}
```

**Step 3: Commit**

```bash
git add frontend/src/features/scan-receipt/model/
git commit -m "feat(frontend): add receipt wizard types and state composable"
```

---

## Task 6: Frontend — Create Step 1 (Photo Capture) component

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/steps/Step1PhotoCapture.vue`

**Step 1: Create the component**

Follow the UI spec from `docs/plans/2026-02-24-scan-receipt-ui-design.md` Section 4.
- Idle state: illustration + camera/gallery buttons
- Preview state: image preview + OCR loading overlay
- Success state: green check flash
- Error state: retry overlay
- Use `UButton`, `UIcon`, `USpinner` from `@/shared/ui`
- Hidden `<input type="file">` elements for camera (with `capture="environment"`) and gallery
- File validation: max 10MB, image/* only

Props:
```typescript
defineProps<{
  previewUrl: string | null;
  isOcrLoading: boolean;
  isOcrSuccess: boolean;
  ocrError: string | null;
}>();

defineEmits<{
  selectFile: [file: File];
  resetPhoto: [];
  retryOcr: [];
}>();
```

**Step 2: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/steps/Step1PhotoCapture.vue
git commit -m "feat(frontend): add Step1 PhotoCapture component"
```

---

## Task 7: Frontend — Create Step 2 (Edit Items) components

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/ReceiptItemRow.vue`
- Create: `frontend/src/features/scan-receipt/ui/steps/Step2EditItems.vue`

**Step 1: Create ReceiptItemRow**

Follow UI spec Section 5.2:
- Wrap in `SwipeableItem` from `@/shared/ui`
- Index number, editable name input, qty stepper (−/+), unit price input, computed line total, delete button
- Edit highlight: `border-primary/40 ring-1 ring-primary/20` when focused
- Use `formatCurrency` from `@/shared/lib/format/currency`
- Use `getCurrencySymbol` from `@/shared/lib/format/currency`

Props:
```typescript
defineProps<{
  item: ReceiptItem;
  index: number;
  currency: string;
}>();

defineEmits<{
  update: [updates: Partial<ReceiptItem>];
  delete: [];
}>();
```

**Step 2: Create Step2EditItems**

Follow UI spec Section 5.1:
- `TransitionGroup` item list with `listTransition` from `@/shared/lib/transitions`
- "Добавить позицию" dashed-border button
- Footer: total amount + "Далее — Участники" button
- Empty state when 0 items (UI spec Section 8.2)

Props:
```typescript
defineProps<{
  items: ReceiptItem[];
  currency: string;
  totalAmount: number;
}>();

defineEmits<{
  updateItem: [id: string, updates: Partial<ReceiptItem>];
  deleteItem: [id: string];
  addItem: [];
  next: [];
  back: [];
}>();
```

**Step 3: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/ReceiptItemRow.vue frontend/src/features/scan-receipt/ui/steps/Step2EditItems.vue
git commit -m "feat(frontend): add Step2 EditItems and ReceiptItemRow components"
```

---

## Task 8: Frontend — Create Step 3 (Assign Participants) components

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/ParticipantChip.vue`
- Create: `frontend/src/features/scan-receipt/ui/AssignableItemRow.vue`
- Create: `frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue`

**Step 1: Create ParticipantChip**

Follow UI spec Section 6.2:
- Pill button with colored avatar (first letter) + name
- Active state: filled with participant color, white text
- Inactive state: card bg, border

Props:
```typescript
defineProps<{
  participant: Participant;
  isActive: boolean;
}>();

defineEmits<{
  click: [];
}>();
```

**Step 2: Create AssignableItemRow**

Follow UI spec Section 6.3:
- Status dot (green=assigned, amber=unassigned)
- Item name + formatted price
- Overlapping avatar stack of assigned participants
- Expanded chip group for toggling participants
- "Разделено поровну" label when shared

Props:
```typescript
defineProps<{
  item: ReceiptItem;
  participants: Participant[];
  currency: string;
}>();

defineEmits<{
  toggleParticipant: [participantId: string];
}>();
```

**Step 3: Create Step3AssignParticipants**

Follow UI spec Section 6.1:
- Sticky top: participant horizontal scroll chips row + "Добавить" button
- Filter: tapping a chip filters items to those assigned to that participant
- Scrollable items list with `AssignableItemRow`
- Footer: unassigned warning banner + "Далее — Итог" button
- Add participant bottom sheet (UModal) with "Я" quick-add (UI spec Section 6.4)
- Empty state when no participants (UI spec Section 8.3)

Props:
```typescript
defineProps<{
  items: ReceiptItem[];
  participants: Participant[];
  currency: string;
  hasMe: boolean;
  unassignedCount: number;
}>();

defineEmits<{
  addParticipant: [name: string, isMe: boolean];
  removeParticipant: [id: string];
  toggleItemParticipant: [itemId: string, participantId: string];
  next: [];
  back: [];
}>();
```

**Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/ParticipantChip.vue frontend/src/features/scan-receipt/ui/AssignableItemRow.vue frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue
git commit -m "feat(frontend): add Step3 AssignParticipants components"
```

---

## Task 9: Frontend — Create Step 4 (Summary) components

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/PersonSummaryCard.vue`
- Create: `frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue`

**Step 1: Create PersonSummaryCard**

Follow UI spec Section 7.2:
- Colored avatar + name + total
- Expandable item list (collapsed by default)
- Shared items show "1/N от X"
- Expand/collapse toggle button

Props:
```typescript
defineProps<{
  participant: ParticipantSummary;
  currency: string;
}>();
```

**Step 2: Create Step4Summary**

Follow UI spec Section 7.1:
- Per-person breakdown cards
- AccountSelector + CategoryChips (import from existing entities)
- Description + date picker (use Popover + Calendar from reka-ui like TransactionForm)
- Create-debts toggle switch
- Total summary badges
- "Создать транзакции" button
- Success overlay (UI spec Section 7.3)

Props:
```typescript
defineProps<{
  participantSummaries: ParticipantSummary[];
  currency: string;
  formData: ScanReceiptFormData;
  totalAmount: number;
  isSubmitting: boolean;
  submitError: string | null;
  isSuccess: boolean;
  isFormValid: boolean;
}>();

defineEmits<{
  'update:formData': [value: ScanReceiptFormData];
  submit: [];
  back: [];
}>();
```

**Step 3: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/PersonSummaryCard.vue frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue
git commit -m "feat(frontend): add Step4 Summary and PersonSummaryCard components"
```

---

## Task 10: Frontend — Create StepProgressIndicator and wizard page

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/StepProgressIndicator.vue`
- Create: `frontend/src/pages/scan-receipt/ScanReceiptPage.vue`
- Create: `frontend/src/features/scan-receipt/index.ts`

**Step 1: Create StepProgressIndicator**

Follow UI spec Section 2.2:
- 4-segment horizontal bar with `role="progressbar"`
- Active segment animated fill with `stepFill` keyframe
- Past segments solid `bg-primary`, future segments `bg-border-light dark:bg-border-dark`

Props:
```typescript
defineProps<{
  currentStep: number;
  totalSteps: number;
}>();
```

**Step 2: Create ScanReceiptPage**

Follow UI spec Section 2.1:
- `h-dvh flex flex-col overflow-hidden` layout
- Header: back button, title "Сканировать чек", step label, PremiumBadge
- StepProgressIndicator below header
- Step content area with `<Transition>` (step-forward / step-back)
- Back button behavior: step 1 → `router.back()`, others → `goBack()`
- Step transition CSS (UI spec Section 3.1)
- Reduced motion support (UI spec Section 10.5)
- Initialize wizard composable with userId
- `requirePremium()` check on mounted

```typescript
import { useReceiptWizard } from '@/features/scan-receipt/model/useReceiptWizard';
import { useCurrentUser } from '@/shared/lib/hooks';
import { usePremiumFeature } from '@/shared/lib/composables';
```

STEP_LABELS: `['Фото чека', 'Позиции', 'Участники', 'Итог']`

**Step 3: Create feature index**

```typescript
// frontend/src/features/scan-receipt/index.ts
export { default as ScanReceiptPage } from '@/pages/scan-receipt/ScanReceiptPage.vue';
```

**Step 4: Commit**

```bash
git add frontend/src/features/scan-receipt/ui/StepProgressIndicator.vue frontend/src/pages/scan-receipt/ScanReceiptPage.vue frontend/src/features/scan-receipt/index.ts
git commit -m "feat(frontend): add ScanReceiptPage wizard with step transitions"
```

---

## Task 11: Frontend — Register route and add entry points

**Files:**
- Modify: `frontend/src/app/router/index.ts` — add `/scan-receipt` route
- Modify: `frontend/src/shared/ui/icon/iconMap.ts` — add `document_scanner` icon mapping
- Modify: `frontend/src/entities/subscription/model/constants.ts` — add to PREMIUM_FEATURES

**Step 1: Add route**

Add to the children array of the MainLayout route:
```typescript
{
  path: '/scan-receipt',
  name: 'scan-receipt',
  component: () => import('@/pages/scan-receipt/ScanReceiptPage.vue'),
  meta: { requiresAuth: true },
},
```

Note: We don't add `requiresPremium` meta since we handle it in the page component with `requirePremium()`.

**Step 2: Add icon mapping**

Add `document_scanner` → appropriate Lucide icon (e.g., `ScanLine` or `Receipt`) in `iconMap.ts`.
Also add any other new icons used: `photo_camera`, `photo_library`, `touch_app`, `person_add`, `group_add`, `receipt_long`, `text_fields`, `crop_free`, `light_mode`.

**Step 3: Add to PREMIUM_FEATURES**

```typescript
{ icon: 'document_scanner', label: 'Сканирование чеков', description: 'Сфотографируйте чек и разделите расходы по позициям' },
```

**Step 4: Verify build**

Run: `cd frontend && bun run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add frontend/src/app/router/index.ts frontend/src/shared/ui/icon/iconMap.ts frontend/src/entities/subscription/model/constants.ts
git commit -m "feat(frontend): register scan-receipt route, icons, and premium feature"
```

---

## Task 12: Frontend — Add entry point on dashboard

**Files:**
- Modify: the dashboard page or widget that contains quick actions

**Step 1: Find the dashboard quick actions area**

Search for the existing quick action buttons on the dashboard (likely in a widget or the dashboard page itself).

**Step 2: Add "Сканировать чек" button**

Follow UI spec Section 1.1:
- Button with `document_scanner` icon, "Сканировать" label, `PremiumBadge` overlay
- On click: `requirePremium('Сканирование чеков')` → navigate to `/scan-receipt`
- `haptics.tap()` on press

**Step 3: Verify**

Run: `cd frontend && bun run dev`
Check: Button appears on dashboard, clicking opens upgrade modal (or navigates if premium)

**Step 4: Commit**

```bash
git add <modified-files>
git commit -m "feat(frontend): add scan-receipt quick action on dashboard"
```

---

## Task 13: Full integration test

**Step 1: Start backend and frontend**

Run: `bun run dev` from root

**Step 2: Test the full flow**

1. Navigate to `/scan-receipt` (should require premium)
2. Take/select a photo of a receipt
3. Wait for OCR (should show loading → success → advance to step 2)
4. Edit items (add, delete, modify)
5. Add participants ("Я" + others)
6. Assign items to participants
7. Review summary, select account + category
8. Click "Создать транзакции"
9. Verify: transaction created, debts created, redirected to dashboard with toast

**Step 3: Test edge cases**

- File too large (> 10MB) → error message
- Non-image file → error message
- OCR fails → error overlay with retry
- No items after OCR → empty state with manual add
- Single participant (only "Я") → no debts created
- All items unassigned → warning banner
- Missing account/category → disabled submit button

**Step 4: Verify builds**

Run: `cd backend && bun run build && cd ../frontend && bun run build`
Expected: Both succeed.

---

## Task 14: Update changelog

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

**Step 1: Bump patch version and add entry**

Add at top of `CHANGELOG_ENTRIES`:
```typescript
{
  version: '<bumped-version>',
  date: '2026-02-24',
  entries: [
    {
      type: 'feature',
      description: 'Сканирование чеков — сфотографируйте чек и разделите расходы по позициям между участниками (Премиум)',
    },
  ],
},
```

**Step 2: Commit**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "docs: add scan-receipt to changelog"
```
