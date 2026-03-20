import { describe, it, expect, beforeEach } from 'vitest';
import { useCurrencySelection } from './useCurrencySelection';
import { CURRENCIES } from '@/entities/currency';

// ---------------------------------------------------------------------------

describe('useCurrencySelection', () => {
  let selection: ReturnType<typeof useCurrencySelection>;

  beforeEach(() => {
    selection = useCurrencySelection();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------
  describe('initial state', () => {
    it('searchQuery is empty', () => {
      expect(selection.searchQuery.value).toBe('');
    });

    it('selectedCurrency is null', () => {
      expect(selection.selectedCurrency.value).toBeNull();
    });

    it('returns all currencies when no filter', () => {
      expect(selection.filteredCurrencies.value).toHaveLength(CURRENCIES.length);
    });

    it('all CURRENCIES are present', () => {
      const codes = selection.filteredCurrencies.value.map((c) => c.code);
      expect(codes).toContain('USD');
      expect(codes).toContain('EUR');
      expect(codes).toContain('RUB');
      expect(codes).toContain('UZS');
    });
  });

  // -------------------------------------------------------------------------
  // setSearchQuery - filter by code
  // -------------------------------------------------------------------------
  describe('setSearchQuery filtering', () => {
    it('filters by currency code (exact match)', () => {
      selection.setSearchQuery('USD');
      expect(selection.filteredCurrencies.value).toHaveLength(1);
      expect(selection.filteredCurrencies.value[0].code).toBe('USD');
    });

    it('filters by currency code case-insensitively', () => {
      selection.setSearchQuery('usd');
      expect(selection.filteredCurrencies.value.some((c) => c.code === 'USD')).toBe(true);
    });

    it('filters by currency name substring', () => {
      selection.setSearchQuery('Dollar');
      const result = selection.filteredCurrencies.value;
      expect(result.some((c) => c.code === 'USD')).toBe(true);
    });

    it('filters by currency name case-insensitively', () => {
      selection.setSearchQuery('dollar');
      expect(selection.filteredCurrencies.value.some((c) => c.code === 'USD')).toBe(true);
    });

    it('filters by symbol', () => {
      selection.setSearchQuery('$');
      expect(selection.filteredCurrencies.value.some((c) => c.symbol === '$')).toBe(true);
    });

    it('returns empty array for unmatched query', () => {
      selection.setSearchQuery('XYZNONEMATCH');
      expect(selection.filteredCurrencies.value).toHaveLength(0);
    });

    it('returns all currencies when query is reset to empty', () => {
      selection.setSearchQuery('USD');
      selection.setSearchQuery('');
      expect(selection.filteredCurrencies.value).toHaveLength(CURRENCIES.length);
    });

    it('matches euro by name', () => {
      selection.setSearchQuery('Euro');
      expect(selection.filteredCurrencies.value.some((c) => c.code === 'EUR')).toBe(true);
    });

    it('matches ruble by Russian partial name', () => {
      selection.setSearchQuery('Ruble');
      expect(selection.filteredCurrencies.value.some((c) => c.code === 'RUB')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // selectCurrency
  // -------------------------------------------------------------------------
  describe('selectCurrency', () => {
    it('sets selectedCurrency to the chosen currency', () => {
      const usd = CURRENCIES.find((c) => c.code === 'USD')!;
      selection.selectCurrency(usd);
      expect(selection.selectedCurrency.value).toEqual(usd);
    });

    it('updates selectedCurrency when selecting a different one', () => {
      const usd = CURRENCIES.find((c) => c.code === 'USD')!;
      const eur = CURRENCIES.find((c) => c.code === 'EUR')!;
      selection.selectCurrency(usd);
      selection.selectCurrency(eur);
      expect(selection.selectedCurrency.value?.code).toBe('EUR');
    });
  });

  // -------------------------------------------------------------------------
  // clearSelection
  // -------------------------------------------------------------------------
  describe('clearSelection', () => {
    it('resets selectedCurrency to null', () => {
      const usd = CURRENCIES.find((c) => c.code === 'USD')!;
      selection.selectCurrency(usd);
      selection.clearSelection();
      expect(selection.selectedCurrency.value).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles empty string query gracefully', () => {
      selection.setSearchQuery('');
      expect(selection.filteredCurrencies.value).toHaveLength(CURRENCIES.length);
    });

    it('long search term returns empty array', () => {
      selection.setSearchQuery('A'.repeat(100));
      expect(selection.filteredCurrencies.value).toHaveLength(0);
    });
  });
});
