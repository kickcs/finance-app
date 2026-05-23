import { describe, it, expect, beforeEach } from 'vitest';
import { useSearch } from './useSearch';
import type { Transaction } from '@/entities/transaction';

// ---------------------------------------------------------------------------
// Sample transactions
// ---------------------------------------------------------------------------

const sampleTransactions: Transaction[] = [
  {
    id: 'tx-1',
    account_id: 'acc-1',
    category_id: 'groceries',
    amount: 25000,
    currency: 'UZS',
    type: 'expense',
    description: 'Магазин Корзина',
    date: '2025-06-01T00:00:00.000Z',
    created_at: '2025-06-01T12:00:00.000Z',
    is_debt_related: false,
    is_informational: false,
    debt_id: null,
    to_account_id: null,
    to_amount: null,
    to_currency: null,
    returned_amount: 0,
    net_amount: 25000,
    has_debt_returns: false,
    user_id: 'test-user-1',
  },
  {
    id: 'tx-2',
    account_id: 'acc-1',
    category_id: 'transport',
    amount: 5000,
    currency: 'UZS',
    type: 'expense',
    description: null,
    date: '2025-06-02T00:00:00.000Z',
    created_at: '2025-06-02T10:00:00.000Z',
    is_debt_related: false,
    is_informational: false,
    debt_id: null,
    to_account_id: null,
    to_amount: null,
    to_currency: null,
    returned_amount: 0,
    net_amount: 5000,
    has_debt_returns: false,
    user_id: 'test-user-1',
  },
  {
    id: 'tx-3',
    account_id: 'acc-1',
    category_id: 'salary',
    amount: 100000,
    currency: 'UZS',
    type: 'income',
    description: 'Ежемесячная зарплата',
    date: '2025-06-03T00:00:00.000Z',
    created_at: '2025-06-03T08:00:00.000Z',
    is_debt_related: false,
    is_informational: false,
    debt_id: null,
    to_account_id: null,
    to_amount: null,
    to_currency: null,
    returned_amount: 0,
    net_amount: 100000,
    has_debt_returns: false,
    user_id: 'test-user-1',
  },
];

// ---------------------------------------------------------------------------

describe('useSearch', () => {
  let search: ReturnType<typeof useSearch>;

  beforeEach(() => {
    search = useSearch(() => sampleTransactions);
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------
  describe('initial state', () => {
    it('starts with empty query', () => {
      expect(search.query.value).toBe('');
    });

    it('isSearching is false initially', () => {
      expect(search.isSearching.value).toBe(false);
    });

    it('returns all transactions when query is empty', () => {
      expect(search.filteredTransactions.value).toHaveLength(3);
    });

    it('hasResults is true when there are transactions', () => {
      expect(search.hasResults.value).toBe(true);
    });

    it('isEmpty is false when query is empty', () => {
      expect(search.isEmpty.value).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // setQuery - filtering by description
  // -------------------------------------------------------------------------
  describe('filtering by description', () => {
    it('filters by description substring match', () => {
      search.setQuery('Магазин');
      expect(search.filteredTransactions.value).toHaveLength(1);
      expect(search.filteredTransactions.value[0].id).toBe('tx-1');
    });

    it('is case-insensitive', () => {
      search.setQuery('магазин');
      expect(search.filteredTransactions.value).toHaveLength(1);
    });

    it('filters by partial description', () => {
      search.setQuery('Ежемес');
      expect(search.filteredTransactions.value).toHaveLength(1);
      expect(search.filteredTransactions.value[0].id).toBe('tx-3');
    });
  });

  // -------------------------------------------------------------------------
  // setQuery - filtering by category name
  // -------------------------------------------------------------------------
  describe('filtering by category name', () => {
    it('finds transactions by category name (static categories)', () => {
      // 'Продукты' maps to id 'groceries'
      search.setQuery('Продукты');
      // The static getCategoryById should resolve 'groceries' → 'Продукты'
      expect(search.filteredTransactions.value[0].id).toBe('tx-1');
    });

    it('finds transactions by category name Транспорт', () => {
      search.setQuery('Транспорт');
      expect(search.filteredTransactions.value).toHaveLength(1);
      expect(search.filteredTransactions.value[0].id).toBe('tx-2');
    });
  });

  // -------------------------------------------------------------------------
  // setQuery - filtering by amount
  // -------------------------------------------------------------------------
  describe('filtering by amount', () => {
    it('filters by exact amount string', () => {
      search.setQuery('25000');
      expect(search.filteredTransactions.value).toHaveLength(1);
      expect(search.filteredTransactions.value[0].id).toBe('tx-1');
    });

    it('filters by partial amount string', () => {
      search.setQuery('100');
      // 100000 contains "100"
      const results = search.filteredTransactions.value;
      expect(results.some((t) => t.id === 'tx-3')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // isSearching / isEmpty / hasResults
  // -------------------------------------------------------------------------
  describe('state flags', () => {
    it('isSearching becomes true when query is set', () => {
      search.setQuery('test');
      expect(search.isSearching.value).toBe(true);
    });

    it('isEmpty becomes true when query yields no results', () => {
      search.setQuery('xyzunmatchable9999');
      expect(search.isEmpty.value).toBe(true);
    });

    it('hasResults is false when query yields no results', () => {
      search.setQuery('xyzunmatchable9999');
      expect(search.hasResults.value).toBe(false);
    });

    it('whitespace-only query returns all transactions (not searching)', () => {
      search.setQuery('   ');
      // trim() → '' so all transactions returned
      expect(search.filteredTransactions.value).toHaveLength(3);
      // isSearching depends on non-empty trimmed query
      // setQuery(' ') sets isSearching = ' '.trim() !== '' → false
      expect(search.isSearching.value).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // clearSearch
  // -------------------------------------------------------------------------
  describe('clearSearch', () => {
    it('clears query and stops searching', () => {
      search.setQuery('Магазин');
      search.clearSearch();

      expect(search.query.value).toBe('');
      expect(search.isSearching.value).toBe(false);
    });

    it('returns all transactions after clear', () => {
      search.setQuery('Магазин');
      search.clearSearch();
      expect(search.filteredTransactions.value).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles empty transactions array', () => {
      const emptySearch = useSearch(() => []);
      emptySearch.setQuery('anything');
      expect(emptySearch.filteredTransactions.value).toHaveLength(0);
      expect(emptySearch.isEmpty.value).toBe(true);
    });

    it('handles transactions with null description gracefully', () => {
      search.setQuery('5000');
      // tx-2 has null description but amount matches
      const results = search.filteredTransactions.value;
      expect(results.some((t) => t.id === 'tx-2')).toBe(true);
    });

    it('returns all transactions when query is reset to empty', () => {
      search.setQuery('Магазин');
      search.setQuery('');
      expect(search.filteredTransactions.value).toHaveLength(3);
    });
  });
});
