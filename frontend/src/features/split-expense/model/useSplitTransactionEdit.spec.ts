import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, ref, nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useSplitTransactionEdit } from './useSplitTransactionEdit';
import { mockGivenDebtResponse } from '@/test/mocks/handlers/debts';

// ── Mocks ──────────────────────────────────────────────────────────────────

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('@/shared/ui', async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return { ...orig, useToast: () => ({ toast: toastMock }) };
});

// ── Helpers ────────────────────────────────────────────────────────────────

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

/** Build a camelCase debt response linked to a source transaction */
function makeSplitDebtResponse(overrides: Record<string, unknown> = {}) {
  return {
    ...mockGivenDebtResponse,
    id: `split-debt-${Date.now()}-${Math.random()}`,
    sourceTransactionId: 'tx-split-1',
    transactionId: null,
    ...overrides,
  };
}

function mountComposable(
  opts: {
    transactionId?: string | null;
    amount?: number;
  } = {},
) {
  const txId = ref<string | null>(opts.transactionId ?? 'tx-split-1');
  const amount = ref(opts.amount ?? 90000);

  let result!: ReturnType<typeof useSplitTransactionEdit>;

  const Stub = defineComponent({
    setup() {
      result = useSplitTransactionEdit(
        () => txId.value,
        mockUser.id,
        () => amount.value,
      );
      return () => h('div');
    },
  });

  currentWrapper = renderWithProviders(Stub, { provideAuth: { user: mockUser } });
  return { result, txId, amount };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useSplitTransactionEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // ── Loading ───────────────────────────────────────────────────────────

  describe('loading split debts', () => {
    it('loads debts linked to transaction via source_transaction_id', async () => {
      const debt1 = makeSplitDebtResponse({
        id: 'sd-1',
        personName: 'Олег',
        totalAmount: 30000,
        remainingAmount: 30000,
      });
      const debt2 = makeSplitDebtResponse({
        id: 'sd-2',
        personName: 'Анвар',
        totalAmount: 30000,
        remainingAmount: 30000,
      });
      const unrelated = makeSplitDebtResponse({ id: 'sd-other', sourceTransactionId: 'tx-other' });

      server.use(http.get('*/api/debts', () => HttpResponse.json([debt1, debt2, unrelated])));

      const { result } = mountComposable();
      await flushPromises();

      expect(result.hasSplit.value).toBe(true);
      expect(result.participants.value).toHaveLength(2);
      expect(result.participants.value.map((p) => p.personName)).toEqual(['Олег', 'Анвар']);
    });

    it('hasSplit is false when no debts linked', async () => {
      server.use(http.get('*/api/debts', () => HttpResponse.json([])));

      const { result } = mountComposable();
      await flushPromises();

      expect(result.hasSplit.value).toBe(false);
      expect(result.participants.value).toHaveLength(0);
    });

    it('reloads when transactionId changes', async () => {
      const debt1 = makeSplitDebtResponse({
        id: 'sd-a',
        sourceTransactionId: 'tx-a',
        totalAmount: 10000,
        remainingAmount: 10000,
      });
      const debt2 = makeSplitDebtResponse({
        id: 'sd-b',
        sourceTransactionId: 'tx-b',
        totalAmount: 20000,
        remainingAmount: 20000,
      });

      server.use(http.get('*/api/debts', () => HttpResponse.json([debt1, debt2])));

      const { result, txId } = mountComposable({ transactionId: 'tx-a' });
      await flushPromises();

      expect(result.participants.value).toHaveLength(1);
      expect(result.participants.value[0].debtId).toBe('sd-a');

      txId.value = 'tx-b';
      await nextTick();
      await flushPromises();

      expect(result.participants.value).toHaveLength(1);
      expect(result.participants.value[0].debtId).toBe('sd-b');
    });
  });

  // ── Participant views ─────────────────────────────────────────────────

  describe('participant views', () => {
    it('marks participant as locked when has payments', async () => {
      const withPayments = makeSplitDebtResponse({
        id: 'sd-paid',
        totalAmount: 30000,
        remainingAmount: 20000, // paid 10000
      });

      server.use(http.get('*/api/debts', () => HttpResponse.json([withPayments])));

      const { result } = mountComposable();
      await flushPromises();

      const p = result.participants.value[0];
      expect(p.hasPayments).toBe(true);
      expect(p.isLocked).toBe(true);
      expect(p.paidAmount).toBe(10000);
    });

    it('marks participant as unlocked when no payments', async () => {
      const noPay = makeSplitDebtResponse({
        id: 'sd-nopay',
        totalAmount: 30000,
        remainingAmount: 30000,
      });

      server.use(http.get('*/api/debts', () => HttpResponse.json([noPay])));

      const { result } = mountComposable();
      await flushPromises();

      const p = result.participants.value[0];
      expect(p.hasPayments).toBe(false);
      expect(p.isLocked).toBe(false);
    });

    it('computes myShare as transaction amount minus participant amounts', async () => {
      const debt1 = makeSplitDebtResponse({
        id: 'sd-1',
        totalAmount: 30000,
        remainingAmount: 30000,
      });
      const debt2 = makeSplitDebtResponse({
        id: 'sd-2',
        totalAmount: 30000,
        remainingAmount: 30000,
      });

      server.use(http.get('*/api/debts', () => HttpResponse.json([debt1, debt2])));

      const { result } = mountComposable({ amount: 90000 });
      await flushPromises();

      // 90000 - 30000 - 30000 = 30000
      expect(result.myShare.value).toBe(30000);
    });
  });

  // ── Editing participants ──────────────────────────────────────────────

  describe('editing participants', () => {
    it('can update amount of unlocked participant', async () => {
      const debt = makeSplitDebtResponse({
        id: 'sd-1',
        totalAmount: 30000,
        remainingAmount: 30000,
      });
      server.use(http.get('*/api/debts', () => HttpResponse.json([debt])));

      const { result } = mountComposable();
      await flushPromises();

      result.updateParticipantAmount('sd-1', 40000);
      expect(result.participants.value[0].amount).toBe(40000);
    });

    it('cannot update amount of locked participant', async () => {
      const debt = makeSplitDebtResponse({
        id: 'sd-locked',
        totalAmount: 30000,
        remainingAmount: 20000,
      });
      server.use(http.get('*/api/debts', () => HttpResponse.json([debt])));

      const { result } = mountComposable();
      await flushPromises();

      result.updateParticipantAmount('sd-locked', 50000);
      expect(result.participants.value[0].amount).toBe(30000); // unchanged
    });

    it('can update name of unlocked participant', async () => {
      const debt = makeSplitDebtResponse({
        id: 'sd-1',
        personName: 'Олег',
        remainingAmount: 30000,
        totalAmount: 30000,
      });
      server.use(http.get('*/api/debts', () => HttpResponse.json([debt])));

      const { result } = mountComposable();
      await flushPromises();

      result.updateParticipantName('sd-1', 'Анвар');
      expect(result.participants.value[0].personName).toBe('Анвар');
    });

    it('ignores empty name update', async () => {
      const debt = makeSplitDebtResponse({
        id: 'sd-1',
        personName: 'Олег',
        remainingAmount: 30000,
        totalAmount: 30000,
      });
      server.use(http.get('*/api/debts', () => HttpResponse.json([debt])));

      const { result } = mountComposable();
      await flushPromises();

      result.updateParticipantName('sd-1', '   ');
      expect(result.participants.value[0].personName).toBe('Олег');
    });

    it('clamps negative amounts to 0', async () => {
      const debt = makeSplitDebtResponse({
        id: 'sd-1',
        totalAmount: 30000,
        remainingAmount: 30000,
      });
      server.use(http.get('*/api/debts', () => HttpResponse.json([debt])));

      const { result } = mountComposable();
      await flushPromises();

      result.updateParticipantAmount('sd-1', -5000);
      expect(result.participants.value[0].amount).toBe(0);
    });
  });

  // ── Add/remove participants ───────────────────────────────────────────

  describe('add/remove participants', () => {
    it('adds a new participant', async () => {
      server.use(http.get('*/api/debts', () => HttpResponse.json([])));

      const { result } = mountComposable();
      await flushPromises();

      result.addParticipant('Новый', 15000);

      expect(result.hasSplit.value).toBe(true);
      expect(result.participants.value).toHaveLength(1);
      expect(result.participants.value[0].personName).toBe('Новый');
      expect(result.participants.value[0].isNew).toBe(true);
    });

    it('ignores adding participant with empty name', async () => {
      server.use(http.get('*/api/debts', () => HttpResponse.json([])));

      const { result } = mountComposable();
      await flushPromises();

      result.addParticipant('', 15000);
      expect(result.participants.value).toHaveLength(0);
    });

    it('removes unlocked existing participant', async () => {
      const debt = makeSplitDebtResponse({
        id: 'sd-1',
        totalAmount: 30000,
        remainingAmount: 30000,
      });
      server.use(http.get('*/api/debts', () => HttpResponse.json([debt])));

      const { result } = mountComposable();
      await flushPromises();

      result.removeParticipant('sd-1');
      expect(result.participants.value).toHaveLength(0);
    });

    it('cannot remove locked participant', async () => {
      const debt = makeSplitDebtResponse({
        id: 'sd-locked',
        totalAmount: 30000,
        remainingAmount: 20000,
      });
      server.use(http.get('*/api/debts', () => HttpResponse.json([debt])));

      const { result } = mountComposable();
      await flushPromises();

      result.removeParticipant('sd-locked');
      expect(result.participants.value).toHaveLength(1); // still there
    });

    it('removes new participant', async () => {
      server.use(http.get('*/api/debts', () => HttpResponse.json([])));

      const { result } = mountComposable();
      await flushPromises();

      result.addParticipant('Тест', 10000);
      expect(result.participants.value).toHaveLength(1);

      const newId = result.participants.value[0].debtId;
      result.removeParticipant(newId);
      expect(result.participants.value).toHaveLength(0);
    });
  });

  // ── Amount redistribution ─────────────────────────────────────────────

  describe('handleTransactionAmountChange', () => {
    it('keep strategy: does not change participant amounts', async () => {
      const debt = makeSplitDebtResponse({
        id: 'sd-1',
        totalAmount: 30000,
        remainingAmount: 30000,
      });
      server.use(http.get('*/api/debts', () => HttpResponse.json([debt])));

      const { result, amount } = mountComposable({ amount: 90000 });
      await flushPromises();

      amount.value = 120000;
      result.handleTransactionAmountChange(120000, 'keep');

      expect(result.participants.value[0].amount).toBe(30000); // unchanged
      expect(result.myShare.value).toBe(90000); // absorbs difference
    });

    it('redistribute strategy: splits equally among unlocked + user', async () => {
      const unlocked = makeSplitDebtResponse({
        id: 'sd-1',
        totalAmount: 30000,
        remainingAmount: 30000,
      });
      server.use(http.get('*/api/debts', () => HttpResponse.json([unlocked])));

      const { result, amount } = mountComposable({ amount: 90000 });
      await flushPromises();

      amount.value = 120000;
      result.handleTransactionAmountChange(120000, 'redistribute');

      // 120000 / 2 (1 unlocked + user) = 60000 each
      expect(result.participants.value[0].amount).toBe(60000);
      expect(result.myShare.value).toBe(60000);
    });

    it('redistribute does not change locked participants', async () => {
      const locked = makeSplitDebtResponse({
        id: 'sd-locked',
        totalAmount: 30000,
        remainingAmount: 20000,
      }); // paid 10k
      const unlocked = makeSplitDebtResponse({
        id: 'sd-free',
        totalAmount: 30000,
        remainingAmount: 30000,
      });
      server.use(http.get('*/api/debts', () => HttpResponse.json([locked, unlocked])));

      const { result, amount } = mountComposable({ amount: 90000 });
      await flushPromises();

      amount.value = 120000;
      result.handleTransactionAmountChange(120000, 'redistribute');

      const lockedP = result.participants.value.find((p) => p.debtId === 'sd-locked');
      const unlockedP = result.participants.value.find((p) => p.debtId === 'sd-free');

      expect(lockedP!.amount).toBe(30000); // unchanged
      // available = 120000 - 30000(locked) = 90000, split among 2 (unlocked + user) = 45000
      expect(unlockedP!.amount).toBe(45000);
    });
  });

  // ── Save changes ──────────────────────────────────────────────────────

  describe('saveChanges', () => {
    it('deletes removed debts', async () => {
      const debt = makeSplitDebtResponse({
        id: 'sd-del',
        totalAmount: 30000,
        remainingAmount: 30000,
      });
      server.use(http.get('*/api/debts', () => HttpResponse.json([debt])));

      const deleteSpy = vi.fn();
      server.use(
        http.delete('*/api/debts/:id', ({ params }) => {
          deleteSpy(params.id);
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const { result } = mountComposable();
      await flushPromises();

      result.removeParticipant('sd-del');
      const success = await result.saveChanges();
      await flushPromises();

      expect(success).toBe(true);
      expect(deleteSpy).toHaveBeenCalledWith('sd-del');
    });

    it('updates modified debts', async () => {
      const debt = makeSplitDebtResponse({
        id: 'sd-upd',
        totalAmount: 30000,
        remainingAmount: 30000,
      });
      server.use(http.get('*/api/debts', () => HttpResponse.json([debt])));

      let patchBody: Record<string, unknown> = {};
      server.use(
        http.patch('*/api/debts/:id', async ({ request }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...debt, ...patchBody });
        }),
      );

      const { result } = mountComposable();
      await flushPromises();

      result.updateParticipantAmount('sd-upd', 45000);
      await result.saveChanges();
      await flushPromises();

      expect(patchBody).toHaveProperty('totalAmount', 45000);
      expect(patchBody).toHaveProperty('remainingAmount', 45000);
    });

    it('creates new debts', async () => {
      const existingDebt = makeSplitDebtResponse({
        id: 'sd-exist',
        totalAmount: 30000,
        remainingAmount: 30000,
      });
      server.use(http.get('*/api/debts', () => HttpResponse.json([existingDebt])));

      let postBody: Record<string, unknown> = {};
      server.use(
        http.post('*/api/debts', async ({ request }) => {
          postBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...postBody, id: 'new-debt-1' });
        }),
      );

      const { result } = mountComposable();
      await flushPromises();

      result.addParticipant('Новый', 20000);
      await result.saveChanges();
      await flushPromises();

      expect(postBody).toHaveProperty('personName', 'Новый');
      expect(postBody).toHaveProperty('totalAmount', 20000);
      expect(postBody).toHaveProperty('sourceTransactionId', 'tx-split-1');
    });

    it('skips creating debts with zero amount', async () => {
      server.use(http.get('*/api/debts', () => HttpResponse.json([])));

      const postSpy = vi.fn();
      server.use(
        http.post('*/api/debts', () => {
          postSpy();
          return HttpResponse.json({});
        }),
      );

      const { result } = mountComposable();
      await flushPromises();

      result.addParticipant('Пустой', 0);
      await result.saveChanges();
      await flushPromises();

      expect(postSpy).not.toHaveBeenCalled();
    });

    it('shows error toast on failure', async () => {
      const debt = makeSplitDebtResponse({
        id: 'sd-fail',
        totalAmount: 30000,
        remainingAmount: 30000,
      });
      server.use(http.get('*/api/debts', () => HttpResponse.json([debt])));
      server.use(http.patch('*/api/debts/:id', () => HttpResponse.json({}, { status: 500 })));

      const { result } = mountComposable();
      await flushPromises();

      result.updateParticipantAmount('sd-fail', 50000);
      const success = await result.saveChanges();
      await flushPromises();

      expect(success).toBe(false);
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    });
  });
});
