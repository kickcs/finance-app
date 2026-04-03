import { describe, it, expect, beforeEach } from 'vitest';
import { useAnalyticsFilters } from './useAnalyticsFilters';

describe('useAnalyticsFilters', () => {
  let filters: ReturnType<typeof useAnalyticsFilters>;

  beforeEach(() => {
    filters = useAnalyticsFilters();
  });

  describe('initial state', () => {
    it('defaults to empty selectedAccountIds', () => {
      expect(filters.filters.value.selectedAccountIds).toEqual([]);
    });

    it('activeFilterCount is 0', () => {
      expect(filters.activeFilterCount.value).toBe(0);
    });
  });

  describe('toggleAccount', () => {
    it('adds account id when not present', () => {
      filters.toggleAccount('acc-1');
      expect(filters.filters.value.selectedAccountIds).toContain('acc-1');
    });

    it('removes account id when already present', () => {
      filters.toggleAccount('acc-1');
      filters.toggleAccount('acc-1');
      expect(filters.filters.value.selectedAccountIds).not.toContain('acc-1');
    });

    it('handles multiple accounts', () => {
      filters.toggleAccount('acc-1');
      filters.toggleAccount('acc-2');
      expect(filters.filters.value.selectedAccountIds).toEqual(['acc-1', 'acc-2']);
    });
  });

  describe('clearAccountFilters', () => {
    it('empties selectedAccountIds', () => {
      filters.toggleAccount('acc-1');
      filters.toggleAccount('acc-2');
      filters.clearAccountFilters();
      expect(filters.filters.value.selectedAccountIds).toEqual([]);
    });
  });

  describe('activeFilterCount', () => {
    it('is 1 when accounts are selected', () => {
      filters.toggleAccount('acc-1');
      expect(filters.activeFilterCount.value).toBe(1);
    });

    it('is 0 after clearing', () => {
      filters.toggleAccount('acc-1');
      filters.clearAccountFilters();
      expect(filters.activeFilterCount.value).toBe(0);
    });
  });
});
