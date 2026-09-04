import { describe, it, expect } from 'vitest';
import type { Debt } from '@/shared/api/database.types';
import {
  eligibleRepaymentGroupsForImport,
  findRepaymentMatch,
  repaymentTolerance,
  repaymentDifferenceLabel,
  debtsCountLabel,
} from './debtRepayment';
import type { ImportedTransaction } from '@/entities/imported-transaction';

type RepaymentImport = Pick<ImportedTransaction, 'type' | 'amount' | 'currency'>;

function findMatch(debts: Debt[], item: RepaymentImport) {
  return findRepaymentMatch(eligibleRepaymentGroupsForImport(debts, item), item);
}

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
    fee_amount: 0,
    fee_transaction_id: null,
    ...overrides,
  };
}

const incomeImport = { type: 'income' as const, amount: 100_000, currency: 'UZS' };

describe('eligibleRepaymentGroupsForImport', () => {
  it('income-импорт → группы открытых долгов given той же валюты', () => {
    const debts = [
      makeDebt({ id: 'd1', debt_type: 'given' }),
      makeDebt({ id: 'd2', debt_type: 'taken' }),
      makeDebt({ id: 'd3', debt_type: 'given', is_closed: true }),
      makeDebt({ id: 'd4', debt_type: 'given', currency: 'USD' }),
    ];
    const groups = eligibleRepaymentGroupsForImport(debts, incomeImport);
    expect(groups.map((g) => g.debts.map((d) => d.id))).toEqual([['d1']]);
  });

  it('expense-импорт → долги taken', () => {
    const debts = [
      makeDebt({ id: 'd1', debt_type: 'given' }),
      makeDebt({ id: 'd2', debt_type: 'taken' }),
    ];
    const groups = eligibleRepaymentGroupsForImport(debts, {
      type: 'expense',
      amount: 50_000,
      currency: 'UZS',
    });
    expect(groups.map((g) => g.debts.map((d) => d.id))).toEqual([['d2']]);
  });

  it('человек с суммарным долгом из двух долгов виден при погашении суммы, равной сумме остатков', () => {
    const debts = [
      makeDebt({ id: 'd1', person_name: 'Алишер', remaining_amount: 300_000 }),
      makeDebt({ id: 'd2', person_name: 'Алишер', remaining_amount: 200_000 }),
    ];
    const groups = eligibleRepaymentGroupsForImport(debts, {
      type: 'income',
      amount: 500_000,
      currency: 'UZS',
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].personName).toBe('Алишер');
    expect(groups[0].totalRemaining).toBe(500_000);
    expect(groups[0].debts.map((d) => d.id).sort()).toEqual(['d1', 'd2']);
  });

  it('исключает группы с суммарным остатком меньше суммы импорта', () => {
    const debts = [
      makeDebt({ id: 'd1', person_name: 'Алишер', remaining_amount: 30_000 }),
      makeDebt({ id: 'd2', person_name: 'Бахтиёр', remaining_amount: 100_000 }),
    ];
    const groups = eligibleRepaymentGroupsForImport(debts, incomeImport);
    expect(groups.map((g) => g.personName)).toEqual(['Бахтиёр']);
  });

  it('остаток чуть меньше платежа (округлили вверх) — группа видна с переплатой', () => {
    const debts = [
      makeDebt({ id: 'd1', person_name: 'Нодыр', remaining_amount: 60_000 }),
      makeDebt({ id: 'd2', person_name: 'Нодыр', remaining_amount: 179_000 }),
    ];
    const groups = eligibleRepaymentGroupsForImport(debts, {
      type: 'income',
      amount: 240_000,
      currency: 'UZS',
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].totalRemaining).toBe(239_000);
    expect(groups[0].difference).toBe(1_000);
    expect(groups[0].isNearMatch).toBe(true);
  });

  it('переплата больше допуска — группа отсеивается', () => {
    const debts = [makeDebt({ id: 'd1', person_name: 'Нодыр', remaining_amount: 150_000 })];
    expect(
      eligibleRepaymentGroupsForImport(debts, {
        type: 'income',
        amount: 240_000,
        currency: 'UZS',
      }),
    ).toEqual([]);
  });

  it('близкие совпадения идут первыми', () => {
    const debts = [
      makeDebt({ id: 'd1', person_name: 'Бахтиёр', remaining_amount: 5_000_000 }),
      makeDebt({ id: 'd2', person_name: 'Нодыр', remaining_amount: 239_000 }),
    ];
    const groups = eligibleRepaymentGroupsForImport(debts, {
      type: 'income',
      amount: 240_000,
      currency: 'UZS',
    });
    expect(groups.map((g) => g.personName)).toEqual(['Нодыр', 'Бахтиёр']);
  });

  it('закрытые долги игнорируются при суммировании группы', () => {
    const debts = [
      makeDebt({ id: 'd1', person_name: 'Алишер', remaining_amount: 100_000 }),
      makeDebt({ id: 'd2', person_name: 'Алишер', remaining_amount: 400_000, is_closed: true }),
    ];
    const groups = eligibleRepaymentGroupsForImport(debts, incomeImport);
    expect(groups).toHaveLength(1);
    expect(groups[0].totalRemaining).toBe(100_000);
    expect(groups[0].debts.map((d) => d.id)).toEqual(['d1']);
  });

  it('чужая валюта отсеивается', () => {
    const debts = [makeDebt({ id: 'd1', currency: 'USD', remaining_amount: 100_000 })];
    expect(eligibleRepaymentGroupsForImport(debts, incomeImport)).toEqual([]);
  });

  it('нулевая/отсутствующая сумма → пусто', () => {
    const debts = [makeDebt({})];
    expect(
      eligibleRepaymentGroupsForImport(debts, { type: 'income', amount: null, currency: 'UZS' }),
    ).toEqual([]);
    expect(
      eligibleRepaymentGroupsForImport(debts, { type: 'income', amount: 0, currency: 'UZS' }),
    ).toEqual([]);
  });
});

