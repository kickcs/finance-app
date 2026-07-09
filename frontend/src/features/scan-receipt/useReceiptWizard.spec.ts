import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, ref } from 'vue';
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
import { useLastParty } from './model/useLastParty';
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
    serviceChargeAmount: null,
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
    expect(calcLineTotalWithCharges(item, [], 10000)).toBe(10000);
  });

  it('distributes percent charge proportionally to line share', () => {
    const item = makeReceiptItem({ qty: 1, unitPrice: 10000, ocrTotalPrice: null });
    const charges: ReceiptCharge[] = [
      { id: 'c1', label: 'НДС', type: 'percent', percent: 10, enabled: true },
    ];
    // Whole subtotal IS this line → full charge applies: 10000 + round(1000 * 10000/10000) = 11000
    expect(calcLineTotalWithCharges(item, charges, 10000)).toBe(11000);
  });

  it('ignores disabled charges', () => {
    const item = makeReceiptItem({ qty: 1, unitPrice: 10000, ocrTotalPrice: null });
    const charges: ReceiptCharge[] = [
      { id: 'c1', label: 'НДС', type: 'percent', percent: 10, enabled: false },
    ];
    expect(calcLineTotalWithCharges(item, charges, 10000)).toBe(10000);
  });

  it('stacks multiple enabled percent charges proportionally', () => {
    const item = makeReceiptItem({ qty: 1, unitPrice: 10000, ocrTotalPrice: null });
    const charges: ReceiptCharge[] = [
      { id: 'c1', label: 'НДС', type: 'percent', percent: 10, enabled: true },
      { id: 'c2', label: 'Обслуживание', type: 'percent', percent: 5, enabled: true },
    ];
    // chargesAmount = 1000 + 500 = 1500; line=subtotal so all 1500 apply
    expect(calcLineTotalWithCharges(item, charges, 10000)).toBe(11500);
  });

  it('distributes flat-amount charge proportionally to line share', () => {
    // Burger embassy line: 5000 of 379000 subtotal with 7990 fee
    const item = makeReceiptItem({ qty: 1, unitPrice: 5000, ocrTotalPrice: null });
    const charges: ReceiptCharge[] = [
      { id: 'c1', label: 'Обслуживание', type: 'amount', amount: 7990, enabled: true },
    ];
    // 5000 + round(7990 * 5000 / 379000) = 5000 + round(105.408) = 5105
    expect(calcLineTotalWithCharges(item, charges, 379000)).toBe(5105);
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

  it('addCharge appends a percent-type charge', () => {
    const { addCharge, charges } = mountComposable(() => useItemsStep());
    addCharge({ label: 'НДС', type: 'percent', percent: 12 });
    expect(charges.value).toHaveLength(1);
    const charge = charges.value[0];
    expect(charge.label).toBe('НДС');
    expect(charge.type).toBe('percent');
    if (charge.type !== 'percent') throw new Error('expected percent charge');
    expect(charge.percent).toBe(12);
    expect(charge.enabled).toBe(true);
  });

  it('removeCharge removes charge by id', () => {
    const { addCharge, removeCharge, charges } = mountComposable(() => useItemsStep());
    addCharge({ label: 'НДС', type: 'percent', percent: 12 });
    const chargeId = charges.value[0].id;
    removeCharge(chargeId);
    expect(charges.value).toHaveLength(0);
  });

  it('toggleCharge toggles enabled state', () => {
    const { addCharge, toggleCharge, charges } = mountComposable(() => useItemsStep());
    addCharge({ label: 'НДС', type: 'percent', percent: 12 });
    const chargeId = charges.value[0].id;
    expect(charges.value[0].enabled).toBe(true);
    toggleCharge(chargeId);
    expect(charges.value[0].enabled).toBe(false);
    toggleCharge(chargeId);
    expect(charges.value[0].enabled).toBe(true);
  });

  it('chargesAmount applies percent charge to subtotal', () => {
    const { addItem, updateItem, addCharge, chargesAmount, subtotal } = mountComposable(() =>
      useItemsStep(),
    );
    const id = addItem();
    updateItem(id, { qty: 1, unitPrice: 10000 });
    addCharge({ label: 'Обслуживание', type: 'percent', percent: 10 });
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
  it('addFile + scanReceipt запускают OCR', async () => {
    const ocrSuccess = makeOcrResponse();

    server.use(http.post('*/api/receipts/scan', () => HttpResponse.json(ocrSuccess)));

    const onOcrSuccess = vi.fn();
    const goNext = vi.fn();

    const { addFile, scanReceipt, isOcrLoading, isOcrSuccess } = mountComposable(() =>
      usePhotoStep(onOcrSuccess, goNext),
    );

    const file = new File(['fake-image-data'], 'receipt.jpg', { type: 'image/jpeg' });
    addFile(file);
    scanReceipt();

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

    const { addFile, scanReceipt } = mountComposable(() => usePhotoStep(onOcrSuccess, goNext));

    const file = new File(['data'], 'receipt.jpg', { type: 'image/jpeg' });
    addFile(file);
    scanReceipt();

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

    const { addFile, scanReceipt, isOcrSuccess, ocrError } = mountComposable(() =>
      usePhotoStep(onOcrSuccess, goNext),
    );

    const file = new File(['data'], 'receipt.jpg', { type: 'image/jpeg' });
    addFile(file);
    scanReceipt();

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

    const { addFile, scanReceipt, resetPhoto, isOcrLoading, isOcrSuccess, ocrError, previewUrls } =
      mountComposable(() => usePhotoStep(onOcrSuccess, goNext));

    const file = new File(['data'], 'receipt.jpg', { type: 'image/jpeg' });
    addFile(file);
    scanReceipt();
    await flushPromises();

    resetPhoto();

    expect(isOcrLoading.value).toBe(false);
    expect(isOcrSuccess.value).toBe(false);
    expect(ocrError.value).toBeNull();
    expect(previewUrls.value).toEqual([]);
  });

  it('populates storeName from OCR', async () => {
    server.use(
      http.post('*/api/receipts/scan', () =>
        HttpResponse.json(makeOcrResponse({ storeName: 'Makro', hashtags: [] })),
      ),
    );

    const capturedResult = vi.fn();
    const goNext = vi.fn();

    const { addFile, scanReceipt } = mountComposable(() => usePhotoStep(capturedResult, goNext));

    addFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));

    scanReceipt();
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
    wizard.addFile(file);
    wizard.scanReceipt();

    await flushPromises();

    expect(wizard.items.value).toHaveLength(2);
    expect(wizard.items.value[0].name).toBe('Яблоки');
    expect(wizard.currency.value).toBe('UZS');
    expect(wizard.storeName.value).toBe('Korzinka');
    expect(wizard.formData.value.description).toBe('#korzinka');
  });

  it('OCR result with serviceChargePercent adds a percent charge', async () => {
    server.use(
      http.post('*/api/receipts/scan', () =>
        HttpResponse.json(makeOcrResponse({ serviceChargePercent: 10 })),
      ),
    );

    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));

    wizard.addFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));

    wizard.scanReceipt();
    await flushPromises();

    expect(wizard.charges.value).toHaveLength(1);
    const charge = wizard.charges.value[0];
    expect(charge.type).toBe('percent');
    if (charge.type !== 'percent') throw new Error('expected percent charge');
    expect(charge.percent).toBe(10);
    expect(charge.enabled).toBe(true);
  });

  it('OCR result with serviceChargeAmount adds a flat-amount charge (preserves exact value)', async () => {
    // Burger embassy: 7990 UZS flat fee on 379000 subtotal → must NOT be lossy-converted to %
    server.use(
      http.post('*/api/receipts/scan', () =>
        HttpResponse.json(
          makeOcrResponse({
            items: [{ name: 'Бургер', quantity: 1, unitPrice: 379000, totalPrice: 379000 }],
            totalAmount: 386990,
            serviceChargePercent: null,
            serviceChargeAmount: 7990,
          }),
        ),
      ),
    );

    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));
    wizard.addFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    wizard.scanReceipt();
    await flushPromises();

    expect(wizard.charges.value).toHaveLength(1);
    const charge = wizard.charges.value[0];
    expect(charge.type).toBe('amount');
    if (charge.type !== 'amount') throw new Error('expected amount charge');
    expect(charge.amount).toBe(7990);
    expect(wizard.subtotal.value).toBe(379000);
    expect(wizard.chargesAmount.value).toBe(7990);
    expect(wizard.totalAmount.value).toBe(386990);
  });

  it('OCR result prefers serviceChargeAmount when both fields are returned', async () => {
    server.use(
      http.post('*/api/receipts/scan', () =>
        HttpResponse.json(makeOcrResponse({ serviceChargePercent: 10, serviceChargeAmount: 1234 })),
      ),
    );

    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));
    wizard.addFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    wizard.scanReceipt();
    await flushPromises();

    expect(wizard.charges.value).toHaveLength(1);
    expect(wizard.charges.value[0].type).toBe('amount');
  });

  it('OCR result with no charges has no charges', async () => {
    server.use(
      http.post('*/api/receipts/scan', () =>
        HttpResponse.json(
          makeOcrResponse({ serviceChargePercent: null, serviceChargeAmount: null }),
        ),
      ),
    );

    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));
    wizard.addFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    wizard.scanReceipt();
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
    wizard.addFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    wizard.scanReceipt();
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
    wizard.addFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    wizard.scanReceipt();
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
    wizard.addFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    wizard.scanReceipt();
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
    wizard.addFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    wizard.scanReceipt();
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
    wizard.addFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    wizard.scanReceipt();
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

