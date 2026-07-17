import { describe, it, expect } from 'vitest';
import { checkBalanceAfter } from './balanceCheck';

describe('checkBalanceAfter', () => {
  it('expense: баланс в приложении минус сумма == balance_after → совпадает', () => {
    const result = checkBalanceAfter(100_000, {
      type: 'expense',
      amount: 45_000,
      balance_after: 55_000,
    });
    expect(result).toEqual({ expected: 55_000, matches: true });
  });

  it('income: баланс плюс сумма', () => {
    const result = checkBalanceAfter(100_000, {
      type: 'income',
      amount: 45_000,
      balance_after: 145_000,
    });
    expect(result).toEqual({ expected: 145_000, matches: true });
  });

  it('balance_change: подписанная дельта', () => {
    const result = checkBalanceAfter(100_000, {
      type: 'balance_change',
      amount: -30_000,
      balance_after: 70_000,
    });
    expect(result).toEqual({ expected: 70_000, matches: true });
  });

  it('расхождение → matches: false, expected показывает ожидаемое', () => {
    const result = checkBalanceAfter(90_000, {
      type: 'expense',
      amount: 45_000,
      balance_after: 55_000,
    });
    expect(result).toEqual({ expected: 45_000, matches: false });
  });

  it('дробные копейки не дают ложного расхождения', () => {
    const result = checkBalanceAfter(100.1, {
      type: 'expense',
      amount: 0.2,
      balance_after: 99.9,
    });
    expect(result?.matches).toBe(true);
  });

  it('нет balance_after или суммы → null', () => {
    expect(checkBalanceAfter(100, { type: 'expense', amount: 45, balance_after: null })).toBeNull();
    expect(
      checkBalanceAfter(100, { type: 'balance_change', amount: null, balance_after: 55 }),
    ).toBeNull();
  });
});
