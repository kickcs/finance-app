import { describe, it, expect } from 'vitest';
import type { Debt } from '@/shared/api/database.types';
import { eligibleDebtsForImport, findExactRepaymentMatch } from './debtRepayment';

function makeDebt(overrides: Partial<Debt>): Debt {
  return {
    id: 'debt-1',
    user_id: 'user-1',
    name: 'Долг',
    total_amount: 100_000,
    remaining_amount: 100_000,
    monthly_payment: null,
    next_payment_date: null,
    created_at: '2026-07-01T00:00:00.000Z',
    debt_type: 'given',
    person_name: 'Алишер',
    account_id: null,
    transaction_id: null,
    close_transaction_id: null,
    is_closed: false,
    currency: 'UZS',
    source_transaction_id: null,
    description: null,
    closed_at: null,
    forgiven_amount: 0,
    is_private: false,
    ...overrides,
  };
}

const incomeImport = { type: 'income' as const, amount: 100_000, currency: 'UZS' };

describe('eligibleDebtsForImport', () => {
  it('income-импорт → открытые долги given той же валюты', () => {
    const debts = [
      makeDebt({ id: 'd1', debt_type: 'given' }),
      makeDebt({ id: 'd2', debt_type: 'taken' }),
      makeDebt({ id: 'd3', debt_type: 'given', is_closed: true }),
      makeDebt({ id: 'd4', debt_type: 'given', currency: 'USD' }),
    ];
    expect(eligibleDebtsForImport(debts, incomeImport).map((d) => d.id)).toEqual(['d1']);
  });

  it('expense-импорт → долги taken', () => {
    const debts = [
      makeDebt({ id: 'd1', debt_type: 'given' }),
      makeDebt({ id: 'd2', debt_type: 'taken' }),
    ];
    const result = eligibleDebtsForImport(debts, {
      type: 'expense',
      amount: 50_000,
      currency: 'UZS',
    });
    expect(result.map((d) => d.id)).toEqual(['d2']);
  });

  it('исключает долги с остатком меньше суммы импорта (переплата — вне v1)', () => {
    const debts = [
      makeDebt({ id: 'd1', remaining_amount: 30_000 }),
      makeDebt({ id: 'd2', remaining_amount: 100_000 }),
    ];
    expect(eligibleDebtsForImport(debts, incomeImport).map((d) => d.id)).toEqual(['d2']);
  });

  it('balance_change и нулевая/отсутствующая сумма → пусто', () => {
    const debts = [makeDebt({})];
    expect(
      eligibleDebtsForImport(debts, { type: 'balance_change', amount: -100_000, currency: 'UZS' }),
    ).toEqual([]);
    expect(
      eligibleDebtsForImport(debts, { type: 'income', amount: null, currency: 'UZS' }),
    ).toEqual([]);
    expect(eligibleDebtsForImport(debts, { type: 'income', amount: 0, currency: 'UZS' })).toEqual(
      [],
    );
  });
});

describe('findExactRepaymentMatch', () => {
  it('единственный долг с остатком, равным сумме → матч', () => {
    const debts = [
      makeDebt({ id: 'd1', remaining_amount: 100_000 }),
      makeDebt({ id: 'd2', remaining_amount: 200_000 }),
    ];
    expect(findExactRepaymentMatch(debts, incomeImport)?.id).toBe('d1');
  });

  it('несколько долгов с одинаковым остатком → нет матча (неоднозначно)', () => {
    const debts = [
      makeDebt({ id: 'd1', remaining_amount: 100_000 }),
      makeDebt({ id: 'd2', remaining_amount: 100_000 }),
    ];
    expect(findExactRepaymentMatch(debts, incomeImport)).toBeNull();
  });

  it('нет точного совпадения → null', () => {
    const debts = [makeDebt({ id: 'd1', remaining_amount: 150_000 })];
    expect(findExactRepaymentMatch(debts, incomeImport)).toBeNull();
  });
});
