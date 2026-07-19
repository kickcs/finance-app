import { describe, it, expect } from 'vitest';
import { reviewRows } from './reviewRows';

describe('reviewRows', () => {
  it('expense → счёт+категория+split, без TransferPanel', () => {
    expect(reviewRows('expense')).toEqual({
      account: true,
      category: true,
      transferPanel: false,
      split: true,
    });
  });

  it('income → счёт+категория, без split и TransferPanel', () => {
    expect(reviewRows('income')).toEqual({
      account: true,
      category: true,
      transferPanel: false,
      split: false,
    });
  });

  it('transfer → только TransferPanel', () => {
    expect(reviewRows('transfer')).toEqual({
      account: false,
      category: false,
      transferPanel: true,
      split: false,
    });
  });
});
