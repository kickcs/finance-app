import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';

// Mock useFinancialPeriod BEFORE importing the composable
vi.mock('@/shared/lib/hooks/useFinancialPeriod', () => ({
  useFinancialPeriod: () => ({
    startDay: ref(1),
    isCustomPeriod: ref(false),
    currentPeriod: ref({ year: 2026, month: 4 }),
    currentBounds: ref({
      start: new Date(2026, 3, 1),
      end: new Date(2026, 4, 1),
    }),
    totalDays: ref(30),
    daysRemaining: ref(15),
  }),
}));

vi.mock('@/shared/lib/format/intlCache', () => ({
  getCachedDateFormat: (locale: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, options),
}));

vi.mock('@/shared/lib/date', () => ({
  toLocalISODate: (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },
}));

import { usePeriodNavigation } from './usePeriodNavigation';

// Fake "today": April 3, 2026 (month=3 in 0-based = April)
const FAKE_TODAY = new Date(2026, 3, 3); // 2026-04-03

describe('usePeriodNavigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FAKE_TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------
  describe('initial state', () => {
    it('defaults scale to month', () => {
      const { scale } = usePeriodNavigation();
      expect(scale.value).toBe('month');
    });

    it('defaults offset to 0', () => {
      const { offset } = usePeriodNavigation();
      expect(offset.value).toBe(0);
    });

    it('isCurrentPeriod is true initially', () => {
      const { isCurrentPeriod } = usePeriodNavigation();
      expect(isCurrentPeriod.value).toBe(true);
    });

    it('canGoNext is false initially (offset=0)', () => {
      const { canGoNext } = usePeriodNavigation();
      expect(canGoNext.value).toBe(false);
    });

    it('canGoPrev is always true', () => {
      const { canGoPrev } = usePeriodNavigation();
      expect(canGoPrev.value).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Month scale
  // ---------------------------------------------------------------------------
  describe('month scale', () => {
    it('label contains current month name at offset 0', () => {
      const { label } = usePeriodNavigation();
      // currentPeriod is { year: 2026, month: 4 }, startDay=1 → "Апрель 2026"
      expect(label.value).toBe('Апрель 2026');
    });

    it('dateRange for current month starts at financial month start and ends today', () => {
      const { dateRange } = usePeriodNavigation();
      // currentBounds.start = April 1, 2026; today = April 3
      expect(dateRange.value.startDate).toBe('2026-04-01');
      expect(dateRange.value.endDate).toBe('2026-04-03');
    });

    it('prev() decrements offset', () => {
      const { prev, offset } = usePeriodNavigation();
      prev();
      expect(offset.value).toBe(-1);
    });

    it('prev() moves to previous month label', () => {
      const { prev, label } = usePeriodNavigation();
      prev();
      // currentPeriod is April 2026, offset=-1 → March 2026 → "Март 2026"
      expect(label.value).toBe('Март 2026');
    });

    it('prev() dateRange covers full previous financial month', () => {
      const { prev, dateRange } = usePeriodNavigation();
      prev();
      // March 2026 with startDay=1 → March 1 to March 31
      expect(dateRange.value.startDate).toBe('2026-03-01');
      expect(dateRange.value.endDate).toBe('2026-03-31');
    });

    it('next() does nothing when at offset 0 (canGoNext is false)', () => {
      const { next, offset } = usePeriodNavigation();
      next();
      expect(offset.value).toBe(0);
    });

    it('next() increments offset after prev()', () => {
      const { next, prev, offset } = usePeriodNavigation();
      prev();
      expect(offset.value).toBe(-1);
      next();
      expect(offset.value).toBe(0);
    });

    it('canGoNext is true after prev()', () => {
      const { prev, canGoNext } = usePeriodNavigation();
      prev();
      expect(canGoNext.value).toBe(true);
    });

    it('goToday() resets offset to 0', () => {
      const { prev, goToday, offset } = usePeriodNavigation();
      prev();
      prev();
      goToday();
      expect(offset.value).toBe(0);
    });

    it('isCurrentPeriod is false after prev()', () => {
      const { prev, isCurrentPeriod } = usePeriodNavigation();
      prev();
      expect(isCurrentPeriod.value).toBe(false);
    });

    it('isCurrentPeriod is true after goToday()', () => {
      const { prev, goToday, isCurrentPeriod } = usePeriodNavigation();
      prev();
      goToday();
      expect(isCurrentPeriod.value).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Day scale
  // ---------------------------------------------------------------------------
  describe('day scale', () => {
    it('setScale resets offset to 0', () => {
      const { setScale, prev, offset } = usePeriodNavigation();
      prev();
      expect(offset.value).toBe(-1);
      setScale('day');
      expect(offset.value).toBe(0);
    });

    it('setScale changes scale to day', () => {
      const { setScale, scale } = usePeriodNavigation();
      setScale('day');
      expect(scale.value).toBe('day');
    });

    it('label shows today in day scale at offset 0', () => {
      const { setScale, label } = usePeriodNavigation();
      setScale('day');
      // 2026-04-03 is a Friday (пт)
      const expected = new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        weekday: 'short',
      }).format(FAKE_TODAY);
      expect(label.value).toBe(expected);
    });

    it('dateRange is a single day at offset 0', () => {
      const { setScale, dateRange } = usePeriodNavigation();
      setScale('day');
      expect(dateRange.value.startDate).toBe('2026-04-03');
      expect(dateRange.value.endDate).toBe('2026-04-03');
    });

    it('prev() goes to yesterday in day scale', () => {
      const { setScale, prev, dateRange } = usePeriodNavigation();
      setScale('day');
      prev();
      expect(dateRange.value.startDate).toBe('2026-04-02');
      expect(dateRange.value.endDate).toBe('2026-04-02');
    });

    it('label shows yesterday after prev() in day scale', () => {
      const { setScale, prev, label } = usePeriodNavigation();
      setScale('day');
      prev();
      const yesterday = new Date(2026, 3, 2);
      const expected = new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        weekday: 'short',
      }).format(yesterday);
      expect(label.value).toBe(expected);
    });

    it('daysInPeriod is 1 in day scale', () => {
      const { setScale, daysInPeriod } = usePeriodNavigation();
      setScale('day');
      expect(daysInPeriod.value).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Year scale
  // ---------------------------------------------------------------------------
  describe('year scale', () => {
    it('label shows current year at offset 0', () => {
      const { setScale, label } = usePeriodNavigation();
      setScale('year');
      expect(label.value).toBe('2026');
    });

    it('dateRange for current year: Jan 1 to today', () => {
      const { setScale, dateRange } = usePeriodNavigation();
      setScale('year');
      expect(dateRange.value.startDate).toBe('2026-01-01');
      expect(dateRange.value.endDate).toBe('2026-04-03');
    });

    it('past year (offset=-1) shows full year range', () => {
      const { setScale, prev, dateRange } = usePeriodNavigation();
      setScale('year');
      prev();
      expect(dateRange.value.startDate).toBe('2025-01-01');
      expect(dateRange.value.endDate).toBe('2025-12-31');
    });

    it('label shows previous year after prev()', () => {
      const { setScale, prev, label } = usePeriodNavigation();
      setScale('year');
      prev();
      expect(label.value).toBe('2025');
    });

    it('daysInPeriod for current year is days from Jan 1 to April 3 inclusive', () => {
      const { setScale, daysInPeriod } = usePeriodNavigation();
      setScale('year');
      // Jan (31) + Feb (28) + Mar (31) + Apr 1-3 (3) = 93 days
      expect(daysInPeriod.value).toBe(93);
    });

    it('daysInPeriod for past year 2025 is 365', () => {
      const { setScale, prev, daysInPeriod } = usePeriodNavigation();
      setScale('year');
      prev();
      // 2025 is not a leap year: 365 days
      expect(daysInPeriod.value).toBe(365);
    });
  });

  // ---------------------------------------------------------------------------
  // Comparison date range
  // ---------------------------------------------------------------------------
  describe('comparisonDateRange', () => {
    it('month scale at offset 0: comparison is previous month', () => {
      const { comparisonDateRange } = usePeriodNavigation();
      // compOffset = 0 - 1 = -1 → March 2026
      expect(comparisonDateRange.value.startDate).toBe('2026-03-01');
      expect(comparisonDateRange.value.endDate).toBe('2026-03-31');
    });

    it('month scale at offset -1: comparison is 2 months ago', () => {
      const { prev, comparisonDateRange } = usePeriodNavigation();
      prev(); // offset = -1, compOffset = -2 → February 2026
      expect(comparisonDateRange.value.startDate).toBe('2026-02-01');
      expect(comparisonDateRange.value.endDate).toBe('2026-02-28');
    });

    it('day scale: comparison is the day before current day', () => {
      const { setScale, comparisonDateRange } = usePeriodNavigation();
      setScale('day');
      // offset=0, compOffset=-1 → April 2
      expect(comparisonDateRange.value.startDate).toBe('2026-04-02');
      expect(comparisonDateRange.value.endDate).toBe('2026-04-02');
    });

    it('year scale: comparison is previous year full', () => {
      const { setScale, comparisonDateRange } = usePeriodNavigation();
      setScale('year');
      // offset=0, compOffset=-1 → 2025
      expect(comparisonDateRange.value.startDate).toBe('2025-01-01');
      expect(comparisonDateRange.value.endDate).toBe('2025-12-31');
    });

    it('year scale at offset -1: comparison is 2 years ago', () => {
      const { setScale, prev, comparisonDateRange } = usePeriodNavigation();
      setScale('year');
      prev(); // offset=-1, compOffset=-2 → 2024
      expect(comparisonDateRange.value.startDate).toBe('2024-01-01');
      expect(comparisonDateRange.value.endDate).toBe('2024-12-31');
    });
  });

  // ---------------------------------------------------------------------------
  // Sublabel
  // ---------------------------------------------------------------------------
  describe('sublabel', () => {
    it('month scale shows date range and day count', () => {
      const { sublabel, daysInPeriod } = usePeriodNavigation();
      // current month: April 1 - April 3, which is 3 days
      expect(daysInPeriod.value).toBe(3);
      // Sublabel should contain · and дн
      expect(sublabel.value).toContain('·');
      expect(sublabel.value).toContain('дн');
      expect(sublabel.value).toContain('3 дн');
    });

    it('sublabel contains start date and end date separated by –', () => {
      const { sublabel } = usePeriodNavigation();
      expect(sublabel.value).toContain('–');
    });

    it('day scale sublabel shows same date twice with 1 дн', () => {
      const { setScale, sublabel } = usePeriodNavigation();
      setScale('day');
      expect(sublabel.value).toContain('1 дн');
    });

    it('year scale for full past year shows 365 дн', () => {
      const { setScale, prev, sublabel } = usePeriodNavigation();
      setScale('year');
      prev(); // 2025: 365 days
      expect(sublabel.value).toContain('365 дн');
    });

    it('full previous month (March 2026) shows 31 дн', () => {
      const { prev, sublabel } = usePeriodNavigation();
      prev(); // March 2026: 31 days
      expect(sublabel.value).toContain('31 дн');
    });
  });

  // ---------------------------------------------------------------------------
  // setScale
  // ---------------------------------------------------------------------------
  describe('setScale', () => {
    it('changing scale resets offset to 0', () => {
      const { setScale, prev, offset } = usePeriodNavigation();
      prev();
      prev();
      expect(offset.value).toBe(-2);
      setScale('year');
      expect(offset.value).toBe(0);
    });

    it('can cycle through all scales', () => {
      const { setScale, scale } = usePeriodNavigation();
      setScale('day');
      expect(scale.value).toBe('day');
      setScale('month');
      expect(scale.value).toBe('month');
      setScale('year');
      expect(scale.value).toBe('year');
    });
  });
});
