import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useSmartDefaults } from './useSmartDefaults';
import type { Transaction } from '@/shared/api/database.types';

// ---------------------------------------------------------------------------
// useSmartDefaults — pure unit tests
// ---------------------------------------------------------------------------

function makeTx(
  overrides: Partial<Pick<Transaction, 'type' | 'account_id' | 'category_id'>>,
): Transaction {
  return {
    id: `tx-${Math.random()}`,
    user_id: 'user-1',
    account_id: 'acc-1',
    category_id: 'cat-groceries',
    amount: 1000,
    currency: 'UZS',
    type: 'expense',
    description: null,
    date: '2025-01-01T00:00:00.000Z',
    created_at: '2025-01-01T00:00:00.000Z',
    is_debt_related: false,
    debt_id: null,
    to_account_id: null,
    to_amount: null,
    to_currency: null,
    returned_amount: 0,
    net_amount: 1000,
    has_debt_returns: false,
    ...overrides,
  };
}

/** Build an array of identical transactions (repeated to hit the >=5 threshold) */
function repeat(tx: Partial<Pick<Transaction, 'type' | 'account_id' | 'category_id'>>, n: number) {
  return Array.from({ length: n }, () => makeTx(tx));
}

describe('useSmartDefaults', () => {
  // ── Threshold: fewer than 5 transactions → EMPTY ─────────────────────────

  describe('less than 5 transactions', () => {
    it('returns nulls when there are 0 transactions', () => {
      const { defaults } = useSmartDefaults(ref([]), ref('expense'));
      expect(defaults.value.defaultCategoryId).toBeNull();
      expect(defaults.value.defaultAccountId).toBeNull();
    });

    it('returns nulls when there are 4 transactions', () => {
      const txs = repeat({ type: 'expense', category_id: 'cat-a', account_id: 'acc-1' }, 4);
      const { defaults } = useSmartDefaults(ref(txs), ref('expense'));
      expect(defaults.value.defaultCategoryId).toBeNull();
    });

    it('activates when there are exactly 5 transactions', () => {
      const txs = repeat({ type: 'expense', category_id: 'cat-a', account_id: 'acc-1' }, 5);
      const { defaults } = useSmartDefaults(ref(txs), ref('expense'));
      expect(defaults.value.defaultCategoryId).toBe('cat-a');
    });
  });

  // ── Expense type: most frequent (category, account) pair ─────────────────

  describe('expense type — no pre-selected account', () => {
    it('picks the most frequent (category, account) pair', () => {
      const txs = [
        ...repeat({ type: 'expense', category_id: 'cat-food', account_id: 'acc-1' }, 3),
        ...repeat({ type: 'expense', category_id: 'cat-transport', account_id: 'acc-2' }, 2),
      ];
      const { defaults } = useSmartDefaults(ref(txs), ref('expense'));
      expect(defaults.value.defaultCategoryId).toBe('cat-food');
      expect(defaults.value.defaultAccountId).toBe('acc-1');
    });

    it('ignores income transactions when type is expense', () => {
      const txs = [
        ...repeat({ type: 'income', category_id: 'cat-salary', account_id: 'acc-1' }, 5),
        ...repeat({ type: 'expense', category_id: 'cat-food', account_id: 'acc-2' }, 5),
      ];
      const { defaults } = useSmartDefaults(ref(txs), ref('expense'));
      expect(defaults.value.defaultCategoryId).toBe('cat-food');
      expect(defaults.value.defaultAccountId).toBe('acc-2');
    });
  });

  // ── Expense type: pre-selected account ───────────────────────────────────

  describe('expense type — with pre-selected account', () => {
    it('uses most frequent category for the pre-selected account only', () => {
      const txs = [
        ...repeat({ type: 'expense', category_id: 'cat-food', account_id: 'acc-1' }, 4),
        ...repeat({ type: 'expense', category_id: 'cat-transport', account_id: 'acc-1' }, 2),
        ...repeat({ type: 'expense', category_id: 'cat-other', account_id: 'acc-2' }, 5),
      ];
      const { defaults } = useSmartDefaults(ref(txs), ref('expense'), ref('acc-1'));
      expect(defaults.value.defaultCategoryId).toBe('cat-food');
      // accountId should not be suggested — account is already chosen externally
      expect(defaults.value.defaultAccountId).toBeNull();
    });

    it('falls back to pair-based logic when pre-selected account has no history', () => {
      const txs = [...repeat({ type: 'expense', category_id: 'cat-food', account_id: 'acc-2' }, 5)];
      const { defaults } = useSmartDefaults(ref(txs), ref('expense'), ref('acc-1'));
      // acc-1 has no history → falls through to pair logic, suggesting acc-2
      expect(defaults.value.defaultCategoryId).toBe('cat-food');
      expect(defaults.value.defaultAccountId).toBe('acc-2');
    });
  });

  // ── Transfer type ─────────────────────────────────────────────────────────

  describe('transfer type', () => {
    it('returns defaultAccountId based on most frequent from-account, no category', () => {
      const txs = [
        ...repeat({ type: 'transfer', account_id: 'acc-1' }, 4),
        ...repeat({ type: 'transfer', account_id: 'acc-2' }, 2),
      ];
      const { defaults } = useSmartDefaults(ref(txs), ref('transfer'));
      expect(defaults.value.defaultCategoryId).toBeNull();
      expect(defaults.value.defaultAccountId).toBe('acc-1');
    });
  });

  // ── Income type ───────────────────────────────────────────────────────────

  describe('income type', () => {
    it('returns correct defaults for income transactions', () => {
      const txs = [
        ...repeat({ type: 'income', category_id: 'cat-salary', account_id: 'acc-1' }, 5),
        ...repeat({ type: 'income', category_id: 'cat-freelance', account_id: 'acc-2' }, 2),
      ];
      const { defaults } = useSmartDefaults(ref(txs), ref('income'));
      expect(defaults.value.defaultCategoryId).toBe('cat-salary');
      expect(defaults.value.defaultAccountId).toBe('acc-1');
    });
  });

  // ── Reactivity ────────────────────────────────────────────────────────────

  describe('reactivity', () => {
    it('recomputes when transactions ref changes', () => {
      const txsRef = ref<Transaction[]>([]);
      const { defaults } = useSmartDefaults(txsRef, ref('expense'));

      expect(defaults.value.defaultCategoryId).toBeNull();

      txsRef.value = repeat({ type: 'expense', category_id: 'cat-food', account_id: 'acc-1' }, 5);
      expect(defaults.value.defaultCategoryId).toBe('cat-food');
    });

    it('recomputes when type ref changes', () => {
      const typeRef = ref<'expense' | 'income' | 'transfer'>('expense');
      const txs = [
        ...repeat({ type: 'expense', category_id: 'cat-food', account_id: 'acc-1' }, 5),
        ...repeat({ type: 'income', category_id: 'cat-salary', account_id: 'acc-2' }, 5),
      ];
      const { defaults } = useSmartDefaults(ref(txs), typeRef);

      expect(defaults.value.defaultCategoryId).toBe('cat-food');

      typeRef.value = 'income';
      expect(defaults.value.defaultCategoryId).toBe('cat-salary');
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns EMPTY when no transactions match the type', () => {
      const txs = repeat({ type: 'income', category_id: 'cat-salary', account_id: 'acc-1' }, 5);
      const { defaults } = useSmartDefaults(ref(txs), ref('expense'));
      expect(defaults.value.defaultCategoryId).toBeNull();
      expect(defaults.value.defaultAccountId).toBeNull();
    });

    it('handles undefined transactions gracefully', () => {
      const { defaults } = useSmartDefaults(ref(undefined), ref('expense'));
      expect(defaults.value.defaultCategoryId).toBeNull();
    });
  });
});
