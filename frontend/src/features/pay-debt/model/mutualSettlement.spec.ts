import { describe, it, expect } from 'vitest';
import { makeDebt } from '@/test/fixtures/debt';
import {
  canSettleTogether,
  hasBothDirections,
  planMutualSettlement,
  remainingAfterOffset,
} from './mutualSettlement';

const given = (id: string, amount: number, created_at: string, currency = 'UZS') =>
  makeDebt({ id, debt_type: 'given', remaining_amount: amount, created_at, currency });
const taken = (id: string, amount: number, created_at: string, currency = 'UZS') =>
  makeDebt({ id, debt_type: 'taken', remaining_amount: amount, created_at, currency });

describe('planMutualSettlement', () => {
  it('случай со скриншота: 476 104 вам и 100 000 ваших сводятся к 376 104 в вашу пользу', () => {
    const debts = [
      taken('t', 100_000, '2026-10-01'),
      given('g1', 229_954, '2026-09-01'),
      given('g2', 84_000, '2026-09-10'),
      given('g3', 162_150, '2026-09-20'),
    ];
    const plan = planMutualSettlement(debts);

    expect(plan).toMatchObject({ direction: 'given', offsetAmount: 100_000, net: 376_104 });
    // Как и сервер, зачёт гасит самые старые долги первыми.
    expect(Object.fromEntries(plan.offsetById)).toEqual({ g1: 100_000, t: 100_000 });
    expect(remainingAfterOffset(plan, debts[1])).toBe(129_954);
    expect(remainingAfterOffset(plan, debts[0])).toBe(0);
  });

  it('перевес на вашей стороне — остаток «вы должны»', () => {
    const plan = planMutualSettlement([given('g', 30, '2026-01-01'), taken('t', 50, '2026-01-02')]);
    expect(plan).toMatchObject({ direction: 'taken', offsetAmount: 30, net: 20 });
  });

  it('у долгов одной стороны зачёта нет, остаток — их сумма', () => {
    const plan = planMutualSettlement([given('a', 10, '2026-01-01'), given('b', 20, '2026-01-02')]);
    expect(plan).toMatchObject({ direction: 'given', offsetAmount: 0, net: 30 });
    expect(plan.offsetById.size).toBe(0);
  });

  it('копейки не оставляют хвоста после зачёта', () => {
    const debts = [
      given('g', 0.3, '2026-01-01'),
      taken('a', 0.1, '2026-01-02'),
      taken('b', 0.2, '2026-01-03'),
    ];
    const plan = planMutualSettlement(debts);
    expect(plan.net).toBe(0);
    expect(debts.map((d) => remainingAfterOffset(plan, d))).toEqual([0, 0, 0]);
  });
});

describe('canSettleTogether', () => {
  it('одно направление — можно в любых валютах', () => {
    expect(
      canSettleTogether([given('a', 1, '2026-01-01', 'UZS'), given('b', 1, '2026-01-02', 'USD')]),
    ).toBe(true);
  });

  it('встречные — только в одной валюте', () => {
    expect(canSettleTogether([given('a', 1, '2026-01-01'), taken('b', 1, '2026-01-02')])).toBe(
      true,
    );
    expect(
      canSettleTogether([given('a', 1, '2026-01-01', 'UZS'), taken('b', 1, '2026-01-02', 'USD')]),
    ).toBe(false);
  });

  it('встречные — только у одного человека', () => {
    const other = { ...taken('b', 1, '2026-01-02'), person_name: 'Другой' };
    expect(canSettleTogether([given('a', 1, '2026-01-01'), other])).toBe(false);
  });

  it('hasBothDirections видит обе стороны', () => {
    expect(hasBothDirections([given('a', 1, '2026-01-01')])).toBe(false);
    expect(hasBothDirections([given('a', 1, '2026-01-01'), taken('b', 1, '2026-01-02')])).toBe(
      true,
    );
  });
});
