import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/entities/transaction';
import { selectionTotals } from './selectionTotals';

const tx = (fields: Partial<Transaction>) =>
  ({ is_informational: false, is_debt_related: false, ...fields }) as Transaction;

describe('selectionTotals', () => {
  it('расход минус, доход плюс, по валютам', () => {
    expect(
      selectionTotals([
        tx({ type: 'expense', amount: 300, currency: 'UZS' }),
        tx({ type: 'income', amount: 1000, currency: 'UZS' }),
        tx({ type: 'expense', amount: 5, currency: 'USD' }),
      ]),
    ).toEqual([
      { currency: 'UZS', amount: 700 },
      { currency: 'USD', amount: -5 },
    ]);
  });

  // Та же таблица, что SIGNED_AMOUNT_SQL итога на сервере: разойдись они — сумма выбранного
  // вручную не совпала бы с суммой на плашке по тем же строкам.
  it.each([
    ['доход', { type: 'income' }, 100],
    ['расход', { type: 'expense' }, -100],
    ['корректировка вверх', { type: 'adjustment', is_debt_related: false }, 100],
    ['корректировка вниз', { type: 'adjustment', is_debt_related: true }, -100],
    ['перевод между своими счетами', { type: 'transfer' }, 0],
    ['информационный доход', { type: 'income', is_informational: true }, 0],
    ['информационный расход', { type: 'expense', is_informational: true }, 0],
  ] as const)('знак строки: %s', (_, fields, amount) => {
    expect(selectionTotals([tx({ ...fields, amount: 100, currency: 'UZS' })])).toEqual([
      { currency: 'UZS', amount },
    ]);
  });

  it('перевод и информационная строка не двигают итог, корректировка — по направлению', () => {
    expect(
      selectionTotals([
        tx({ type: 'transfer', amount: 500, currency: 'UZS' }),
        tx({ type: 'expense', amount: 200, currency: 'UZS', is_informational: true }),
        tx({ type: 'adjustment', amount: 50, currency: 'UZS', is_debt_related: true }),
      ]),
    ).toEqual([{ currency: 'UZS', amount: -50 }]);
  });
});
