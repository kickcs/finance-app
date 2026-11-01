import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Transaction } from '../model/types';
import TransactionItem from './TransactionItem.vue';

const transfer = (description: string | null): Transaction => ({
  id: 'tx-1',
  user_id: 'user-1',
  account_id: 'acc-1',
  category_id: 'transfer',
  amount: 50000,
  currency: 'UZS',
  type: 'transfer',
  description,
  date: '2026-10-30T12:00:00.000Z',
  created_at: '2026-10-30T12:00:00.000Z',
  is_debt_related: false,
  is_informational: false,
  debt_id: null,
  to_account_id: 'acc-2',
  to_amount: 50000,
  to_currency: 'UZS',
  payment_group_id: null,
  settlement_id: null,
  payment_sibling: null,
  returned_amount: 0,
  net_amount: 50000,
  has_debt_returns: false,
});

describe('TransactionItem', () => {
  it('у перевода рядом со счетами виден комментарий с тегами', () => {
    const w = mount(TransactionItem, {
      props: {
        transaction: transfer('Вклад #депозит'),
        accountName: 'Карта',
        toAccountName: 'Вклад',
      },
    });

    expect(w.text()).toContain('Карта → Вклад');
    expect(w.text()).toContain('Вклад #депозит');
  });

  it('перевод без комментария показывает только счета', () => {
    const w = mount(TransactionItem, {
      props: { transaction: transfer(null), accountName: 'Карта', toAccountName: 'Вклад' },
    });

    expect(w.text()).toContain('Карта → Вклад');
    expect(w.text()).not.toContain('·');
  });
});
