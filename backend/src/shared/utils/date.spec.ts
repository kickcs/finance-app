import { startOfDayInTz, endOfDayInTz } from './date';

describe('startOfDayInTz / endOfDayInTz', () => {
  describe('startOfDayInTz', () => {
    it('maps midnight of a Tashkent day (UTC+5) to the correct UTC instant', () => {
      // 2026-07-12 00:00 in Tashkent = 2026-07-11 19:00 UTC
      expect(startOfDayInTz('2026-07-12', 'Asia/Tashkent')).toEqual(
        new Date('2026-07-11T19:00:00.000Z'),
      );
    });

    it('is identity for UTC', () => {
      expect(startOfDayInTz('2026-07-12', 'UTC')).toEqual(new Date('2026-07-12T00:00:00.000Z'));
    });

    it('handles half-hour zones (India, UTC+5:30)', () => {
      // 2026-07-12 00:00 in Kolkata = 2026-07-11 18:30 UTC
      expect(startOfDayInTz('2026-07-12', 'Asia/Kolkata')).toEqual(
        new Date('2026-07-11T18:30:00.000Z'),
      );
    });

    it('handles a DST zone in summer (New York, UTC-4 in July)', () => {
      // 2026-07-12 00:00 in New York (EDT, UTC-4) = 2026-07-12 04:00 UTC
      expect(startOfDayInTz('2026-07-12', 'America/New_York')).toEqual(
        new Date('2026-07-12T04:00:00.000Z'),
      );
    });

    it('handles a DST zone in winter (New York, UTC-5 in January)', () => {
      // 2026-01-12 00:00 in New York (EST, UTC-5) = 2026-01-12 05:00 UTC
      expect(startOfDayInTz('2026-01-12', 'America/New_York')).toEqual(
        new Date('2026-01-12T05:00:00.000Z'),
      );
    });
  });

  describe('endOfDayInTz', () => {
    it('maps end-of-day of a Tashkent day to the correct UTC instant', () => {
      // 2026-07-12 23:59:59.999 in Tashkent = 2026-07-12 18:59:59.999 UTC
      expect(endOfDayInTz('2026-07-12', 'Asia/Tashkent')).toEqual(
        new Date('2026-07-12T18:59:59.999Z'),
      );
    });

    it('is identity for UTC', () => {
      expect(endOfDayInTz('2026-07-12', 'UTC')).toEqual(new Date('2026-07-12T23:59:59.999Z'));
    });
  });
});
