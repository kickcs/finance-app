import { describe, it, expect } from 'vitest';
import { MAIN_NAV_ITEMS, DESKTOP_NAV_ITEMS } from './navigation';

describe('DESKTOP_NAV_ITEMS', () => {
  it('includes debts item with correct path', () => {
    const debts = DESKTOP_NAV_ITEMS.find((item) => item.id === 'debts');
    expect(debts).toBeDefined();
    expect(debts?.path).toBe('/debts');
    expect(debts?.icon).toBe('handshake');
  });

  it('has more items than MAIN_NAV_ITEMS', () => {
    expect(DESKTOP_NAV_ITEMS.length).toBeGreaterThan(MAIN_NAV_ITEMS.length);
  });
});

describe('MAIN_NAV_ITEMS', () => {
  it('does not include debts (mobile nav unchanged)', () => {
    const debts = MAIN_NAV_ITEMS.find((item) => item.id === 'debts');
    expect(debts).toBeUndefined();
  });
});
