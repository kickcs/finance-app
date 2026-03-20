import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useTransactionSelection } from './useTransactionSelection';
import { mockGivenDebtResponse } from '@/test/mocks/handlers/debts';
import type { Transaction } from '@/shared/api/database.types';

// ── Helpers ────────────────────────────────────────────────────────────────

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable() {
  let result!: ReturnType<typeof useTransactionSelection>;
  const Stub = defineComponent({
    setup() {
      result = useTransactionSelection(mockUser.id);
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub, { provideAuth: { user: mockUser } });
  return result;
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    user_id: mockUser.id,
    account_id: 'acc-1',
    category_id: 'cat-groceries',
    amount: 25000,
    currency: 'UZS',
    type: 'expense',
    description: null,
    date: '2025-06-01T00:00:00.000Z',
    created_at: '2025-06-01T12:00:00.000Z',
    is_debt_related: false,
    debt_id: null,
    to_account_id: null,
    to_amount: null,
    to_currency: null,
    returned_amount: 0,
    net_amount: 25000,
    has_debt_returns: false,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useTransactionSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with no selected transaction', () => {
      const c = mountComposable();
      expect(c.selectedTransaction.value).toBeNull();
    });

    it('starts with showEditModal = false', () => {
      const c = mountComposable();
      expect(c.showEditModal.value).toBe(false);
    });

    it('starts with hasSplitDebts = false', () => {
      const c = mountComposable();
      expect(c.hasSplitDebts.value).toBe(false);
    });
  });

  // ── select ────────────────────────────────────────────────────────────────

  describe('select', () => {
    it('sets selectedTransaction', async () => {
      const c = mountComposable();
      const tx = makeTx({ id: 'tx-abc' });

      await c.select(tx);

      expect(c.selectedTransaction.value?.id).toBe('tx-abc');
    });

    it('opens edit modal after selecting', async () => {
      const c = mountComposable();
      const tx = makeTx();

      await c.select(tx);

      expect(c.showEditModal.value).toBe(true);
    });

    it('sets hasSplitDebts = false when no open linked debts', async () => {
      server.use(http.get('*/api/debts', () => HttpResponse.json([])));

      const c = mountComposable();
      const tx = makeTx({ id: 'tx-clean' });

      await c.select(tx);
      await flushPromises();

      expect(c.hasSplitDebts.value).toBe(false);
    });

    it('sets hasSplitDebts = true when open split debt exists for this transaction', async () => {
      server.use(
        http.get('*/api/debts', () =>
          // Backend returns camelCase — debtsApi.getAll() transforms to snake_case
          HttpResponse.json([
            {
              ...mockGivenDebtResponse,
              sourceTransactionId: 'tx-split',
              isClosed: false,
            },
          ]),
        ),
      );

      const c = mountComposable();
      const tx = makeTx({ id: 'tx-split' });

      await c.select(tx);
      await flushPromises();

      expect(c.hasSplitDebts.value).toBe(true);
    });

    it('does NOT set hasSplitDebts when debt is closed', async () => {
      server.use(
        http.get('*/api/debts', () =>
          // Backend returns camelCase — debtsApi.getAll() transforms to snake_case
          HttpResponse.json([
            {
              ...mockGivenDebtResponse,
              sourceTransactionId: 'tx-closed-split',
              isClosed: true,
            },
          ]),
        ),
      );

      const c = mountComposable();
      const tx = makeTx({ id: 'tx-closed-split' });

      await c.select(tx);
      await flushPromises();

      expect(c.hasSplitDebts.value).toBe(false);
    });

    it('skips debt check for debt-related transactions', async () => {
      const debtsSpy = vi.fn();
      server.use(
        http.get('*/api/debts', () => {
          debtsSpy();
          return HttpResponse.json([]);
        }),
      );

      const c = mountComposable();
      const tx = makeTx({ is_debt_related: true });

      await c.select(tx);
      await flushPromises();

      expect(debtsSpy).not.toHaveBeenCalled();
      expect(c.hasSplitDebts.value).toBe(false);
    });

    it('resets hasSplitDebts when selecting a different transaction', async () => {
      server.use(
        http.get('*/api/debts', () =>
          // Backend returns camelCase — debtsApi.getAll() transforms to snake_case
          HttpResponse.json([
            {
              ...mockGivenDebtResponse,
              sourceTransactionId: 'tx-has-split',
              isClosed: false,
            },
          ]),
        ),
      );

      const c = mountComposable();
      await c.select(makeTx({ id: 'tx-has-split' }));
      await flushPromises();

      expect(c.hasSplitDebts.value).toBe(true);

      // Now select a different tx — hasSplitDebts resets to false first
      server.use(http.get('*/api/debts', () => HttpResponse.json([])));
      await c.select(makeTx({ id: 'tx-clean' }));
      await flushPromises();

      expect(c.hasSplitDebts.value).toBe(false);
    });

    it('gracefully handles debt API errors (hasSplitDebts stays false)', async () => {
      server.use(
        http.get('*/api/debts', () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      const tx = makeTx();

      await c.select(tx);
      await flushPromises();

      expect(c.hasSplitDebts.value).toBe(false);
      expect(c.showEditModal.value).toBe(true); // modal still opens
    });
  });

  // ── close ─────────────────────────────────────────────────────────────────

  describe('close', () => {
    it('closes the edit modal', async () => {
      const c = mountComposable();
      await c.select(makeTx());
      expect(c.showEditModal.value).toBe(true);

      c.close();
      expect(c.showEditModal.value).toBe(false);
    });

    it('keeps selectedTransaction after closing (used for delete modal)', async () => {
      const c = mountComposable();
      const tx = makeTx({ id: 'tx-keep' });
      await c.select(tx);

      c.close();

      expect(c.selectedTransaction.value?.id).toBe('tx-keep');
    });
  });
});
