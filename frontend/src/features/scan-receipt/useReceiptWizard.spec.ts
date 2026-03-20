import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { hapticsMock } = vi.hoisted(() => ({
  hapticsMock: { trigger: vi.fn() },
}));

vi.mock('@/shared/lib/haptics', () => ({
  useHaptics: () => hapticsMock,
}));

// ── Imports after mocks ──────────────────────────────────────────────────────

import { usePhotoStep } from './model/usePhotoStep';
import { useItemsStep } from './model/useItemsStep';
import { useParticipantsStep } from './model/useParticipantsStep';
import { useReceiptWizard } from './model/useReceiptWizard';
import { calcLineTotal, calcLineTotalWithCharges, calcSplitAmounts } from './model/calcLineTotal';
import type { ReceiptItem, ReceiptCharge } from './model/types';
import type { ScanReceiptResponse } from './api/receiptApi';

// ── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'test-user-1';

function makeReceiptItem(overrides: Partial<ReceiptItem> = {}): ReceiptItem {
  return {
    id: 'item-1',
    name: 'Тест товар',
    qty: 1,
    unitPrice: 10000,
    ocrTotalPrice: null,
    assignedParticipantIds: [],
    ...overrides,
  };
}

function makeOcrResponse(overrides: Partial<ScanReceiptResponse> = {}): ScanReceiptResponse {
  return {
    items: [
      { name: 'Яблоки', quantity: 2, unitPrice: 5000, totalPrice: 10000 },
      { name: 'Молоко', quantity: 1, unitPrice: 8000, totalPrice: 8000 },
    ],
    totalAmount: 18000,
    serviceChargePercent: null,
    currency: 'UZS',
    date: '2026-03-20',
    storeName: 'Korzinka',
    hashtags: ['#korzinka', '#продукты'],
    ...overrides,
  };
}

// Mount a composable in a component context — tracks ALL wrappers for cleanup
const wrappers: ReturnType<typeof renderWithProviders>[] = [];

function mountComposable<T>(setup: () => T): T {
  let result!: T;
  const Stub = defineComponent({
    setup() {
      result = setup();
      return () => h('div');
    },
  });
  const wrapper = renderWithProviders(Stub);
  wrappers.push(wrapper);
  return result;
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  server.resetHandlers();
  wrappers.forEach((w) => w.unmount());
  wrappers.length = 0;
  await flushPromises();
});

// ─────────────────────────────────────────────────────────────────────────────
// calcLineTotal — pure utility
// ─────────────────────────────────────────────────────────────────────────────

describe('calcLineTotal', () => {
  it('uses ocrTotalPrice when present and positive', () => {
    const item = makeReceiptItem({ qty: 2, unitPrice: 4000, ocrTotalPrice: 9500 });
    expect(calcLineTotal(item)).toBe(9500);
  });

  it('falls back to qty × unitPrice when ocrTotalPrice is null', () => {
    const item = makeReceiptItem({ qty: 3, unitPrice: 2000, ocrTotalPrice: null });
    expect(calcLineTotal(item)).toBe(6000);
  });

  it('falls back to qty × unitPrice when ocrTotalPrice is 0', () => {
    const item = makeReceiptItem({ qty: 2, unitPrice: 1500, ocrTotalPrice: 0 });
    expect(calcLineTotal(item)).toBe(3000);
  });

  it('returns 0 for qty=0', () => {
    const item = makeReceiptItem({ qty: 0, unitPrice: 1000, ocrTotalPrice: null });
    expect(calcLineTotal(item)).toBe(0);
  });
});

describe('calcLineTotalWithCharges', () => {
  it('returns base total when no charges', () => {
    const item = makeReceiptItem({ qty: 1, unitPrice: 10000, ocrTotalPrice: null });
    expect(calcLineTotalWithCharges(item, [])).toBe(10000);
  });

  it('applies enabled charge percentage', () => {
    const item = makeReceiptItem({ qty: 1, unitPrice: 10000, ocrTotalPrice: null });
    const charges: ReceiptCharge[] = [{ id: 'c1', label: 'НДС', percent: 10, enabled: true }];
    expect(calcLineTotalWithCharges(item, charges)).toBe(11000);
  });

  it('ignores disabled charges', () => {
    const item = makeReceiptItem({ qty: 1, unitPrice: 10000, ocrTotalPrice: null });
    const charges: ReceiptCharge[] = [{ id: 'c1', label: 'НДС', percent: 10, enabled: false }];
    expect(calcLineTotalWithCharges(item, charges)).toBe(10000);
  });

  it('stacks multiple enabled charges', () => {
    const item = makeReceiptItem({ qty: 1, unitPrice: 10000, ocrTotalPrice: null });
    const charges: ReceiptCharge[] = [
      { id: 'c1', label: 'НДС', percent: 10, enabled: true },
      { id: 'c2', label: 'Обслуживание', percent: 5, enabled: true },
    ];
    // 10000 * 1.15 = 11500
    expect(calcLineTotalWithCharges(item, charges)).toBe(11500);
  });
});

