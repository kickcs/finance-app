import { describe, it, expect } from 'vitest';
import {
  getCurrencySymbol,
  formatPercentage,
  formatNumberWithSpaces,
  formatMasked,
  CURRENCIES,
} from './currency';

describe('getCurrencySymbol', () => {
  it('returns symbol for known currency', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('UZS')).toBe('сўм');
  });

  it('returns code for unknown currency', () => {
    expect(getCurrencySymbol('XYZ')).toBe('XYZ');
  });
});

describe('formatPercentage', () => {
  it('formats percentage with default decimals', () => {
    expect(formatPercentage(5)).toBe('5.0%');
  });

  it('shows sign when requested', () => {
    expect(formatPercentage(5, 1, true)).toBe('+5.0%');
    expect(formatPercentage(-3, 1, true)).toBe('-3.0%');
  });
});

describe('formatNumberWithSpaces', () => {
  it('formats large numbers with spaces', () => {
    expect(formatNumberWithSpaces(1000000)).toBe('1 000 000');
  });

  it('returns empty string for zero', () => {
    expect(formatNumberWithSpaces(0)).toBe('');
  });
});

describe('formatMasked', () => {
  it('returns masked value when hidden', () => {
    expect(formatMasked(50000, 'UZS', true)).toBe('••••');
  });
});

describe('CURRENCIES', () => {
  it('contains expected currencies', () => {
    expect(Object.keys(CURRENCIES)).toContain('USD');
    expect(Object.keys(CURRENCIES)).toContain('UZS');
    expect(CURRENCIES.UZS.decimals).toBe(0);
  });
});
