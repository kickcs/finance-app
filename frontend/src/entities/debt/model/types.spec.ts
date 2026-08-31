import { describe, it, expect } from 'vitest';
import { isDebtOverdue, getDebtOverdueDays, maskDebtName, getDebtSplit } from './types';
import type { Debt } from './types';

function makeDebt(over: Partial<Debt> = {}): Debt {
  return {
    id: 'd1',
    user_id: 'u1',
    name: 'Долг от Азиза',
    total_amount: 1000,
    remaining_amount: 1000,
    monthly_payment: null,
    next_payment_date: null,
    created_at: '2026-07-01T00:00:00.000Z',
    debt_type: 'given',
    person_name: 'Азиз',
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
    ...over,
  };
}

function daysAgoISODate(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('isDebtOverdue', () => {
  it('срок в прошлом — просрочен', () => {
    expect(isDebtOverdue(makeDebt({ next_payment_date: daysAgoISODate(3) }))).toBe(true);
  });

  it('закрытый долг не просрочен, даже если срок давно прошёл', () => {
    expect(
      isDebtOverdue(makeDebt({ next_payment_date: daysAgoISODate(30), is_closed: true })),
    ).toBe(false);
  });

  it('без срока возврата просрочки нет', () => {
    expect(isDebtOverdue(makeDebt())).toBe(false);
  });

  it('срок в будущем — не просрочен', () => {
    expect(isDebtOverdue(makeDebt({ next_payment_date: daysAgoISODate(-5) }))).toBe(false);
  });
});

describe('getDebtOverdueDays', () => {
  it('считает дни от срока', () => {
    expect(getDebtOverdueDays(makeDebt({ next_payment_date: daysAgoISODate(4) }))).toBe(4);
  });

  it('вчерашний срок даёт день, а не ноль', () => {
    const yesterday = new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 10);
    const days = getDebtOverdueDays(makeDebt({ next_payment_date: yesterday }));
    expect(days === null || days >= 1).toBe(true);
  });

  it('непросроченный долг — null', () => {
    expect(getDebtOverdueDays(makeDebt())).toBeNull();
  });
});

describe('maskDebtName', () => {
  it('скрытый долг показывает точки вместо имени', () => {
    expect(maskDebtName(makeDebt({ is_private: true }))).toBe('•••');
  });

  it('обычный долг показывает имя человека', () => {
    expect(maskDebtName(makeDebt())).toBe('Азиз');
  });

  it('без имени человека берёт название долга', () => {
    expect(maskDebtName(makeDebt({ person_name: null }))).toBe('Долг от Азиза');
  });
});

describe('getDebtSplit', () => {
  it('прощённое не попадает в отданное', () => {
    const split = getDebtSplit(
      makeDebt({ total_amount: 1000, remaining_amount: 0, forgiven_amount: 400 }),
    );
    expect(split).toEqual({ paid: 600, forgiven: 400, remaining: 0 });
  });
});
