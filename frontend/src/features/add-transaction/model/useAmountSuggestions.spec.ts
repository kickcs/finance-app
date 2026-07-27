import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useAmountSuggestions } from './useAmountSuggestions';
import type { Transaction } from '@/shared/api/database.types';

function makeTx(
  overrides: Partial<Pick<Transaction, 'type' | 'amount' | 'currency' | 'category_id'>>,
): Transaction {
  return {
    id: `tx-${Math.random()}`,
    user_id: 'user-1',
    account_id: 'acc-1',
    category_id: 'cat-transport',
    amount: 2000,
    currency: 'UZS',
    type: 'expense',
    description: null,
    date: '2025-01-01T00:00:00.000Z',
    created_at: '2025-01-01T00:00:00.000Z',
    is_debt_related: false,
    is_informational: false,
    debt_id: null,
    to_account_id: null,
    to_amount: null,
    to_currency: null,
    returned_amount: 0,
    net_amount: 2000,
    has_debt_returns: false,
    ...overrides,
  };
}

function repeat(
  overrides: Partial<Pick<Transaction, 'type' | 'amount' | 'currency' | 'category_id'>>,
  n: number,
) {
  return Array.from({ length: n }, () => makeTx(overrides));
}

describe('useAmountSuggestions', () => {
  it('возвращает суммы, встреченные хотя бы дважды, от частых к редким', () => {
    const transactions = [
      ...repeat({ amount: 25000 }, 4),
      ...repeat({ amount: 2000 }, 6),
      ...repeat({ amount: 7000 }, 2),
    ];

    const { suggestions } = useAmountSuggestions(ref(transactions), ref('expense'), ref('UZS'));

    expect(suggestions.value).toEqual([2000, 25000, 7000]);
  });

  it('отбрасывает одноразовые суммы', () => {
    const transactions = [
      ...repeat({ amount: 2000 }, 3),
      ...repeat({ amount: 25000 }, 2),
      makeTx({ amount: 999999 }),
    ];

    const { suggestions } = useAmountSuggestions(ref(transactions), ref('expense'), ref('UZS'));

    expect(suggestions.value).not.toContain(999999);
  });

  it('не показывает блок, когда набралась всего одна привычная сумма', () => {
    const transactions = [...repeat({ amount: 2000 }, 5), makeTx({ amount: 12345 })];

    const { suggestions } = useAmountSuggestions(ref(transactions), ref('expense'), ref('UZS'));

    expect(suggestions.value).toEqual([]);
  });

  it('отдаёт максимум три подсказки', () => {
    const transactions = [
      ...repeat({ amount: 1000 }, 5),
      ...repeat({ amount: 2000 }, 4),
      ...repeat({ amount: 3000 }, 3),
      ...repeat({ amount: 4000 }, 2),
    ];

    const { suggestions } = useAmountSuggestions(ref(transactions), ref('expense'), ref('UZS'));

    expect(suggestions.value).toEqual([1000, 2000, 3000]);
  });

  it('учитывает только текущий тип операции', () => {
    const transactions = [
      ...repeat({ type: 'income', amount: 5000000 }, 4),
      ...repeat({ type: 'expense', amount: 2000 }, 3),
      ...repeat({ type: 'expense', amount: 25000 }, 2),
    ];

    const { suggestions } = useAmountSuggestions(ref(transactions), ref('expense'), ref('UZS'));

    expect(suggestions.value).toEqual([2000, 25000]);
  });

  it('учитывает только текущую валюту', () => {
    const transactions = [
      ...repeat({ currency: 'USD', amount: 20 }, 4),
      ...repeat({ currency: 'UZS', amount: 2000 }, 3),
      ...repeat({ currency: 'UZS', amount: 25000 }, 2),
    ];

    const { suggestions } = useAmountSuggestions(ref(transactions), ref('expense'), ref('UZS'));

    expect(suggestions.value).toEqual([2000, 25000]);
  });

  it('при выбранной категории предпочитает суммы именно по ней', () => {
    const transactions = [
      ...repeat({ category_id: 'cat-transport', amount: 2000 }, 6),
      ...repeat({ category_id: 'cat-cafe', amount: 25000 }, 3),
      ...repeat({ category_id: 'cat-cafe', amount: 45000 }, 2),
    ];

    const { suggestions } = useAmountSuggestions(
      ref(transactions),
      ref('expense'),
      ref('UZS'),
      ref('cat-cafe'),
    );

    expect(suggestions.value).toEqual([25000, 45000]);
  });

  it('откатывается на суммы по всему типу, если внутри категории привычки не видно', () => {
    const transactions = [
      ...repeat({ category_id: 'cat-transport', amount: 2000 }, 6),
      ...repeat({ category_id: 'cat-transport', amount: 25000 }, 2),
      makeTx({ category_id: 'cat-gifts', amount: 777 }),
    ];

    const { suggestions } = useAmountSuggestions(
      ref(transactions),
      ref('expense'),
      ref('UZS'),
      ref('cat-gifts'),
    );

    expect(suggestions.value).toEqual([2000, 25000]);
  });

  it('молчит для перевода и долга — там сумма не привычка, а разовая величина', () => {
    const transactions = repeat({ amount: 2000 }, 6);

    const { suggestions } = useAmountSuggestions(ref(transactions), ref('transfer'), ref('UZS'));

    expect(suggestions.value).toEqual([]);
  });

  it('переживает пустую и незагруженную историю', () => {
    expect(useAmountSuggestions(ref([]), ref('expense'), ref('UZS')).suggestions.value).toEqual([]);
    expect(
      useAmountSuggestions(ref(undefined), ref('expense'), ref('UZS')).suggestions.value,
    ).toEqual([]);
  });
});
