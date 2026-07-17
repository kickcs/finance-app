// backend/src/shared/utils/financial-period.spec.ts
import {
  resolveStartDay,
  getFinancialMonthBounds,
  getFinancialMonth,
  getCurrentFinancialMonth,
  getCurrentFinancialMonthInTz,
} from './financial-period';

describe('financial-period', () => {
  describe('resolveStartDay', () => {
    it('returns startDay when month has enough days', () => {
      expect(resolveStartDay(2026, 1, 15)).toBe(15);
      expect(resolveStartDay(2026, 3, 31)).toBe(31);
    });

    it('falls back to last day for short months', () => {
      expect(resolveStartDay(2026, 2, 31)).toBe(28);
      expect(resolveStartDay(2026, 2, 29)).toBe(28);
      expect(resolveStartDay(2026, 4, 31)).toBe(30);
    });

    it('handles leap year February', () => {
      expect(resolveStartDay(2024, 2, 31)).toBe(29);
      expect(resolveStartDay(2024, 2, 29)).toBe(29);
    });

    it('returns 1 for startDay=1', () => {
      expect(resolveStartDay(2026, 2, 1)).toBe(1);
    });
  });

  describe('getFinancialMonthBounds', () => {
    it('returns calendar month for startDay=1 (backwards compat)', () => {
      const { start, end } = getFinancialMonthBounds(2026, 3, 1);
      expect(start).toEqual(new Date(2026, 2, 1));
      expect(end).toEqual(new Date(2026, 3, 1));
    });

    it('returns correct bounds for mid-month start', () => {
      const { start, end } = getFinancialMonthBounds(2026, 3, 15);
      expect(start).toEqual(new Date(2026, 2, 15));
      expect(end).toEqual(new Date(2026, 3, 15));
    });

    it('handles year rollover (December)', () => {
      const { start, end } = getFinancialMonthBounds(2026, 12, 15);
      expect(start).toEqual(new Date(2026, 11, 15));
      expect(end).toEqual(new Date(2027, 0, 15));
    });

    it('handles startDay=31 with short month fallback', () => {
      const { start, end } = getFinancialMonthBounds(2026, 1, 31);
      expect(start).toEqual(new Date(2026, 0, 31));
      expect(end).toEqual(new Date(2026, 1, 28));
    });

    it('handles February with startDay=31 (leap year)', () => {
      const { start, end } = getFinancialMonthBounds(2024, 2, 31);
      expect(start).toEqual(new Date(2024, 1, 29));
      expect(end).toEqual(new Date(2024, 2, 31));
    });
  });

  describe('getFinancialMonth', () => {
    it('returns current month when date >= resolvedDay', () => {
      expect(getFinancialMonth(new Date(2026, 2, 20), 15)).toEqual({ year: 2026, month: 3 });
      expect(getFinancialMonth(new Date(2026, 2, 15), 15)).toEqual({ year: 2026, month: 3 });
    });

    it('returns previous month when date < resolvedDay', () => {
      expect(getFinancialMonth(new Date(2026, 2, 5), 15)).toEqual({ year: 2026, month: 2 });
      expect(getFinancialMonth(new Date(2026, 2, 14), 15)).toEqual({ year: 2026, month: 2 });
    });

    it('handles year rollover (January before startDay)', () => {
      expect(getFinancialMonth(new Date(2027, 0, 10), 15)).toEqual({ year: 2026, month: 12 });
    });

    it('handles startDay=31 with Feb resolved=28', () => {
      expect(getFinancialMonth(new Date(2026, 1, 28), 31)).toEqual({ year: 2026, month: 2 });
      expect(getFinancialMonth(new Date(2026, 1, 27), 31)).toEqual({ year: 2026, month: 1 });
    });

    it('returns same as calendar month for startDay=1', () => {
      expect(getFinancialMonth(new Date(2026, 2, 15), 1)).toEqual({ year: 2026, month: 3 });
      expect(getFinancialMonth(new Date(2026, 0, 1), 1)).toEqual({ year: 2026, month: 1 });
    });
  });

  describe('getCurrentFinancialMonth', () => {
    it('returns a valid year/month object', () => {
      const result = getCurrentFinancialMonth(1);
      expect(result.year).toBeGreaterThan(2000);
      expect(result.month).toBeGreaterThanOrEqual(1);
      expect(result.month).toBeLessThanOrEqual(12);
    });
  });

  describe('getCurrentFinancialMonthInTz', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('uses the user timezone day, not the server UTC day, near local midnight', () => {
      // Instant: 2026-07-11 20:30 UTC. In Tashkent (UTC+5) it is already
      // 2026-07-12 01:30 — past the startDay=12 boundary, so the financial month
      // is July. On a UTC server the day is still 2026-07-11 (< 12) → would resolve
      // to June. This asserts the TZ-aware path picks July.
      jest.useFakeTimers().setSystemTime(new Date('2026-07-11T20:30:00.000Z'));

      expect(getCurrentFinancialMonthInTz(12, 'Asia/Tashkent')).toEqual({ year: 2026, month: 7 });
      // Same instant, UTC → June (demonstrates the bug the TZ variant fixes).
      expect(getCurrentFinancialMonthInTz(12, 'UTC')).toEqual({ year: 2026, month: 6 });
    });
  });
});
