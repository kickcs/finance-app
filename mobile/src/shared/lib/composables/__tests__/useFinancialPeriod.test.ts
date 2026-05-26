import { computeFinancialPeriod } from '../useFinancialPeriod';

test('startDay 1: period is calendar month', () => {
  const p = computeFinancialPeriod(new Date(2026, 4, 15), 1); // 2026-05-15
  expect(p.startISO).toBe('2026-05-01');
  expect(p.endISO).toBe('2026-05-31');
});

test('startDay 25, current date before startDay: period is previous month', () => {
  const p = computeFinancialPeriod(new Date(2026, 4, 10), 25); // 2026-05-10
  expect(p.startISO).toBe('2026-04-25');
  expect(p.endISO).toBe('2026-05-24');
});

test('startDay 25, current date on or after: period is current month', () => {
  const p = computeFinancialPeriod(new Date(2026, 4, 25), 25);
  expect(p.startISO).toBe('2026-05-25');
  expect(p.endISO).toBe('2026-06-24');
});
