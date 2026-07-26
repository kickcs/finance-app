import { describe, it, expect } from 'vitest';
import { foldDebtsByPersonName, personKey } from './foldDebtsByPersonName';
import type { Debt } from '@/shared/api/database.types';

const identity = (amount: number) => amount;

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'd1',
    user_id: 'u1',
    name: 'Долг',
    total_amount: 100,
    remaining_amount: 100,
    monthly_payment: null,
    next_payment_date: null,
    created_at: '2026-07-01T00:00:00.000Z',
    debt_type: 'given',
    person_name: 'Аня',
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
    ...overrides,
  };
}

describe('foldDebtsByPersonName', () => {
  it('складывает given плюсом, taken минусом', () => {
    const result = foldDebtsByPersonName(
      [
        makeDebt({ debt_type: 'given', remaining_amount: 300 }),
        makeDebt({ id: 'd2', debt_type: 'taken', remaining_amount: 100 }),
      ],
      identity,
    );

    expect(result.get('аня')).toEqual({ net: 200, debtCount: 2 });
  });

  it('оставляет отрицательное нетто, когда вы должны больше', () => {
    const result = foldDebtsByPersonName(
      [
        makeDebt({ debt_type: 'given', remaining_amount: 50 }),
        makeDebt({ id: 'd2', debt_type: 'taken', remaining_amount: 200 }),
      ],
      identity,
    );

    expect(result.get('аня')?.net).toBe(-150);
  });

  it('отбрасывает закрытые долги', () => {
    const result = foldDebtsByPersonName(
      [makeDebt({ is_closed: true, remaining_amount: 500 })],
      identity,
    );

    expect(result.has('аня')).toBe(false);
  });

  it('сопоставляет имена без учёта регистра и обрамляющих пробелов', () => {
    const result = foldDebtsByPersonName(
      [
        makeDebt({ person_name: '  Аня ', remaining_amount: 100 }),
        makeDebt({ id: 'd2', person_name: 'аня', remaining_amount: 50 }),
      ],
      identity,
    );

    expect(result.size).toBe(1);
    expect(result.get('аня')).toEqual({ net: 150, debtCount: 2 });
  });

  it('конвертирует валюту переданной функцией', () => {
    const convert = (amount: number, from: string) => (from === 'USD' ? amount * 12_000 : amount);

    const result = foldDebtsByPersonName(
      [makeDebt({ currency: 'USD', remaining_amount: 10 })],
      convert,
    );

    expect(result.get('аня')?.net).toBe(120_000);
  });

  it('подставляет валюту по умолчанию, когда поле пустое', () => {
    const seen: string[] = [];
    const convert = (amount: number, from: string) => {
      seen.push(from);
      return amount;
    };

    foldDebtsByPersonName([makeDebt({ currency: '' })], convert);

    expect(seen).toEqual(['UZS']);
  });

  it('пропускает долги без имени человека', () => {
    const result = foldDebtsByPersonName(
      [makeDebt({ person_name: null }), makeDebt({ id: 'd2', person_name: '   ' })],
      identity,
    );

    expect(result.size).toBe(0);
  });

  it('возвращает пустую карту на пустом входе', () => {
    expect(foldDebtsByPersonName([], identity).size).toBe(0);
  });

  it('разделяет разных людей', () => {
    const result = foldDebtsByPersonName(
      [
        makeDebt({ person_name: 'Аня', remaining_amount: 100 }),
        makeDebt({ id: 'd2', person_name: 'Борис', remaining_amount: 70 }),
      ],
      identity,
    );

    expect(result.size).toBe(2);
    expect(result.get('борис')?.net).toBe(70);
  });
});

describe('personKey', () => {
  it('нормализует регистр и пробелы', () => {
    expect(personKey('  АнЯ  ')).toBe('аня');
  });
});