// ─────────────────────────────────────────────────────────────────────────────
// useReceiptWizard — ручной режим и мульти-фото
// ─────────────────────────────────────────────────────────────────────────────

describe('useReceiptWizard — ручной режим и мульти-фото', () => {
  function makeJpeg(name: string): File {
    return new File(['x'], name, { type: 'image/jpeg' });
  }

  it('startManualMode создаёт пустую позицию и открывает шаг 2', () => {
    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));

    wizard.startManualMode('USD');

    expect(wizard.manualMode.value).toBe(true);
    expect(wizard.currentStep.value).toBe(2);
    expect(wizard.items.value).toHaveLength(1);
    expect(wizard.currency.value).toBe('USD');
    expect(wizard.formData.value.currency).toBe('USD');
    expect(wizard.ocrTotalAmount.value).toBeNull();
  });

  it('addFile принимает максимум 3 кадра', () => {
    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));

    expect(wizard.addFile(makeJpeg('1.jpg'))).toBe(true);
    expect(wizard.addFile(makeJpeg('2.jpg'))).toBe(true);
    expect(wizard.addFile(makeJpeg('3.jpg'))).toBe(true);
    expect(wizard.addFile(makeJpeg('4.jpg'))).toBe(false);

    expect(wizard.previewUrls.value).toHaveLength(3);
  });

  it('removeFile удаляет кадр по индексу', () => {
    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));
    wizard.addFile(makeJpeg('1.jpg'));
    wizard.addFile(makeJpeg('2.jpg'));

    wizard.removeFile(0);

    expect(wizard.previewUrls.value).toHaveLength(1);
    expect(wizard.selectedFiles.value.map((f) => f.name)).toEqual(['2.jpg']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useSubmitStep — «Платил не я»
// ─────────────────────────────────────────────────────────────────────────────

describe('useSubmitStep via useReceiptWizard — «Платил не я»', () => {
  async function setupWizardWithPayer() {
    const transactionCalls: unknown[] = [];
    const debtCalls: Record<string, unknown>[] = [];
    server.use(
      http.post('*/api/receipts/scan', () => HttpResponse.json(makeOcrResponse())),
      http.post('*/api/transactions', async ({ request }) => {
        transactionCalls.push(await request.json());
        return HttpResponse.json({ id: 'tx-1' });
      }),
      http.post('*/api/debts', async ({ request }) => {
        debtCalls.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ id: 'debt-1' });
      }),
    );

    const wizard = mountComposable(() => useReceiptWizard(() => USER_ID));
    wizard.addFile(new File(['data'], 'r.jpg', { type: 'image/jpeg' }));
    wizard.scanReceipt();
    await flushPromises();

    wizard.addParticipant('Я', true);
    wizard.addParticipant('Аня');
    return { wizard, transactionCalls, debtCalls };
  }

  it('создаёт один долг «я должен» вместо транзакции, категория не нужна', async () => {
    const { wizard, transactionCalls, debtCalls } = await setupWizardWithPayer();
    wizard.assignAllToEveryone();
    const anya = wizard.participants.value.find((p) => p.name === 'Аня')!;
    wizard.payerId.value = anya.id;
    wizard.formData.value.accountId = 'acc-1';
    // categoryId намеренно пуст

    expect(wizard.isFormValid.value).toBe(true);

    await wizard.handleSubmit();
    await flushPromises();

    expect(wizard.isSuccess.value).toBe(true);
    expect(transactionCalls).toHaveLength(0);
    expect(debtCalls).toHaveLength(1);
    // 18000 поровну на двоих → моя доля 9000 (тело запроса — camelCase бэкенда)
    expect(debtCalls[0]).toMatchObject({
      debtType: 'taken',
      personName: 'Аня',
      totalAmount: 9000,
      remainingAmount: 9000,
    });
  });

  it('невалиден, когда моя доля пуста', async () => {
    const { wizard } = await setupWizardWithPayer();
    const anya = wizard.participants.value.find((p) => p.name === 'Аня')!;
    wizard.payerId.value = anya.id;
    wizard.formData.value.accountId = 'acc-1';
    // позиции никому не назначены → моя доля 0

    expect(wizard.myShareTotal.value).toBe(0);
    expect(wizard.isFormValid.value).toBe(false);
  });

  it('удаление участника-плательщика сбрасывает payerId', async () => {
    const { wizard } = await setupWizardWithPayer();
    const anya = wizard.participants.value.find((p) => p.name === 'Аня')!;
    wizard.payerId.value = anya.id;

    wizard.removeParticipant(anya.id);

    expect(wizard.payerId.value).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useItemsStep — сверка суммы с итогом чека (OCR)
// ─────────────────────────────────────────────────────────────────────────────

describe('useItemsStep — сверка суммы с чеком', () => {
  it('totalMismatch появляется при расхождении >1% и скрывается dismissMismatch', () => {
    const step = mountComposable(() => useItemsStep());
    step.items.value = [makeReceiptItem({ qty: 1, unitPrice: 90000 })];
    step.setOcrTotalAmount(100000);

    expect(step.totalMismatch.value).toEqual({ diff: 10000 });

    step.dismissMismatch();
    expect(step.totalMismatch.value).toBeNull();
  });

  it('нет mismatch без ocrTotalAmount и при расхождении в пределах 1%', () => {
    const step = mountComposable(() => useItemsStep());
    step.items.value = [makeReceiptItem({ qty: 1, unitPrice: 99500 })];

    expect(step.totalMismatch.value).toBeNull();

    step.setOcrTotalAmount(100000); // расхождение 0.5%
    expect(step.totalMismatch.value).toBeNull();
  });

  it('setOcrTotalAmount сбрасывает dismissed-флаг (новый скан — новая сверка)', () => {
    const step = mountComposable(() => useItemsStep());
    step.items.value = [makeReceiptItem({ qty: 1, unitPrice: 90000 })];
    step.setOcrTotalAmount(100000);
    step.dismissMismatch();
    expect(step.totalMismatch.value).toBeNull();

    step.setOcrTotalAmount(100000);
    expect(step.totalMismatch.value).toEqual({ diff: 10000 });
  });

  it('addDiffAsItem добавляет «Прочее» на разницу и сверка сходится', () => {
    const step = mountComposable(() => useItemsStep());
    step.items.value = [makeReceiptItem({ qty: 1, unitPrice: 90000 })];
    step.setOcrTotalAmount(100000);

    step.addDiffAsItem();

    const added = step.items.value[1];
    expect(added.name).toBe('Прочее');
    expect(added.qty).toBe(1);
    expect(added.unitPrice).toBe(10000);
    expect(step.totalMismatch.value).toBeNull();
  });

  it('addDiffAsItem корректирует цену на процентные сборы', () => {
    const step = mountComposable(() => useItemsStep());
    step.items.value = [makeReceiptItem({ qty: 1, unitPrice: 100000 })];
    step.addCharge({ label: 'Обслуживание', type: 'percent', percent: 10 });
    step.setOcrTotalAmount(121000); // total сейчас 110000, разница 11000

    step.addDiffAsItem();

    // 11000 / 1.1 = 10000 — с учётом 10% сбора итог сойдётся точно
    expect(step.items.value[1].unitPrice).toBe(10000);
    expect(step.totalAmount.value).toBe(121000);
    expect(step.totalMismatch.value).toBeNull();
  });

  it('addDiffAsItem не делает ничего при отрицательной разнице', () => {
    const step = mountComposable(() => useItemsStep());
    step.items.value = [makeReceiptItem({ qty: 1, unitPrice: 120000 })];
    step.setOcrTotalAmount(100000);

    step.addDiffAsItem();
    expect(step.items.value).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useItemsStep — explodeItem, deleteItem/restoreItem, addCharge
// ─────────────────────────────────────────────────────────────────────────────

describe('useItemsStep — explodeItem', () => {
  it('раскладывает qty=3 на 3 строки по 1 шт с ценой за единицу', () => {
    const step = mountComposable(() => useItemsStep());
    step.items.value = [
      makeReceiptItem({ id: 'a', name: 'Шашлык', qty: 3, unitPrice: 18000, ocrTotalPrice: 54000 }),
    ];

    step.explodeItem('a');

    expect(step.items.value).toHaveLength(3);
    expect(step.items.value.map((i) => i.name)).toEqual([
      'Шашлык (1/3)',
      'Шашлык (2/3)',
      'Шашлык (3/3)',
    ]);
    expect(step.items.value.every((i) => i.qty === 1 && i.unitPrice === 18000)).toBe(true);
    expect(step.items.value.map((i) => i.ocrTotalPrice)).toEqual([18000, 18000, 18000]);
  });

  it('отдаёт остаток ocrTotalPrice последней строке', () => {
    const step = mountComposable(() => useItemsStep());
    step.items.value = [makeReceiptItem({ id: 'a', qty: 3, unitPrice: 33, ocrTotalPrice: 100 })];

    step.explodeItem('a');

    expect(step.items.value.map((i) => i.ocrTotalPrice)).toEqual([33, 33, 34]);
  });

  it('не раскладывает дробное qty, qty=1 и qty>10', () => {
    const step = mountComposable(() => useItemsStep());
    step.items.value = [
      makeReceiptItem({ id: 'a', qty: 1.5 }),
      makeReceiptItem({ id: 'b', qty: 1 }),
      makeReceiptItem({ id: 'c', qty: 11 }),
    ];

    step.explodeItem('a');
    step.explodeItem('b');
    step.explodeItem('c');

    expect(step.items.value).toHaveLength(3);
  });
});

describe('useItemsStep — deleteItem/restoreItem (undo)', () => {
  it('deleteItem возвращает снапшот, restoreItem ставит позицию на прежний индекс', () => {
    const step = mountComposable(() => useItemsStep());
    step.items.value = [
      makeReceiptItem({ id: 'a', name: 'Первый' }),
      makeReceiptItem({ id: 'b', name: 'Второй', assignedParticipantIds: ['p1'] }),
      makeReceiptItem({ id: 'c', name: 'Третий' }),
    ];

    const snapshot = step.deleteItem('b');

    expect(step.items.value.map((i) => i.id)).toEqual(['a', 'c']);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.index).toBe(1);

    step.restoreItem(snapshot!.item, snapshot!.index);

    expect(step.items.value.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(step.items.value[1].assignedParticipantIds).toEqual(['p1']);
  });

  it('deleteItem неизвестного id возвращает null', () => {
    const step = mountComposable(() => useItemsStep());
    step.items.value = [makeReceiptItem({ id: 'a' })];
    expect(step.deleteItem('nope')).toBeNull();
    expect(step.items.value).toHaveLength(1);
  });
});

describe('useParticipantsStep — setPaidBy', () => {
  function setup() {
    const items = ref<ReceiptItem[]>([]);
    const step = mountComposable(() => useParticipantsStep(items));
    step.addParticipant('Я', true);
    step.addParticipant('Аня');
    step.addParticipant('Тимур');
    return { items, step };
  }

  it('назначает и сбрасывает плательщика', () => {
    const { step } = setup();
    const [me, anya] = step.participants.value;

    step.setPaidBy(anya.id, me.id);
    expect(anya.paidById).toBe(me.id);

    step.setPaidBy(anya.id, null);
    expect(anya.paidById).toBeNull();
  });

  it('запрещает самоссылку и зависимого в роли плательщика', () => {
    const { step } = setup();
    const [me, anya, timur] = step.participants.value;

    step.setPaidBy(anya.id, anya.id);
    expect(anya.paidById).toBeNull();

    step.setPaidBy(anya.id, me.id); // Аня — зависимая
    step.setPaidBy(timur.id, anya.id); // зависимый не может платить
    expect(timur.paidById).toBeNull();
  });

  it('участник, ставший зависимым, отпускает своих зависимых', () => {
    const { step } = setup();
    const [me, anya, timur] = step.participants.value;

    step.setPaidBy(timur.id, anya.id); // Аня платит за Тимура
    step.setPaidBy(anya.id, me.id); // теперь за Аню платит Я

    expect(anya.paidById).toBe(me.id);
    expect(timur.paidById).toBeNull();
  });
});

describe('useParticipantsStep — быстрые действия', () => {
  it('assignAllToEveryone назначает все позиции всем участникам', () => {
    const items = ref<ReceiptItem[]>([
      makeReceiptItem({ id: 'a' }),
      makeReceiptItem({ id: 'b', assignedParticipantIds: ['stale'] }),
    ]);
    const step = mountComposable(() => useParticipantsStep(items));
    step.addParticipant('Я', true);
    step.addParticipant('Аня');
    const ids = step.participants.value.map((p) => p.id);

    step.assignAllToEveryone();

    expect(items.value[0].assignedParticipantIds).toEqual(ids);
    expect(items.value[1].assignedParticipantIds).toEqual(ids);
  });

  it('assignRestToMe добирает только неназначенные позиции', () => {
    const items = ref<ReceiptItem[]>([
      makeReceiptItem({ id: 'a' }),
      makeReceiptItem({ id: 'b', assignedParticipantIds: ['someone'] }),
    ]);
    const step = mountComposable(() => useParticipantsStep(items));
    step.addParticipant('Аня');
    step.addParticipant('Я', true);
    const me = step.participants.value.find((p) => p.isMe)!;

    step.assignRestToMe();

    expect(items.value[0].assignedParticipantIds).toEqual([me.id]);
    expect(items.value[1].assignedParticipantIds).toEqual(['someone']);
  });

  it('assignRestToMe без «Я» ничего не делает', () => {
    const items = ref<ReceiptItem[]>([makeReceiptItem({ id: 'a' })]);
    const step = mountComposable(() => useParticipantsStep(items));
    step.addParticipant('Аня');

    step.assignRestToMe();

    expect(items.value[0].assignedParticipantIds).toEqual([]);
  });
});

describe('useLastParty + restoreParty — «Как в прошлый раз»', () => {
  beforeEach(() => {
    localStorage.removeItem('scan-receipt:last-party');
  });

  it('saveParty сохраняет имена, isMe и плательщиков по именам', () => {
    const items = ref<ReceiptItem[]>([]);
    const step = mountComposable(() => useParticipantsStep(items));
    step.addParticipant('Я', true);
    step.addParticipant('Аня');
    const [me, anya] = step.participants.value;
    step.setPaidBy(anya.id, me.id);

    const { lastParty, saveParty } = mountComposable(() => useLastParty());
    saveParty(step.participants.value);

    expect(lastParty.value?.members).toEqual([
      { name: 'Я', isMe: true, paidByName: null },
      { name: 'Аня', isMe: false, paidByName: 'Я' },
    ]);
    expect(lastParty.value?.savedAt).toBeGreaterThan(0);
  });

  it('restoreParty пересоздаёт участников и связывает платежи по именам', () => {
    const items = ref<ReceiptItem[]>([]);
    const step = mountComposable(() => useParticipantsStep(items));

    step.restoreParty([
      { name: 'Я', isMe: true, paidByName: null },
      { name: 'Аня', isMe: false, paidByName: 'Я' },
      { name: 'Тимур', isMe: false, paidByName: null },
    ]);

    expect(step.participants.value).toHaveLength(3);
    const me = step.participants.value.find((p) => p.isMe)!;
    const anya = step.participants.value.find((p) => p.name === 'Аня')!;
    expect(anya.paidById).toBe(me.id);
  });

  it('restoreParty не трогает уже добавленных участников', () => {
    const items = ref<ReceiptItem[]>([]);
    const step = mountComposable(() => useParticipantsStep(items));
    step.addParticipant('Кто-то');

    step.restoreParty([{ name: 'Я', isMe: true, paidByName: null }]);

    expect(step.participants.value).toHaveLength(1);
    expect(step.participants.value[0].name).toBe('Кто-то');
  });
});

describe('useItemsStep — addCharge с типом amount', () => {
  it('добавляет фиксированный сбор и учитывает его в totalAmount', () => {
    const step = mountComposable(() => useItemsStep());
    step.items.value = [makeReceiptItem({ qty: 1, unitPrice: 100000 })];

    step.addCharge({ label: 'Чаевые', type: 'amount', amount: 5000 });

    const charge = step.charges.value[0];
    expect(charge.type).toBe('amount');
    expect(charge.enabled).toBe(true);
    expect(step.totalAmount.value).toBe(105000);
  });
});
