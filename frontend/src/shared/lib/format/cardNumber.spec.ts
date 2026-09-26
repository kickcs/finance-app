import { describe, it, expect } from 'vitest';
import { formatCardNumber, isValidCardNumber, normalizeCardNumber } from './cardNumber';

describe('normalizeCardNumber', () => {
  it('оставляет только цифры', () => {
    expect(normalizeCardNumber('8600 1234-5678 9012')).toBe('8600123456789012');
  });

  it('обрезает всё, что длиннее 19 цифр', () => {
    expect(normalizeCardNumber('1'.repeat(25))).toHaveLength(19);
  });
});

describe('isValidCardNumber', () => {
  it('принимает номер из 16 цифр с пробелами', () => {
    expect(isValidCardNumber('8600 1234 5678 9012')).toBe(true);
  });

  it('принимает короткий номер в 12 цифр', () => {
    expect(isValidCardNumber('123456789012')).toBe(true);
  });

  it('отклоняет слишком короткий номер', () => {
    expect(isValidCardNumber('12345678901')).toBe(false);
  });

  it('отклоняет пустую строку', () => {
    expect(isValidCardNumber('')).toBe(false);
  });
});

describe('formatCardNumber', () => {
  it('разбивает номер по четыре цифры', () => {
    expect(formatCardNumber('8600123456789012')).toBe('8600 1234 5678 9012');
  });

  it('не оставляет хвостовой пробел у неполной группы', () => {
    expect(formatCardNumber('860012345')).toBe('8600 1234 5');
  });
});
