import { describe, it, expect, beforeEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useReceiptDraft, type ReceiptDraft } from './model/useReceiptDraft';

const STORAGE_KEY = 'scan-receipt:draft';

function mountComposable<T>(setup: () => T): T {
  let result!: T;
  const Stub = defineComponent({
    setup() {
      result = setup();
      return () => h('div');
    },
  });
  mount(Stub);
  return result;
}

function makeSnapshot(
  overrides: Partial<Omit<ReceiptDraft, 'v' | 'savedAt'>> = {},
): Omit<ReceiptDraft, 'v' | 'savedAt'> {
  return {
    step: 2,
    items: [
      {
        id: 'i1',
        name: 'Плов',
        qty: 1,
        unitPrice: 45000,
        ocrTotalPrice: null,
        assignedParticipantIds: [],
      },
    ],
    currency: 'UZS',
    storeName: 'Кафе',
    ocrTotalAmount: null,
    charges: [],
    totalAmount: 45000,
    participants: [],
    payerId: null,
    formData: {
      accountId: null,
      categoryId: '',
      description: '',
      date: 1750000000000,
      createDebts: true,
      currency: 'UZS',
    },
    manualMode: false,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

describe('useReceiptDraft', () => {
  it('save → freshDraft: round-trip с savedAt и версией', () => {
    const { freshDraft, save } = mountComposable(() => useReceiptDraft());

    save(makeSnapshot());

    expect(freshDraft.value).not.toBeNull();
    expect(freshDraft.value!.v).toBe(1);
    expect(freshDraft.value!.items[0].name).toBe('Плов');
    expect(freshDraft.value!.totalAmount).toBe(45000);
    expect(freshDraft.value!.savedAt).toBeGreaterThan(0);
  });

  it('clear удаляет черновик', () => {
    const { freshDraft, save, clear } = mountComposable(() => useReceiptDraft());
    save(makeSnapshot());
    clear();
    expect(freshDraft.value).toBeNull();
  });

  it('черновик старше 24 часов не считается свежим', () => {
    const { draft, freshDraft } = mountComposable(() => useReceiptDraft());
    draft.value = {
      ...makeSnapshot(),
      v: 1,
      savedAt: Date.now() - 25 * 60 * 60 * 1000,
    };
    expect(freshDraft.value).toBeNull();
  });

  it('черновик без позиций не считается свежим', () => {
    const { draft, freshDraft } = mountComposable(() => useReceiptDraft());
    draft.value = { ...makeSnapshot({ items: [] }), v: 1, savedAt: Date.now() };
    expect(freshDraft.value).toBeNull();
  });

  it('черновик чужой версии схемы отбрасывается', () => {
    const { draft, freshDraft } = mountComposable(() => useReceiptDraft());
    draft.value = {
      ...makeSnapshot(),
      v: 2 as unknown as 1,
      savedAt: Date.now(),
    };
    expect(freshDraft.value).toBeNull();
  });

  it('битый JSON в localStorage не роняет композабл', () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    const { freshDraft } = mountComposable(() => useReceiptDraft());
    expect(freshDraft.value).toBeNull();
  });
});