describe('calcSplitAmounts', () => {
  it('splits by quantity correctly', () => {
    const item = makeReceiptItem({ qty: 4, unitPrice: 2500, ocrTotalPrice: null });
    const [first, second] = calcSplitAmounts(item, 1);
    expect(first).toBe(2500); // 1 × 2500
    expect(second).toBe(7500); // 3 × 2500
  });

  it('uses ocrTotalPrice for proportional split', () => {
    const item = makeReceiptItem({ qty: 4, unitPrice: 0, ocrTotalPrice: 10000 });
    const [first, second] = calcSplitAmounts(item, 1);
    expect(first).toBe(2500);
    expect(second).toBe(7500);
  });

  it('returns [0,0] when firstQty is 0', () => {
    const item = makeReceiptItem({ qty: 4, unitPrice: 2500, ocrTotalPrice: null });
    expect(calcSplitAmounts(item, 0)).toEqual([0, 0]);
  });

  it('returns [0,0] when secondQty would be 0', () => {
    const item = makeReceiptItem({ qty: 4, unitPrice: 2500, ocrTotalPrice: null });
    expect(calcSplitAmounts(item, 4)).toEqual([0, 0]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useItemsStep
// ─────────────────────────────────────────────────────────────────────────────

describe('useItemsStep', () => {
  it('starts with empty items', () => {
    const { items } = mountComposable(() => useItemsStep());
    expect(items.value).toEqual([]);
  });

  it('addItem adds an empty item and returns its id', () => {
    const { addItem, items } = mountComposable(() => useItemsStep());
    const id = addItem();
    expect(items.value).toHaveLength(1);
    expect(items.value[0].id).toBe(id);
    expect(items.value[0].name).toBe('');
    expect(items.value[0].qty).toBe(1);
    expect(items.value[0].unitPrice).toBe(0);
  });

  it('updateItem updates fields by id', () => {
    const { addItem, updateItem, items } = mountComposable(() => useItemsStep());
    const id = addItem();
    updateItem(id, { name: 'Хлеб', unitPrice: 5000 });
    expect(items.value[0].name).toBe('Хлеб');
    expect(items.value[0].unitPrice).toBe(5000);
  });

  it('updateItem clears ocrTotalPrice when qty or unitPrice changes', () => {
    const step = mountComposable(() => useItemsStep());
    const id = step.addItem();
    step.updateItem(id, { ocrTotalPrice: 9999 });
    expect(step.items.value[0].ocrTotalPrice).toBe(9999);

    step.updateItem(id, { qty: 3 });
    expect(step.items.value[0].ocrTotalPrice).toBeNull();
  });

  it('deleteItem removes item by id', () => {
    const { addItem, deleteItem, items } = mountComposable(() => useItemsStep());
    const id1 = addItem();
    addItem();
    expect(items.value).toHaveLength(2);
    deleteItem(id1);
    expect(items.value).toHaveLength(1);
    expect(items.value[0].id).not.toBe(id1);
  });

  it('totalAmount equals sum of item line totals', () => {
    const { addItem, updateItem, totalAmount } = mountComposable(() => useItemsStep());
    const id1 = addItem();
    const id2 = addItem();
    updateItem(id1, { qty: 2, unitPrice: 5000 });
    updateItem(id2, { qty: 1, unitPrice: 8000 });
    // 2*5000 + 1*8000 = 18000
    expect(totalAmount.value).toBe(18000);
  });

  it('splitItem splits one item into two', () => {
    const { addItem, updateItem, splitItem, items } = mountComposable(() => useItemsStep());
    const id = addItem();
    updateItem(id, { name: 'Суши', qty: 4, unitPrice: 3000 });
    splitItem(id, 1);
    expect(items.value).toHaveLength(2);
    expect(items.value[0].name).toContain('(1/2)');
    expect(items.value[0].qty).toBe(1);
    expect(items.value[1].name).toContain('(2/2)');
    expect(items.value[1].qty).toBe(3);
  });

  it('addCharge appends charge', () => {
    const { addCharge, charges } = mountComposable(() => useItemsStep());
    addCharge('НДС', 12);
    expect(charges.value).toHaveLength(1);
    expect(charges.value[0].label).toBe('НДС');
    expect(charges.value[0].percent).toBe(12);
    expect(charges.value[0].enabled).toBe(true);
  });

  it('removeCharge removes charge by id', () => {
    const { addCharge, removeCharge, charges } = mountComposable(() => useItemsStep());
    addCharge('НДС', 12);
    const chargeId = charges.value[0].id;
    removeCharge(chargeId);
    expect(charges.value).toHaveLength(0);
  });

  it('toggleCharge toggles enabled state', () => {
    const { addCharge, toggleCharge, charges } = mountComposable(() => useItemsStep());
    addCharge('НДС', 12);
    const chargeId = charges.value[0].id;
    expect(charges.value[0].enabled).toBe(true);
    toggleCharge(chargeId);
    expect(charges.value[0].enabled).toBe(false);
    toggleCharge(chargeId);
    expect(charges.value[0].enabled).toBe(true);
  });

  it('chargesAmount applies charge to subtotal', () => {
    const { addItem, updateItem, addCharge, chargesAmount, subtotal } = mountComposable(() =>
      useItemsStep(),
    );
    const id = addItem();
    updateItem(id, { qty: 1, unitPrice: 10000 });
    addCharge('Обслуживание', 10);
    expect(subtotal.value).toBe(10000);
    expect(chargesAmount.value).toBe(1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useParticipantsStep
// ─────────────────────────────────────────────────────────────────────────────

describe('useParticipantsStep', () => {
  it('starts with no participants', () => {
    const itemsStep = mountComposable(() => useItemsStep());
    const { participants } = mountComposable(() => useParticipantsStep(itemsStep.items));
    expect(participants.value).toHaveLength(0);
  });

  it('addParticipant adds a new participant', () => {
    const itemsStep = mountComposable(() => useItemsStep());
    const { addParticipant, participants } = mountComposable(() =>
      useParticipantsStep(itemsStep.items),
    );
    addParticipant('Александр');
    expect(participants.value).toHaveLength(1);
    expect(participants.value[0].name).toBe('Александр');
    expect(participants.value[0].isMe).toBe(false);
  });

  it('addParticipant can mark participant as me', () => {
    const itemsStep = mountComposable(() => useItemsStep());
    const { addParticipant, participants, hasMe } = mountComposable(() =>
      useParticipantsStep(itemsStep.items),
    );
    addParticipant('Я', true);
    expect(participants.value[0].isMe).toBe(true);
    expect(hasMe.value).toBe(true);
  });

  it('removeParticipant removes participant', () => {
    const itemsStep = mountComposable(() => useItemsStep());
    const { addParticipant, removeParticipant, participants } = mountComposable(() =>
      useParticipantsStep(itemsStep.items),
    );
    addParticipant('Алексей');
    const id = participants.value[0].id;
    removeParticipant(id);
    expect(participants.value).toHaveLength(0);
  });

  it('toggleItemParticipant assigns participant to item', () => {
    const itemsStep = mountComposable(() => useItemsStep());
    const itemId = itemsStep.addItem();

    const { addParticipant, toggleItemParticipant, participants } = mountComposable(() =>
      useParticipantsStep(itemsStep.items),
    );
    addParticipant('Олег');
    const pId = participants.value[0].id;

    toggleItemParticipant(itemId, pId);
    expect(itemsStep.items.value[0].assignedParticipantIds).toContain(pId);

    // Toggle again removes
    toggleItemParticipant(itemId, pId);
    expect(itemsStep.items.value[0].assignedParticipantIds).not.toContain(pId);
  });

  it('unassignedCount tracks items with no participants', () => {
    const itemsStep = mountComposable(() => useItemsStep());
    itemsStep.addItem();
    itemsStep.addItem();

    const { addParticipant, toggleItemParticipant, unassignedCount, participants } =
      mountComposable(() => useParticipantsStep(itemsStep.items));

    expect(unassignedCount.value).toBe(2);

    addParticipant('Артём');
    const pId = participants.value[0].id;
    toggleItemParticipant(itemsStep.items.value[0].id, pId);

    expect(unassignedCount.value).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// usePhotoStep — OCR flow
// ─────────────────────────────────────────────────────────────────────────────

describe('usePhotoStep — OCR flow', () => {
  it('selectFile sets selectedFile and triggers OCR scan', async () => {
    const ocrSuccess = makeOcrResponse();

    server.use(http.post('*/api/receipts/scan', () => HttpResponse.json(ocrSuccess)));

    const onOcrSuccess = vi.fn();
    const goNext = vi.fn();

    const { selectFile, isOcrLoading, isOcrSuccess } = mountComposable(() =>
      usePhotoStep(onOcrSuccess, goNext),
    );

    const file = new File(['fake-image-data'], 'receipt.jpg', { type: 'image/jpeg' });
    selectFile(file);

    expect(isOcrLoading.value).toBe(true);

    await flushPromises();

    expect(isOcrLoading.value).toBe(false);
    expect(isOcrSuccess.value).toBe(true);
    expect(onOcrSuccess).toHaveBeenCalledOnce();
    expect(hapticsMock.trigger).toHaveBeenCalledWith('success');
  });

  it('filters service keywords from OCR items', async () => {
    const ocrResponse = makeOcrResponse({
      items: [
        { name: 'Яблоки', quantity: 1, unitPrice: 5000, totalPrice: 5000 },
        { name: 'НДС', quantity: 1, unitPrice: 500, totalPrice: 500 }, // should be filtered
        { name: 'Обслуживание', quantity: 1, unitPrice: 200, totalPrice: 200 }, // filtered
      ],
    });

    server.use(http.post('*/api/receipts/scan', () => HttpResponse.json(ocrResponse)));

    const onOcrSuccess = vi.fn();
    const goNext = vi.fn();

    const { selectFile } = mountComposable(() => usePhotoStep(onOcrSuccess, goNext));

    const file = new File(['data'], 'receipt.jpg', { type: 'image/jpeg' });
    selectFile(file);

    await flushPromises();

    expect(onOcrSuccess).toHaveBeenCalledOnce();
    const result = onOcrSuccess.mock.calls[0][0];
    // Only 'Яблоки' should remain — НДС and Обслуживание are filtered
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Яблоки');
  });

  it('sets ocrError on API failure', async () => {
    server.use(
      http.post('*/api/receipts/scan', () =>
        HttpResponse.json({ message: 'OCR failed' }, { status: 500 }),
      ),
    );

    const onOcrSuccess = vi.fn();
    const goNext = vi.fn();

    const { selectFile, isOcrSuccess, ocrError } = mountComposable(() =>
      usePhotoStep(onOcrSuccess, goNext),
    );

    const file = new File(['data'], 'receipt.jpg', { type: 'image/jpeg' });
    selectFile(file);

    await flushPromises();

    expect(isOcrSuccess.value).toBe(false);
    expect(ocrError.value).toBeTruthy();
    expect(onOcrSuccess).not.toHaveBeenCalled();
    expect(hapticsMock.trigger).toHaveBeenCalledWith('error');
  });

  it('resetPhoto clears all state', async () => {
    server.use(http.post('*/api/receipts/scan', () => HttpResponse.json(makeOcrResponse())));

    const onOcrSuccess = vi.fn();
    const goNext = vi.fn();

    const { selectFile, resetPhoto, isOcrLoading, isOcrSuccess, ocrError, previewUrl } =
      mountComposable(() => usePhotoStep(onOcrSuccess, goNext));

    const file = new File(['data'], 'receipt.jpg', { type: 'image/jpeg' });
    selectFile(file);
    await flushPromises();

    resetPhoto();

    expect(isOcrLoading.value).toBe(false);
    expect(isOcrSuccess.value).toBe(false);
    expect(ocrError.value).toBeNull();
    expect(previewUrl.value).toBeNull();
  });

  it('populates storeName from OCR', async () => {
    server.use(
      http.post('*/api/receipts/scan', () =>
        HttpResponse.json(makeOcrResponse({ storeName: 'Makro', hashtags: [] })),
      ),
    );

    const capturedResult = vi.fn();
    const goNext = vi.fn();

    const { selectFile } = mountComposable(() => usePhotoStep(capturedResult, goNext));

    selectFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    await flushPromises();

    expect(capturedResult.mock.calls[0][0].storeName).toBe('Makro');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useReceiptWizard — full wizard flow
// ─────────────────────────────────────────────────────────────────────────────

describe('useReceiptWizard', () => {
  it('starts at step 1', () => {
    const { currentStep } = mountComposable(() => useReceiptWizard(() => USER_ID));
    expect(currentStep.value).toBe(1);
  });

  it('goNext advances to next step', () => {
    const { goNext, currentStep } = mountComposable(() => useReceiptWizard(() => USER_ID));
    goNext();
    expect(currentStep.value).toBe(2);
  });

  it('goBack returns to previous step', () => {
    const { goNext, goBack, currentStep } = mountComposable(() => useReceiptWizard(() => USER_ID));
    goNext();
    goNext();
    expect(currentStep.value).toBe(3);
    goBack();
    expect(currentStep.value).toBe(2);
  });

  it('does not go below step 1', () => {
    const { goBack, currentStep } = mountComposable(() => useReceiptWizard(() => USER_ID));
    goBack();
    expect(currentStep.value).toBe(1);
  });

  it('does not go above step 4', () => {
    const { goNext, currentStep } = mountComposable(() => useReceiptWizard(() => USER_ID));
    goNext();
    goNext();
    goNext();
    goNext(); // 5th attempt
    expect(currentStep.value).toBe(4);
  });

  it('OCR result populates items and updates formData', async () => {
    const ocrResponse = makeOcrResponse({
      storeName: 'Korzinka',
      hashtags: ['#korzinka'],
      currency: 'UZS',
      date: '2026-03-20',
    });

    server.use(http.post('*/api/receipts/scan', () => HttpResponse.json(ocrResponse)));

    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));

    const file = new File(['data'], 'receipt.jpg', { type: 'image/jpeg' });
    wizard.selectFile(file);

    await flushPromises();

    expect(wizard.items.value).toHaveLength(2);
    expect(wizard.items.value[0].name).toBe('Яблоки');
    expect(wizard.currency.value).toBe('UZS');
    expect(wizard.storeName.value).toBe('Korzinka');
    expect(wizard.formData.value.description).toBe('#korzinka');
  });

  it('OCR result with serviceChargePercent adds a charge', async () => {
    server.use(
      http.post('*/api/receipts/scan', () =>
        HttpResponse.json(makeOcrResponse({ serviceChargePercent: 10 })),
      ),
    );

    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));

    wizard.selectFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    await flushPromises();

    expect(wizard.charges.value).toHaveLength(1);
    expect(wizard.charges.value[0].percent).toBe(10);
    expect(wizard.charges.value[0].enabled).toBe(true);
  });

  it('OCR result with no serviceChargePercent has no charges', async () => {
    server.use(
      http.post('*/api/receipts/scan', () =>
        HttpResponse.json(makeOcrResponse({ serviceChargePercent: null })),
      ),
    );

    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));
    wizard.selectFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    await flushPromises();

    expect(wizard.charges.value).toHaveLength(0);
  });

  it('falls back to storeName-based description when no hashtags', async () => {
    server.use(
      http.post('*/api/receipts/scan', () =>
        HttpResponse.json(makeOcrResponse({ storeName: 'My Store', hashtags: [] })),
      ),
    );

    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));
    wizard.selectFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    await flushPromises();

    expect(wizard.formData.value.description).toContain('mystore');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useSubmitStep — transaction + debt creation
// ─────────────────────────────────────────────────────────────────────────────

describe('useSubmitStep via useReceiptWizard — handleSubmit', () => {
  it('requires accountId and categoryId to submit', async () => {
    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));
    // isFormValid should be false without accountId, categoryId and totalAmount
    expect(wizard.isFormValid.value).toBe(false);
  });

  it('isFormValid is true when all required fields present', async () => {
    server.use(
      http.post('*/api/receipts/scan', () =>
        HttpResponse.json(makeOcrResponse({ serviceChargePercent: null })),
      ),
    );

    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));
    wizard.selectFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    await flushPromises();

    wizard.formData.value.accountId = 'acc-1';
    wizard.formData.value.categoryId = 'cat-groceries';

    expect(wizard.isFormValid.value).toBe(true);
  });

  it('handleSubmit creates transaction with correct fields', async () => {
    let txBody: any = null;

    server.use(
      http.post('*/api/receipts/scan', () =>
        HttpResponse.json(makeOcrResponse({ serviceChargePercent: null })),
      ),
      http.post('*/api/transactions', async ({ request }) => {
        txBody = await request.json();
        return HttpResponse.json({
          id: 'tx-receipt-1',
          userId: USER_ID,
          accountId: 'acc-1',
          categoryId: 'cat-groceries',
          amount: 18000,
          currency: 'UZS',
          type: 'expense',
          description: '#korzinka',
          date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isDebtRelated: false,
          debtId: null,
          toAccountId: null,
          toAmount: null,
          toCurrency: null,
          returnedAmount: 0,
          netAmount: 18000,
          hasDebtReturns: false,
        });
      }),
    );

    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));
    wizard.selectFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    await flushPromises();

    wizard.formData.value.accountId = 'acc-1';
    wizard.formData.value.categoryId = 'cat-groceries';
    wizard.formData.value.createDebts = false;

    await wizard.handleSubmit();
    await flushPromises();

    expect(txBody).not.toBeNull();
    expect(txBody.type).toBe('expense');
    expect(txBody.amount).toBe(18000);
    expect(txBody.currency).toBe('UZS');
    expect(txBody.accountId).toBe('acc-1');
    expect(txBody.categoryId).toBe('cat-groceries');
    expect(wizard.isSuccess.value).toBe(true);
  });

  it('handleSubmit creates debts for non-me participants when createDebts=true', async () => {
    const debtBodies: any[] = [];

    server.use(
      http.post('*/api/receipts/scan', () =>
        HttpResponse.json(makeOcrResponse({ serviceChargePercent: null })),
      ),
      http.post('*/api/transactions', async () =>
        HttpResponse.json({
          id: 'tx-receipt-2',
          userId: USER_ID,
          accountId: 'acc-1',
          categoryId: 'cat-groceries',
          amount: 18000,
          currency: 'UZS',
          type: 'expense',
          description: null,
          date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isDebtRelated: false,
          debtId: null,
          toAccountId: null,
          toAmount: null,
          toCurrency: null,
          returnedAmount: 0,
          netAmount: 18000,
          hasDebtReturns: false,
        }),
      ),
      http.post('*/api/debts', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        debtBodies.push(body);
        return HttpResponse.json({
          id: `debt-${Date.now()}`,
          userId: USER_ID,
          ...body,
          isClosed: false,
          closedAt: null,
        });
      }),
    );

    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));
    wizard.selectFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    await flushPromises();

    // Add a non-me participant and assign all items
    wizard.addParticipant('Друг', false);
    const friendId = wizard.participants.value[0].id;
    wizard.items.value.forEach((item) => {
      wizard.toggleItemParticipant(item.id, friendId);
    });

    wizard.formData.value.accountId = 'acc-1';
    wizard.formData.value.categoryId = 'cat-groceries';
    wizard.formData.value.createDebts = true;

    await wizard.handleSubmit();
    await flushPromises();

    expect(debtBodies).toHaveLength(1);
    // debtsApi.create() transforms snake_case to camelCase before sending
    expect(debtBodies[0].personName).toBe('Друг');
    expect(debtBodies[0].debtType).toBe('given');
  });

  it('handleSubmit sets submitError on API failure', async () => {
    server.use(
      http.post('*/api/receipts/scan', () =>
        HttpResponse.json(makeOcrResponse({ serviceChargePercent: null })),
      ),
      http.post('*/api/transactions', () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 }),
      ),
    );

    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));
    wizard.selectFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    await flushPromises();

    wizard.formData.value.accountId = 'acc-1';
    wizard.formData.value.categoryId = 'cat-groceries';

    await wizard.handleSubmit();
    await flushPromises();

    expect(wizard.submitError.value).toBeTruthy();
    expect(wizard.isSuccess.value).toBe(false);
    expect(hapticsMock.trigger).toHaveBeenCalledWith('error');
  });
});
