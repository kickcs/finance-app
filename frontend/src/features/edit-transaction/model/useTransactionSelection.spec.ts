import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { useTransactionSelection } from './useTransactionSelection';
import type { Transaction } from '@/shared/api/database.types';

// ── Helpers ────────────────────────────────────────────────────────────────

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable() {
  let result!: ReturnType<typeof useTransactionSelection>;
  const Stub = defineComponent({
    setup() {
      result = useTransactionSelection();
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
  });

  // ── select ────────────────────────────────────────────────────────────────

  describe('select', () => {
    it('sets selectedTransaction', () => {
      const c = mountComposable();
      const tx = makeTx({ id: 'tx-abc' });

      c.select(tx);

      expect(c.selectedTransaction.value?.id).toBe('tx-abc');
    });

    it('opens edit modal after selecting', () => {
      const c = mountComposable();
      const tx = makeTx();

      c.select(tx);

      expect(c.showEditModal.value).toBe(true);
    });
  });

  // ── close ─────────────────────────────────────────────────────────────────

  describe('close', () => {
    it('closes the edit modal', () => {
      const c = mountComposable();
      c.select(makeTx());
      expect(c.showEditModal.value).toBe(true);

      c.close();
      expect(c.showEditModal.value).toBe(false);
    });

    it('keeps selectedTransaction after closing (used for delete modal)', () => {
      const c = mountComposable();
      const tx = makeTx({ id: 'tx-keep' });
      c.select(tx);

      c.close();

      expect(c.selectedTransaction.value?.id).toBe('tx-keep');
    });
  });
});
