import { convert } from '../useExchangeRates';

test('convert returns amount unchanged when same currency', () => {
  expect(convert(100, 'USD', 'USD', { USD: 1, EUR: 0.9 })).toBe(100);
});

test('convert USD to EUR via base', () => {
  expect(convert(100, 'USD', 'EUR', { USD: 1, EUR: 0.9 })).toBeCloseTo(90);
});

test('convert handles missing rate by treating as 1', () => {
  expect(convert(50, 'XXX', 'YYY', {})).toBe(50);
});
