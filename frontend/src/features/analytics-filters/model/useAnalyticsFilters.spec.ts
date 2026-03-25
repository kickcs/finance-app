import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';

vi.mock('@/shared/lib/hooks/useFinancialPeriod', () => ({
  useFinancialPeriod: () => ({
    startDay: ref(1),
    isCustomPeriod: ref(false),
    currentPeriod: ref({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }),
    currentBounds: ref({
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
    }),
    daysRemaining: ref(15),
  }),
}));

import { useAnalyticsFilters } from './useAnalyticsFilters';

// ---------------------------------------------------------------------------
// useAnalyticsFilters unit tests (no component mounting needed)
// ---------------------------------------------------------------------------

describe('useAnalyticsFilters', () => {
  let filters: ReturnType<typeof useAnalyticsFilters>;

  beforeEach(() => {
    filters = useAnalyticsFilters();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------
  describe('initial state', () => {
    it('defaults to month-start period', () => {
      expect(filters.filters.value.period).toBe('month-start');
    });

    it('defaults to all transaction type', () => {
      expect(filters.filters.value.type).toBe('all');
    });

    it('defaults to empty selectedCategoryIds', () => {
      expect(filters.filters.value.selectedCategoryIds).toEqual([]);
    });

    it('defaults to empty selectedAccountIds', () => {
      expect(filters.filters.value.selectedAccountIds).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // setPeriod
  // -------------------------------------------------------------------------
  describe('setPeriod', () => {
    it('sets period to week-start', () => {
      filters.setPeriod('week-start');
      expect(filters.filters.value.period).toBe('week-start');
    });

    it('sets period to year-start', () => {
      filters.setPeriod('year-start');
      expect(filters.filters.value.period).toBe('year-start');
    });

    it('sets period to custom', () => {
      filters.setPeriod('custom');
      expect(filters.filters.value.period).toBe('custom');
    });
  });

  // -------------------------------------------------------------------------
  // effectiveDateRange
  // -------------------------------------------------------------------------
  describe('effectiveDateRange', () => {
    it('returns non-null dates for month-start', () => {
      filters.setPeriod('month-start');
      const range = filters.effectiveDateRange.value;
      expect(range.startDate).toBeInstanceOf(Date);
      expect(range.endDate).toBeInstanceOf(Date);
    });

    it('startDate is beginning of current month for month-start', () => {
      filters.setPeriod('month-start');
      const { startDate } = filters.effectiveDateRange.value;
      const now = new Date();
      expect(startDate?.getFullYear()).toBe(now.getFullYear());
      expect(startDate?.getMonth()).toBe(now.getMonth());
      expect(startDate?.getDate()).toBe(1);
    });

    it('returns start of week for week-start period', () => {
      filters.setPeriod('week-start');
      const { startDate } = filters.effectiveDateRange.value;
      // Monday should have getDay() === 1
      expect(startDate?.getDay()).toBe(1);
    });

    it('returns Jan 1 for year-start period', () => {
      filters.setPeriod('year-start');
      const { startDate } = filters.effectiveDateRange.value;
      expect(startDate?.getMonth()).toBe(0);
      expect(startDate?.getDate()).toBe(1);
    });

    it('uses custom date range when period is custom', () => {
      filters.setPeriod('custom');
      filters.setCustomDateRange({ startDate: '2025-01-01', endDate: '2025-01-31' });
      const range = filters.effectiveDateRange.value;
      expect(range.startDate?.getFullYear()).toBe(2025);
      expect(range.startDate?.getMonth()).toBe(0);
      expect(range.endDate?.getMonth()).toBe(0);
    });

    it('returns null dates for custom with null range', () => {
      filters.setPeriod('custom');
      filters.setCustomDateRange({ startDate: null, endDate: null });
      const range = filters.effectiveDateRange.value;
      expect(range.startDate).toBeNull();
      expect(range.endDate).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // setType
  // -------------------------------------------------------------------------
  describe('setType', () => {
    it('sets type to expense', () => {
      filters.setType('expense');
      expect(filters.filters.value.type).toBe('expense');
    });

    it('sets type to income', () => {
      filters.setType('income');
      expect(filters.filters.value.type).toBe('income');
    });

    it('sets type back to all', () => {
      filters.setType('expense');
      filters.setType('all');
      expect(filters.filters.value.type).toBe('all');
    });
  });

  // -------------------------------------------------------------------------
  // toggleCategory
  // -------------------------------------------------------------------------
  describe('toggleCategory', () => {
    it('adds category id when not present', () => {
      filters.toggleCategory('cat-1');
      expect(filters.filters.value.selectedCategoryIds).toContain('cat-1');
    });

    it('removes category id when already present', () => {
      filters.toggleCategory('cat-1');
      filters.toggleCategory('cat-1');
      expect(filters.filters.value.selectedCategoryIds).not.toContain('cat-1');
    });

    it('handles multiple different categories', () => {
      filters.toggleCategory('cat-1');
      filters.toggleCategory('cat-2');
      expect(filters.filters.value.selectedCategoryIds).toContain('cat-1');
      expect(filters.filters.value.selectedCategoryIds).toContain('cat-2');
    });
  });

  // -------------------------------------------------------------------------
  // toggleAccount
  // -------------------------------------------------------------------------
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
  });

  // -------------------------------------------------------------------------
  // clearCategoryFilters / clearAccountFilters / clearAllFilters
  // -------------------------------------------------------------------------
  describe('clear filters', () => {
    it('clearCategoryFilters empties selectedCategoryIds', () => {
      filters.toggleCategory('cat-1');
      filters.toggleCategory('cat-2');
      filters.clearCategoryFilters();
      expect(filters.filters.value.selectedCategoryIds).toEqual([]);
    });

    it('clearAccountFilters empties selectedAccountIds', () => {
      filters.toggleAccount('acc-1');
      filters.clearAccountFilters();
      expect(filters.filters.value.selectedAccountIds).toEqual([]);
    });

    it('clearAllFilters resets both categories and accounts and type', () => {
      filters.toggleCategory('cat-1');
      filters.toggleAccount('acc-1');
      filters.setType('expense');
      filters.clearAllFilters();
      expect(filters.filters.value.selectedCategoryIds).toEqual([]);
      expect(filters.filters.value.selectedAccountIds).toEqual([]);
      expect(filters.filters.value.type).toBe('all');
    });
  });

  // -------------------------------------------------------------------------
  // activeFilterCount
  // -------------------------------------------------------------------------
  describe('activeFilterCount', () => {
    it('is 0 initially', () => {
      expect(filters.activeFilterCount.value).toBe(0);
    });

    it('increments by 1 when categories are selected', () => {
      filters.toggleCategory('cat-1');
      expect(filters.activeFilterCount.value).toBe(1);
    });

    it('increments by 1 when accounts are selected', () => {
      filters.toggleAccount('acc-1');
      expect(filters.activeFilterCount.value).toBe(1);
    });

    it('is 2 when both categories and accounts are selected', () => {
      filters.toggleCategory('cat-1');
      filters.toggleAccount('acc-1');
      expect(filters.activeFilterCount.value).toBe(2);
    });

    it('decrements when all of a group is cleared', () => {
      filters.toggleCategory('cat-1');
      filters.toggleAccount('acc-1');
      filters.clearCategoryFilters();
      expect(filters.activeFilterCount.value).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // calculateCategoryStats
  // -------------------------------------------------------------------------
  describe('calculateCategoryStats', () => {
    const transactions = [
      {
        id: 'tx-1',
        category_id: 'groceries',
        amount: 10000,
        currency: 'UZS',
        type: 'expense' as const,
      },
      {
        id: 'tx-2',
        category_id: 'transport',
        amount: 5000,
        currency: 'UZS',
        type: 'expense' as const,
      },
      {
        id: 'tx-3',
        category_id: 'salary',
        amount: 100000,
        currency: 'UZS',
        type: 'income' as const,
      },
    ] as Parameters<typeof filters.calculateCategoryStats>[0];

    it('returns stats for all types when type is all', () => {
      const stats = filters.calculateCategoryStats(transactions, 'all');
      expect(stats.length).toBe(3);
    });

    it('filters by expense type', () => {
      const stats = filters.calculateCategoryStats(transactions, 'expense');
      expect(stats.every((s) => ['groceries', 'transport'].includes(s.id))).toBe(true);
      expect(stats.length).toBe(2);
    });

    it('filters by income type', () => {
      const stats = filters.calculateCategoryStats(transactions, 'income');
      expect(stats.length).toBe(1);
      expect(stats[0].id).toBe('salary');
    });

    it('calculates percentages correctly (groceries = 10000/15000 ≈ 66.7%)', () => {
      const stats = filters.calculateCategoryStats(transactions, 'expense');
      const groceries = stats.find((s) => s.id === 'groceries');
      expect(groceries?.percent).toBeCloseTo(66.67, 0);
    });

    it('sorts by amount descending', () => {
      const stats = filters.calculateCategoryStats(transactions, 'expense');
      expect(stats[0].id).toBe('groceries'); // 10000 > 5000
    });

    it('returns empty array for no matching transactions', () => {
      const stats = filters.calculateCategoryStats([], 'expense');
      expect(stats).toEqual([]);
    });

    it('skips transactions without category_id', () => {
      const withNullCategory = [
        { id: 'tx-nc', category_id: null, amount: 5000, currency: 'UZS', type: 'expense' as const },
      ] as unknown as Parameters<typeof filters.calculateCategoryStats>[0];
      const stats = filters.calculateCategoryStats(withNullCategory, 'expense');
      expect(stats).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // daysInPeriod
  // -------------------------------------------------------------------------
  describe('daysInPeriod', () => {
    it('returns at least 1 day for any period', () => {
      filters.setPeriod('month-start');
      expect(filters.daysInPeriod.value).toBeGreaterThanOrEqual(1);
    });

    it('returns 1 day for null custom range', () => {
      filters.setPeriod('custom');
      filters.setCustomDateRange({ startDate: null, endDate: null });
      expect(filters.daysInPeriod.value).toBe(1);
    });
  });
});
