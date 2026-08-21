import { describe, it, expect } from 'vitest';
import { foldGroupsIntoPeople } from './foldGroupsIntoPeople';
import type { Debt, DebtGroupResponse } from '../model/types';

const identity = (amount: number) => amount;

function makeDebt(over: Partial<Debt> = {}): Debt {
  return {
    id: 'd1',
    user_id: 'u1',
    name: 'Долг',
    total_amount: 1000,
    remaining_amount: 1000,
    monthly_payment: null,
    next_payment_date: null,
    created_at: '2026-07-01T00:00:00.000Z',
    debt_type: 'given',
    person_name: 'Азиз',
    account_id: 'acc-1',
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
    ...over,
  };
}

function group(personName: string, debtType: 'given' | 'taken', debts: Debt[]): DebtGroupResponse {
  return { person_name: personName, debt_type: debtType, debts };
}

function daysAgoISODate(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('foldGroupsIntoPeople', () => {
  it('сворачивает встречные долги одного человека в нетто', () => {
    const result = foldGroupsIntoPeople(
      [
        group('Азиз', 'given', [makeDebt({ id: 'a', remaining_amount: 3000 })]),
        group('Азиз', 'taken', [makeDebt({ id: 'b', remaining_amount: 500, debt_type: 'taken' })]),
      ],
      identity,
    );

    expect(result).toHaveLength(1);
    expect(result[0].personName).toBe('Азиз');
    expect(result[0].net).toBe(2500);
    expect(result[0].direction).toBe('given');
    expect(result[0].debtCount).toBe(2);
  });

  it('даёт отрицательный нетто и направление taken, когда должен пользователь', () => {
    const result = foldGroupsIntoPeople(
      [group('Мадина', 'taken', [makeDebt({ debt_type: 'taken', remaining_amount: 1750 })])],
      identity,
    );

    expect(result[0].net).toBe(-1750);
    expect(result[0].direction).toBe('taken');
  });

  it('конвертирует валюты через переданный convert', () => {
    const convert = (amount: number, currency: string) =>
      currency === 'USD' ? amount * 12000 : amount;

    const result = foldGroupsIntoPeople(
      [group('Жасур', 'given', [makeDebt({ currency: 'USD', remaining_amount: 100 })])],
      convert,
    );

    expect(result[0].net).toBe(1_200_000);
  });

  it('считает дни просрочки по самому просроченному долгу', () => {
    const result = foldGroupsIntoPeople(
      [
        group('Мадина', 'given', [
          makeDebt({ id: 'a', next_payment_date: daysAgoISODate(4) }),
          makeDebt({ id: 'b', next_payment_date: daysAgoISODate(1) }),
        ]),
      ],
      identity,
    );

    expect(result[0].overdueDays).toBe(4);
    expect(result[0].nearestDueDate).toBe(daysAgoISODate(4));
  });

  it('оставляет overdueDays пустым, когда срок ещё не наступил', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = foldGroupsIntoPeople(
      [group('Азиз', 'given', [makeDebt({ next_payment_date: future })])],
      identity,
    );

    expect(result[0].overdueDays).toBeNull();
    expect(result[0].nearestDueDate).toBe(future);
  });

  it('поднимает просроченных наверх, остальных сортирует по убыванию суммы', () => {
    const result = foldGroupsIntoPeople(
      [
        group('Богатый', 'given', [makeDebt({ id: 'x', remaining_amount: 9000 })]),
        group('Просрочивший', 'given', [
          makeDebt({ id: 'y', remaining_amount: 100, next_payment_date: daysAgoISODate(2) }),
        ]),
        group('Средний', 'given', [makeDebt({ id: 'z', remaining_amount: 5000 })]),
      ],
      identity,
    );

    expect(result.map((p) => p.personName)).toEqual(['Просрочивший', 'Богатый', 'Средний']);
  });

  it('помечает человека приватным, если хотя бы один долг скрыт', () => {
    const result = foldGroupsIntoPeople(
      [group('Азиз', 'given', [makeDebt({ id: 'a' }), makeDebt({ id: 'b', is_private: true })])],
      identity,
    );

    expect(result[0].hasPrivate).toBe(true);
  });

  it('собирает встречную позицию с суммой зачёта по меньшей стороне', () => {
    const result = foldGroupsIntoPeople(
      [
        group('Эрмурат', 'given', [makeDebt({ id: 'a', remaining_amount: 30381 })]),
        group('Эрмурат', 'taken', [
          makeDebt({ id: 'b', remaining_amount: 137170, debt_type: 'taken' }),
        ]),
      ],
      identity,
    );

    expect(result[0].mutual).toEqual([
      { currency: 'UZS', given: 30381, taken: 137170, offsetAmount: 30381 },
    ]);
    expect(result[0].offsetTotal).toBe(30381);
  });

  it('не считает встречной позицию с одной стороной', () => {
    const result = foldGroupsIntoPeople(
      [group('Азиз', 'given', [makeDebt({ id: 'a', remaining_amount: 3000 })])],
      identity,
    );

    expect(result[0].mutual).toEqual([]);
    expect(result[0].offsetTotal).toBe(0);
  });

  it('не зачитывает разные валюты друг против друга', () => {
    const convert = (amount: number, currency: string) =>
      currency === 'USD' ? amount * 12000 : amount;

    const result = foldGroupsIntoPeople(
      [
        group('Жасур', 'given', [makeDebt({ id: 'a', currency: 'USD', remaining_amount: 100 })]),
        group('Жасур', 'taken', [
          makeDebt({ id: 'b', currency: 'UZS', remaining_amount: 500000, debt_type: 'taken' }),
        ]),
      ],
      convert,
    );

    expect(result[0].mutual).toEqual([]);
  });

  it('складывает несколько долгов одной стороны внутри валюты', () => {
    const result = foldGroupsIntoPeople(
      [
        group('Азиз', 'given', [
          makeDebt({ id: 'a', remaining_amount: 200 }),
          makeDebt({ id: 'b', remaining_amount: 300 }),
        ]),
        group('Азиз', 'taken', [makeDebt({ id: 'c', remaining_amount: 900, debt_type: 'taken' })]),
      ],
      identity,
    );

    expect(result[0].mutual).toEqual([
      { currency: 'UZS', given: 500, taken: 900, offsetAmount: 500 },
    ]);
  });

  it('сортирует встречные валюты по убыванию зачёта и суммирует его в валюте пользователя', () => {
    const convert = (amount: number, currency: string) =>
      currency === 'USD' ? amount * 12000 : amount;

    const result = foldGroupsIntoPeople(
      [
        group('Жасур', 'given', [
          makeDebt({ id: 'a', currency: 'UZS', remaining_amount: 50000 }),
          makeDebt({ id: 'b', currency: 'USD', remaining_amount: 100 }),
        ]),
        group('Жасур', 'taken', [
          makeDebt({ id: 'c', currency: 'UZS', remaining_amount: 80000, debt_type: 'taken' }),
          makeDebt({ id: 'd', currency: 'USD', remaining_amount: 40, debt_type: 'taken' }),
        ]),
      ],
      convert,
    );

    expect(result[0].mutual.map((m) => m.currency)).toEqual(['USD', 'UZS']);
    expect(result[0].offsetTotal).toBe(50000 + 40 * 12000);
  });

  it('не падает на пустом списке групп', () => {
    expect(foldGroupsIntoPeople([], identity)).toEqual([]);
  });
});
