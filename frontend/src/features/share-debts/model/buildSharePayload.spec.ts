import { describe, it, expect } from 'vitest';
import { buildSharePayload, selectShareableDebts } from './buildSharePayload';
import type { Debt } from '@/entities/debt';

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'debt-1',
    user_id: 'user-1',
    name: 'Долг от Алексей',
    total_amount: 50000,
    remaining_amount: 30000,
    monthly_payment: null,
    next_payment_date: null,
    created_at: '2026-01-15T12:00:00.000Z',
    debt_type: 'given',
    person_name: 'Алексей',
    account_id: 'acc-1',
    transaction_id: 'tx-1',
    close_transaction_id: null,
    is_closed: false,
    currency: 'UZS',
    source_transaction_id: null,
    description: null,
    closed_at: null,
    forgiven_amount: 0,
    is_private: false,
    fee_amount: 0,
    ...overrides,
  } as Debt;
}

/** Курс-заглушка: USD вдесятеро дороже UZS, остальное — как есть. */
const convert = (amount: number, from: string) => (from === 'USD' ? amount * 10 : amount);

const baseInput = {
  personName: 'Алексей',
  currency: 'UZS',
  ownerName: 'Владелец',
  convert,
  now: Date.UTC(2026, 7, 31),
};

describe('selectShareableDebts', () => {
  it('выкидывает приватные долги', () => {
    const debts = [makeDebt({ id: 'a' }), makeDebt({ id: 'b', is_private: true })];
    expect(selectShareableDebts(debts).map((d) => d.id)).toEqual(['a']);
  });

  it('выкидывает закрытые долги', () => {
    const debts = [makeDebt({ id: 'a' }), makeDebt({ id: 'b', is_closed: true })];
    expect(selectShareableDebts(debts).map((d) => d.id)).toEqual(['a']);
  });
});

describe('buildSharePayload', () => {
  it('не пускает приватный долг ни в список, ни в итог', () => {
    const payload = buildSharePayload({
      ...baseInput,
      debts: [
        makeDebt({ id: 'a', remaining_amount: 30000 }),
        makeDebt({ id: 'b', remaining_amount: 999999, is_private: true }),
      ],
    });

    expect(payload.debts).toHaveLength(1);
    expect(payload.totalGiven).toBe(30000);
    expect(payload.net).toBe(30000);
    expect(JSON.stringify(payload)).not.toContain('999999');
  });

  it('считает нетто со знаком: given плюсом, taken минусом', () => {
    const payload = buildSharePayload({
      ...baseInput,
      debts: [
        makeDebt({ id: 'a', debt_type: 'given', remaining_amount: 30000 }),
        makeDebt({ id: 'b', debt_type: 'taken', remaining_amount: 50000 }),
      ],
    });

    expect(payload.totalGiven).toBe(30000);
    expect(payload.totalTaken).toBe(50000);
    expect(payload.net).toBe(-20000);
  });

  it('сводит валюты к валюте итога, но в строках оставляет исходную', () => {
    const payload = buildSharePayload({
      ...baseInput,
      debts: [makeDebt({ id: 'a', currency: 'USD', remaining_amount: 100 })],
    });

    expect(payload.totalGiven).toBe(1000);
    expect(payload.debts[0].currency).toBe('USD');
    expect(payload.debts[0].remainingAmount).toBe(100);
  });

  it('раскладывает долг на отданное и остаток, не считая прощённое отданным', () => {
    const payload = buildSharePayload({
      ...baseInput,
      debts: [
        makeDebt({
          total_amount: 50000,
          remaining_amount: 20000,
          forgiven_amount: 10000,
        }),
      ],
    });

    expect(payload.debts[0].paidAmount).toBe(20000);
    expect(payload.debts[0].forgivenAmount).toBe(10000);
    expect(payload.debts[0].remainingAmount).toBe(20000);
    expect(payload.debts[0].totalAmount).toBe(50000);
  });

  it('три части долга в сумме дают его полную сумму', () => {
    const payload = buildSharePayload({
      ...baseInput,
      debts: [makeDebt({ total_amount: 50000, remaining_amount: 20000, forgiven_amount: 10000 })],
    });

    const { paidAmount, forgivenAmount, remainingAmount, totalAmount } = payload.debts[0];
    expect(paidAmount + forgivenAmount + remainingAmount).toBe(totalAmount);
  });

  it('на пустом списке отдаёт нулевой итог, а не падает', () => {
    const payload = buildSharePayload({ ...baseInput, debts: [] });

    expect(payload.debts).toEqual([]);
    expect(payload.net).toBe(0);
    expect(payload.personName).toBe('Алексей');
    expect(payload.snapshotAt).toBe(baseInput.now);
  });

  it('переносит срок возврата в снимок', () => {
    const payload = buildSharePayload({
      ...baseInput,
      debts: [makeDebt({ next_payment_date: '2026-09-14' })],
    });

    expect(payload.debts[0].dueDate).toBe('2026-09-14');
  });
});
