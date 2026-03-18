import { describe, it, expect } from 'vitest';
import { MAIN_NAV_ITEMS, DESKTOP_NAV_ITEMS } from './navigation';

describe('DESKTOP_NAV_ITEMS', () => {
  it('includes debts item with correct path', () => {
    const debts = DESKTOP_NAV_ITEMS.find((item) => item.id === 'debts');
    expect(debts).toBeDefined();
    expect(debts?.path).toBe('/debts');
    expect(debts?.icon).toBe('handshake');
  });

  it('has 5 items (one more than mobile nav)', () => {
    expect(DESKTOP_NAV_ITEMS.length).toBe(5);
    expect(MAIN_NAV_ITEMS.length).toBe(4);
  });
});

describe('MAIN_NAV_ITEMS', () => {
  it('does not include debts (mobile nav unchanged)', () => {
    const debts = MAIN_NAV_ITEMS.find((item) => item.id === 'debts');
    expect(debts).toBeUndefined();
  });
});
