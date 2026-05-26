import { computeRange } from '../usePeriodNavigation';

test('day range = single ISO', () => {
  const r = computeRange(new Date(2026, 4, 15), 'day', null);
  expect(r.startISO).toBe('2026-05-15');
  expect(r.endISO).toBe('2026-05-15');
});

test('week range starts on monday', () => {
  // 2026-05-15 = Friday
  const r = computeRange(new Date(2026, 4, 15), 'week', null);
  expect(r.startISO).toBe('2026-05-11'); // Monday
  expect(r.endISO).toBe('2026-05-17'); // Sunday
});

test('year range', () => {
  const r = computeRange(new Date(2026, 6, 1), 'year', null);
  expect(r.startISO).toBe('2026-01-01');
  expect(r.endISO).toBe('2026-12-31');
});

test('month range uses financial period when provided', () => {
  const r = computeRange(new Date(2026, 4, 15), 'month', {
    startISO: '2026-05-25',
    endISO: '2026-06-24',
  });
  expect(r.startISO).toBe('2026-05-25');
  expect(r.endISO).toBe('2026-06-24');
});

test('month range falls back to calendar when financial null', () => {
  const r = computeRange(new Date(2026, 4, 15), 'month', null);
  expect(r.startISO).toBe('2026-05-01');
  expect(r.endISO).toBe('2026-05-31');
});