describe('findRepaymentMatch', () => {
  it('единственная группа с суммарным остатком, равным сумме → матч', () => {
    const debts = [
      makeDebt({ id: 'd1', person_name: 'Алишер', remaining_amount: 100_000 }),
      makeDebt({ id: 'd2', person_name: 'Бахтиёр', remaining_amount: 200_000 }),
    ];
    const match = findMatch(debts, incomeImport);
    expect(match?.personName).toBe('Алишер');
    expect(match?.debts.map((d) => d.id)).toEqual(['d1']);
  });

  it('точный матч на группу из двух долгов (сумма долгов равна сумме импорта)', () => {
    const debts = [
      makeDebt({ id: 'd1', person_name: 'Алишер', remaining_amount: 300_000 }),
      makeDebt({ id: 'd2', person_name: 'Алишер', remaining_amount: 200_000 }),
    ];
    const match = findMatch(debts, {
      type: 'income',
      amount: 500_000,
      currency: 'UZS',
    });
    expect(match?.personName).toBe('Алишер');
    expect(match?.debts.map((d) => d.id).sort()).toEqual(['d1', 'd2']);
  });

  it('две группы с точным совпадением → нет матча (неоднозначно)', () => {
    const debts = [
      makeDebt({ id: 'd1', person_name: 'Алишер', remaining_amount: 100_000 }),
      makeDebt({ id: 'd2', person_name: 'Бахтиёр', remaining_amount: 100_000 }),
    ];
    expect(findMatch(debts, incomeImport)).toBeNull();
  });

  it('нет точного совпадения → null', () => {
    const debts = [makeDebt({ id: 'd1', remaining_amount: 150_000 })];
    expect(findMatch(debts, incomeImport)).toBeNull();
  });

  it('единственная группа с расхождением в пределах допуска → матч', () => {
    const debts = [
      makeDebt({ id: 'd1', person_name: 'Нодыр', remaining_amount: 60_000 }),
      makeDebt({ id: 'd2', person_name: 'Нодыр', remaining_amount: 179_000 }),
    ];
    const match = findMatch(debts, { type: 'income', amount: 240_000, currency: 'UZS' });
    expect(match?.personName).toBe('Нодыр');
    expect(match?.difference).toBe(1_000);
  });

  it('остаток чуть больше платежа (округлили вниз) → тоже матч', () => {
    const debts = [makeDebt({ id: 'd1', person_name: 'Нодыр', remaining_amount: 241_000 })];
    const match = findMatch(debts, { type: 'income', amount: 240_000, currency: 'UZS' });
    expect(match?.difference).toBe(-1_000);
    expect(match?.isNearMatch).toBe(true);
  });

  it('две близкие группы, одна из них точная → матч на точную', () => {
    const debts = [
      makeDebt({ id: 'd1', person_name: 'Алишер', remaining_amount: 240_000 }),
      makeDebt({ id: 'd2', person_name: 'Нодыр', remaining_amount: 239_000 }),
    ];
    const match = findMatch(debts, { type: 'income', amount: 240_000, currency: 'UZS' });
    expect(match?.personName).toBe('Алишер');
  });

  it('две близкие группы без точной → null (неоднозначно)', () => {
    const debts = [
      makeDebt({ id: 'd1', person_name: 'Алишер', remaining_amount: 239_000 }),
      makeDebt({ id: 'd2', person_name: 'Нодыр', remaining_amount: 241_000 }),
    ];
    expect(findMatch(debts, { type: 'income', amount: 240_000, currency: 'UZS' })).toBeNull();
  });
});

describe('repaymentTolerance', () => {
  it('валюта без копеек: пол — тысяча, потолок — десять тысяч', () => {
    expect(repaymentTolerance(20_000, 'UZS')).toBe(1_000);
    expect(repaymentTolerance(240_000, 'UZS')).toBe(4_800);
    expect(repaymentTolerance(5_000_000, 'UZS')).toBe(10_000);
  });

  it('валюта с копейками: пол — единица, потолок — десять', () => {
    expect(repaymentTolerance(10, 'USD')).toBe(1);
    expect(repaymentTolerance(200, 'USD')).toBe(4);
    expect(repaymentTolerance(100_000, 'USD')).toBe(10);
  });
});

describe('repaymentDifferenceLabel', () => {
  function group(difference: number, isNearMatch = true) {
    return { difference, isNearMatch, currency: 'UZS' } as Parameters<
      typeof repaymentDifferenceLabel
    >[0];
  }

  it('переплата — отдельной записью', () => {
    expect(repaymentDifferenceLabel(group(1_000))).toContain('Переплата');
  });

  it('недобор — остаток спишется', () => {
    expect(repaymentDifferenceLabel(group(-1_000))).toContain('спишется');
  });

  it('ровная сумма и частичное погашение — без подписи', () => {
    expect(repaymentDifferenceLabel(group(0))).toBeNull();
    expect(repaymentDifferenceLabel(group(-500_000, false))).toBeNull();
  });
});

describe('debtsCountLabel', () => {
  it('склоняет «долг» по числу', () => {
    expect(debtsCountLabel(1)).toBe('1 долг');
    expect(debtsCountLabel(2)).toBe('2 долга');
    expect(debtsCountLabel(5)).toBe('5 долгов');
    expect(debtsCountLabel(21)).toBe('21 долг');
  });
});
