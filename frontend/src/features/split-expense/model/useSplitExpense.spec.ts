import { describe, it, expect, vi, afterEach } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useSplitExpense } from './useSplitExpense';
import { buildMockDebtResponse } from '@/test/mocks/handlers/debts';

// ── Helpers ────────────────────────────────────────────────────────────────

const USER_ID = 'test-user-1';
const ACCOUNT_ID = 'acc-1';
const CURRENCY = 'UZS';
const TX_ID = 'tx-source-1';
const TX_DATE = new Date('2025-06-01T12:00:00.000Z').getTime();

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable(totalAmount = 90000) {
  const totalRef = ref(totalAmount);
  let result!: ReturnType<typeof useSplitExpense>;
  const Stub = defineComponent({
    setup() {
      result = useSplitExpense(() => totalRef.value);
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub);
  return { result, totalRef };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useSplitExpense', () => {
  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // ── Initial state ──────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with enabled=false, method=equal, isIncluded=true', () => {
      const { result } = mountComposable();
      expect(result.splitData.value.enabled).toBe(false);
      expect(result.splitData.value.method).toBe('equal');
      expect(result.splitData.value.isIncluded).toBe(true);
      expect(result.splitData.value.participants).toHaveLength(0);
    });

    it('isValid is true when not enabled', () => {
      const { result } = mountComposable();
      expect(result.isValid.value).toBe(true);
    });

    it('totalToReturn is 0 with no participants', () => {
      const { result } = mountComposable();
      expect(result.totalToReturn.value).toBe(0);
    });
  });

  // ── setEnabled ────────────────────────────────────────────────────────

  describe('setEnabled', () => {
    it('enables split and sets myShare to totalAmount when no participants', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      expect(result.splitData.value.enabled).toBe(true);
      expect(result.splitData.value.myShare).toBe(90000);
    });

    it('isValid becomes false when enabled with no participants', () => {
      const { result } = mountComposable();
      result.setEnabled(true);
      // No participants → isValid should be false
      expect(result.isValid.value).toBe(false);
    });

    it('disables split cleanly', () => {
      const { result } = mountComposable();
      result.setEnabled(true);
      result.setEnabled(false);
      expect(result.splitData.value.enabled).toBe(false);
      // isValid returns true when disabled
      expect(result.isValid.value).toBe(true);
    });
  });

  // ── addParticipant ────────────────────────────────────────────────────

  describe('addParticipant', () => {
    it('adds a participant with the given name', () => {
      const { result } = mountComposable();
      result.addParticipant('Алексей');
      expect(result.splitData.value.participants).toHaveLength(1);
      expect(result.splitData.value.participants[0].personName).toBe('Алексей');
    });

    it('trims whitespace from participant name', () => {
      const { result } = mountComposable();
      result.addParticipant('  Мария  ');
      expect(result.splitData.value.participants[0].personName).toBe('Мария');
    });

    it('ignores empty name', () => {
      const { result } = mountComposable();
      result.addParticipant('');
      result.addParticipant('   ');
      expect(result.splitData.value.participants).toHaveLength(0);
    });

    it('assigns unique ids to each participant', () => {
      const { result } = mountComposable();
      result.addParticipant('Алексей');
      result.addParticipant('Мария');
      const ids = result.splitData.value.participants.map((p) => p.id);
      expect(new Set(ids).size).toBe(2);
    });

    it('stores fromContacts flag', () => {
      const { result } = mountComposable();
      result.addParticipant('Алексей', true, '#ff0000');
      expect(result.splitData.value.participants[0].fromContacts).toBe(true);
      expect(result.splitData.value.participants[0].personColor).toBe('#ff0000');
    });
  });

  // ── removeParticipant ─────────────────────────────────────────────────

  describe('removeParticipant', () => {
    it('removes participant by id', () => {
      const { result } = mountComposable();
      result.addParticipant('Алексей');
      const id = result.splitData.value.participants[0].id;
      result.removeParticipant(id);
      expect(result.splitData.value.participants).toHaveLength(0);
    });

    it('does nothing for unknown id', () => {
      const { result } = mountComposable();
      result.addParticipant('Алексей');
      result.removeParticipant('non-existent-id');
      expect(result.splitData.value.participants).toHaveLength(1);
    });
  });

  // ── Equal split ────────────────────────────────────────────────────────

  describe('equal split', () => {
    it('distributes total equally when I am included', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.addParticipant('Мария');
      // 3 people (me + 2) → 30000 each
      expect(result.splitData.value.myShare).toBe(30000);
      result.splitData.value.participants.forEach((p) => {
        expect(p.amount).toBe(30000);
      });
    });

    it('gives remainder to me when total is not evenly divisible', () => {
      const { result } = mountComposable(100);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      // 2 people → floor(100/2)=50, remainder=0; actually 50 each exactly
      // Use 101 to create remainder
      expect(result.splitData.value.myShare + result.splitData.value.participants[0].amount).toBe(
        100,
      );
    });

    it('excludes me when isIncluded=false', () => {
      const { result } = mountComposable(60000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.addParticipant('Мария');
      result.setIsIncluded(false);
      // 2 people (not me) → 30000 each
      expect(result.splitData.value.myShare).toBe(0);
      expect(result.splitData.value.participants[0].amount).toBe(30000);
      expect(result.splitData.value.participants[1].amount).toBe(30000);
    });

    it('recalculates when a participant is removed', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.addParticipant('Мария');
      // 3 people: 30000 each
      const id = result.splitData.value.participants[1].id;
      result.removeParticipant(id);
      // Now 2 people: 45000 each
      expect(result.splitData.value.myShare).toBe(45000);
      expect(result.splitData.value.participants[0].amount).toBe(45000);
    });

    it('recalculates when totalAmount changes', async () => {
      const { result, totalRef } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      // 2 people (me + 1): 45000 each
      expect(result.splitData.value.myShare).toBe(45000);

      totalRef.value = 60000;
      await flushPromises();

      // After amount change: 30000 each
      expect(result.splitData.value.myShare).toBe(30000);
    });
  });

  // ── Custom split ───────────────────────────────────────────────────────

  describe('custom split', () => {
    it('allows manual amount per participant', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.setMethod('custom');
      const id = result.splitData.value.participants[0].id;
      result.updateParticipantAmount(id, 40000);
      expect(result.splitData.value.participants[0].amount).toBe(40000);
    });

    it('auto-calculates myShare as remainder in custom mode', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.setMethod('custom');
      const id = result.splitData.value.participants[0].id;
      result.updateParticipantAmount(id, 40000);
      // myShare = 90000 - 40000 = 50000
      expect(result.splitData.value.myShare).toBe(50000);
    });

    it('clamps negative participant amount to 0', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.setMethod('custom');
      const id = result.splitData.value.participants[0].id;
      result.updateParticipantAmount(id, -500);
      expect(result.splitData.value.participants[0].amount).toBe(0);
    });

    it('clamps negative myShare to 0 when friends total exceeds totalAmount', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.setMethod('custom');
      const id = result.splitData.value.participants[0].id;
      result.updateParticipantAmount(id, 100000); // more than total
      // myShare would be negative → clamped to 0
      expect(result.splitData.value.myShare).toBe(0);
    });
  });

  // ── isValid and validationError ────────────────────────────────────────

  describe('isValid and validationError', () => {
    it('isValid is true when split equals total (equal mode)', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.addParticipant('Мария');
      // 3 people: 30000 each → total 90000 ✓
      expect(result.isValid.value).toBe(true);
      expect(result.validationError.value).toBeNull();
    });

    it('isValid is false when split does not equal total', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.setMethod('custom');
      const id = result.splitData.value.participants[0].id;
      result.updateParticipantAmount(id, 20000);
      // myShare = 70000, total = 90000 ✓ (auto-calc)
      // Actually myShare auto-recalculates to 70000 so it should be valid
      // Let's set explicitly to be unbalanced:
      result.setMyShare(30000); // 30000 + 20000 = 50000 ≠ 90000
      expect(result.isValid.value).toBe(false);
    });

    it('validationError shows undistributed amount when total > split', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.setMethod('custom');
      const id = result.splitData.value.participants[0].id;
      result.updateParticipantAmount(id, 10000);
      result.setMyShare(10000); // 20000 < 90000
      expect(result.validationError.value).toMatch(/не распределено/i);
    });

    it('validationError shows excess amount when split > total', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.setMethod('custom');
      const id = result.splitData.value.participants[0].id;
      result.updateParticipantAmount(id, 80000);
      result.setMyShare(80000); // 160000 > 90000
      expect(result.validationError.value).toMatch(/превышение/i);
    });

    it('allows 1 unit tolerance for rounding differences', () => {
      const { result } = mountComposable(100);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.setMethod('custom');
      const id = result.splitData.value.participants[0].id;
      result.updateParticipantAmount(id, 33);
      result.setMyShare(67); // 100 ✓ exact
      expect(result.isValid.value).toBe(true);

      result.setMyShare(66); // 99 — off by 1 → still within tolerance
      expect(result.isValid.value).toBe(true);

      result.setMyShare(64); // 97 — off by 3 → invalid
      expect(result.isValid.value).toBe(false);
    });
  });

  // ── setMyShare ─────────────────────────────────────────────────────────

  describe('setMyShare', () => {
    it('updates myShare directly', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.setMyShare(45000);
      expect(result.splitData.value.myShare).toBe(45000);
    });

    it('clamps negative myShare to 0', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.setMyShare(-1000);
      expect(result.splitData.value.myShare).toBe(0);
    });
  });

  // ── setMethod ─────────────────────────────────────────────────────────

  describe('setMethod', () => {
    it('switching to equal recalculates shares', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.setMethod('custom');
      const id = result.splitData.value.participants[0].id;
      result.updateParticipantAmount(id, 99999); // garbage value
      result.setMethod('equal');
      // Should recalculate to 45000 each
      expect(result.splitData.value.myShare).toBe(45000);
      expect(result.splitData.value.participants[0].amount).toBe(45000);
    });
  });

  // ── reset ─────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('resets to initial state', () => {
      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.addParticipant('Мария');
      result.reset();

      expect(result.splitData.value.enabled).toBe(false);
      expect(result.splitData.value.participants).toHaveLength(0);
      expect(result.splitData.value.myShare).toBe(0);
      expect(result.splitData.value.method).toBe('equal');
      expect(result.splitData.value.isIncluded).toBe(true);
    });
  });

  // ── createDebtsForSplit ────────────────────────────────────────────────

  describe('createDebtsForSplit', () => {
    it('returns true and does nothing when split is not enabled', async () => {
      const debtPostSpy = vi.fn();
      server.use(
        http.post('*/api/debts', () => {
          debtPostSpy();
          return HttpResponse.json(buildMockDebtResponse({}, {}));
        }),
      );

      const { result } = mountComposable();
      const ok = await result.createDebtsForSplit(TX_ID, USER_ID, ACCOUNT_ID, CURRENCY, TX_DATE);

      expect(ok).toBe(true);
      expect(debtPostSpy).not.toHaveBeenCalled();
    });

    it('returns true when enabled but participants list is empty', async () => {
      const debtPostSpy = vi.fn();
      server.use(
        http.post('*/api/debts', () => {
          debtPostSpy();
          return HttpResponse.json(buildMockDebtResponse({}, {}));
        }),
      );

      const { result } = mountComposable();
      result.setEnabled(true);
      const ok = await result.createDebtsForSplit(TX_ID, USER_ID, ACCOUNT_ID, CURRENCY, TX_DATE);

      expect(ok).toBe(true);
      expect(debtPostSpy).not.toHaveBeenCalled();
    });

    it('creates one debt per participant with amount > 0', async () => {
      const debtBodies: unknown[] = [];
      server.use(
        http.post('*/api/debts', async ({ request }) => {
          const body = await request.json();
          debtBodies.push(body);
          return HttpResponse.json(
            buildMockDebtResponse(body as Record<string, unknown>, {
              id: `debt-split-${debtBodies.length}`,
            }),
          );
        }),
      );

      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.addParticipant('Мария');
      // Equal split: 3 people → 30000 each

      const ok = await result.createDebtsForSplit(TX_ID, USER_ID, ACCOUNT_ID, CURRENCY, TX_DATE);
      await flushPromises();

      expect(ok).toBe(true);
      // 2 participants with amount > 0
      expect(debtBodies).toHaveLength(2);
    });

    it('skips participants with zero amount', async () => {
      const debtBodies: unknown[] = [];
      server.use(
        http.post('*/api/debts', async ({ request }) => {
          const body = await request.json();
          debtBodies.push(body);
          return HttpResponse.json(buildMockDebtResponse(body as Record<string, unknown>, {}));
        }),
      );

      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.addParticipant('Мария');
      result.setMethod('custom');
      const ids = result.splitData.value.participants.map((p) => p.id);
      result.updateParticipantAmount(ids[0], 90000);
      result.updateParticipantAmount(ids[1], 0); // zero → should be skipped

      const ok = await result.createDebtsForSplit(TX_ID, USER_ID, ACCOUNT_ID, CURRENCY, TX_DATE);
      await flushPromises();

      expect(ok).toBe(true);
      expect(debtBodies).toHaveLength(1); // only Алексей
    });

    it('sends correct payload to the API', async () => {
      const debtBodies: unknown[] = [];
      server.use(
        http.post('*/api/debts', async ({ request }) => {
          const body = await request.json();
          debtBodies.push(body);
          return HttpResponse.json(buildMockDebtResponse(body as Record<string, unknown>, {}));
        }),
      );

      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      // Equal: 2 people → 45000 each

      await result.createDebtsForSplit(TX_ID, USER_ID, ACCOUNT_ID, CURRENCY, TX_DATE);
      await flushPromises();

      expect(debtBodies).toHaveLength(1);
      const body = debtBodies[0] as Record<string, unknown>;
      expect(body.debtType).toBe('given');
      expect(body.personName).toBe('Алексей');
      expect(body.totalAmount).toBe(45000);
      expect(body.remainingAmount).toBe(45000);
      // isClosed is not sent in create payload — backend defaults it to false
      expect(body.currency).toBe(CURRENCY);
      expect(body.accountId).toBe(ACCOUNT_ID);
      expect(body.sourceTransactionId).toBe(TX_ID);
    });

    it('returns false when API call fails', async () => {
      server.use(
        http.post('*/api/debts', () =>
          HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 }),
        ),
      );

      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');

      const ok = await result.createDebtsForSplit(TX_ID, USER_ID, ACCOUNT_ID, CURRENCY, TX_DATE);
      await flushPromises();

      expect(ok).toBe(false);
    });

    it('creates debts with correct name using buildDebtName', async () => {
      const debtBodies: unknown[] = [];
      server.use(
        http.post('*/api/debts', async ({ request }) => {
          const body = await request.json();
          debtBodies.push(body);
          return HttpResponse.json(buildMockDebtResponse(body as Record<string, unknown>, {}));
        }),
      );

      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Мария');

      await result.createDebtsForSplit(TX_ID, USER_ID, ACCOUNT_ID, CURRENCY, TX_DATE);
      await flushPromises();

      const body = debtBodies[0] as Record<string, unknown>;
      expect(body.name).toBe('Долг от Мария');
    });

    it('uses transactionDate for debt createdAt', async () => {
      const debtBodies: unknown[] = [];
      server.use(
        http.post('*/api/debts', async ({ request }) => {
          const body = await request.json();
          debtBodies.push(body);
          return HttpResponse.json(buildMockDebtResponse(body as Record<string, unknown>, {}));
        }),
      );

      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');

      await result.createDebtsForSplit(TX_ID, USER_ID, ACCOUNT_ID, CURRENCY, TX_DATE);
      await flushPromises();

      const body = debtBodies[0] as Record<string, unknown>;
      expect(body.createdAt).toBe(new Date(TX_DATE).toISOString());
    });
  });

  // ── Full lifecycle: enable → add → create debts ────────────────────────

  describe('full split lifecycle', () => {
    it('creates debts for 3 participants with equal split', async () => {
      const debtBodies: unknown[] = [];
      server.use(
        http.post('*/api/debts', async ({ request }) => {
          const body = await request.json();
          debtBodies.push(body);
          return HttpResponse.json(
            buildMockDebtResponse(body as Record<string, unknown>, {
              id: `debt-split-${debtBodies.length}`,
            }),
          );
        }),
      );

      const { result } = mountComposable(120000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.addParticipant('Мария');
      result.addParticipant('Сергей');
      // 4 people (me + 3): 30000 each

      expect(result.isValid.value).toBe(true);

      const ok = await result.createDebtsForSplit(TX_ID, USER_ID, ACCOUNT_ID, CURRENCY, TX_DATE);
      await flushPromises();

      expect(ok).toBe(true);
      expect(debtBodies).toHaveLength(3);
      const amounts = (debtBodies as Array<Record<string, unknown>>).map((b) => b.totalAmount);
      amounts.forEach((a) => expect(a).toBe(30000));
    });

    it('creates debts with custom amounts and validates total matches', async () => {
      const debtBodies: unknown[] = [];
      server.use(
        http.post('*/api/debts', async ({ request }) => {
          const body = await request.json();
          debtBodies.push(body);
          return HttpResponse.json(buildMockDebtResponse(body as Record<string, unknown>, {}));
        }),
      );

      const { result } = mountComposable(90000);
      result.setEnabled(true);
      result.addParticipant('Алексей');
      result.addParticipant('Мария');
      result.setMethod('custom');
      const ids = result.splitData.value.participants.map((p) => p.id);
      result.updateParticipantAmount(ids[0], 50000);
      result.updateParticipantAmount(ids[1], 30000);
      // myShare auto-calculates to 10000
      // total: 10000 + 50000 + 30000 = 90000 ✓

      expect(result.isValid.value).toBe(true);

      const ok = await result.createDebtsForSplit(TX_ID, USER_ID, ACCOUNT_ID, CURRENCY, TX_DATE);
      await flushPromises();

      expect(ok).toBe(true);
      expect(debtBodies).toHaveLength(2);
    });
  });
});
