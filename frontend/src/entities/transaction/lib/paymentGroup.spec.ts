import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/shared/api/database.types';
import {
  buildPaymentSiblingRow,
  paymentGroupIds,
  paymentTotal,
  planPaymentGroupEdit,
} from './paymentGroup';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    category_id: 'cat-food',
    amount: 60000,
    currency: 'UZS',
    type: 'expense',
    description: 'Ужин',
    date: '2025-06-01T00:00:00.000Z',
    created_at: '2025-06-01T12:00:00.000Z',
    is_debt_related: false,
    is_informational: false,
    debt_id: null,
    to_account_id: null,
    to_amount: null,
    to_currency: null,
    returned_amount: 0,
    net_amount: 60000,
    has_debt_returns: false,
    payment_group_id: null,
    settlement_id: null,
    payment_sibling: null,
    ...overrides,
  };
}

const grouped = (overrides: Partial<Transaction> = {}) =>
  makeTx({
    payment_group_id: 'grp-1',
    payment_sibling: { id: 'tx-2', account_id: 'acc-2', amount: 40000 },
    ...overrides,
  });

describe('buildPaymentSiblingRow', () => {
  it('returns null for a transaction without a sibling', () => {
    expect(buildPaymentSiblingRow(makeTx())).toBeNull();
  });

  it('copies shared fields and takes id/account/amount from payment_sibling', () => {
    const sibling = buildPaymentSiblingRow(grouped())!;
    expect(sibling).toMatchObject({
      id: 'tx-2',
      account_id: 'acc-2',
      amount: 40000,
      net_amount: 40000,
      category_id: 'cat-food',
      description: 'Ужин',
      date: '2025-06-01T00:00:00.000Z',
      currency: 'UZS',
      type: 'expense',
      payment_group_id: 'grp-1',
    });
  });

  it('points the sibling back at the first part', () => {
    expect(buildPaymentSiblingRow(grouped())!.payment_sibling).toEqual({
      id: 'tx-1',
      account_id: 'acc-1',
      amount: 60000,
    });
  });
});

describe('paymentGroupIds', () => {
  it('lists only the row itself when there is no sibling', () => {
    expect(paymentGroupIds(makeTx())).toEqual(['tx-1']);
  });

  it('lists both rows of a group', () => {
    expect(paymentGroupIds(grouped())).toEqual(['tx-1', 'tx-2']);
  });
});

describe('paymentTotal', () => {
  it('is the row amount when there is no sibling', () => {
    expect(paymentTotal(makeTx())).toBe(60000);
  });

  it('sums both parts without a float tail', () => {
    expect(paymentTotal(grouped())).toBe(100000);
    expect(
      paymentTotal(
        makeTx({ amount: 0.1, payment_sibling: { id: 'tx-2', account_id: 'acc-2', amount: 0.2 } }),
      ),
    ).toBe(0.3);
  });
});

describe('planPaymentGroupEdit', () => {
  it('never drives net_amount below zero when the amount drops under the returned share', () => {
    const plan = planPaymentGroupEdit(grouped({ returned_amount: 60000, net_amount: 0 }), {
      amount: 50000,
    });
    expect(plan.row.net_amount).toBe(0);
  });

  it('plain edit of a single row patches only the row and recomputes net_amount', () => {
    const plan = planPaymentGroupEdit(makeTx({ returned_amount: 1000 }), {
      amount: 50000,
      description: 'Новое',
    });
    expect(plan.row).toEqual({ amount: 50000, description: 'Новое', net_amount: 49000 });
    expect(plan.sibling).toBeNull();
    expect(plan.dropSibling).toBe(false);
  });

  it('carries shared fields over to the sibling when second_part is absent', () => {
    const plan = planPaymentGroupEdit(grouped(), {
      category_id: 'cat-cafe',
      description: 'Обед',
      date: '2025-06-02T00:00:00.000Z',
    });
    expect(plan.sibling).toMatchObject({
      category_id: 'cat-cafe',
      description: 'Обед',
      date: '2025-06-02T00:00:00.000Z',
    });
    expect(plan.sibling).not.toHaveProperty('amount');
    expect(plan.sibling).not.toHaveProperty('account_id');
    expect(plan.dropSibling).toBe(false);
  });

  it('does not copy row-specific fields (account, amount) to the sibling', () => {
    const plan = planPaymentGroupEdit(grouped(), { account_id: 'acc-3', amount: 55000 });
    expect(plan.sibling).not.toHaveProperty('account_id');
    expect(plan.sibling).not.toHaveProperty('amount');
    // но ссылка пары на редактируемую строку обновляется
    expect(plan.sibling!.payment_sibling).toEqual({
      id: 'tx-1',
      account_id: 'acc-3',
      amount: 55000,
    });
  });

  it('second_part object updates the existing sibling account and amount', () => {
    const plan = planPaymentGroupEdit(grouped(), {
      amount: 70000,
      second_part: { account_id: 'acc-3', amount: 30000 },
    });
    expect(plan.sibling).toMatchObject({ account_id: 'acc-3', amount: 30000, net_amount: 30000 });
    expect(plan.row.payment_sibling).toEqual({ id: 'tx-2', account_id: 'acc-3', amount: 30000 });
    expect(plan.row).not.toHaveProperty('second_part');
    expect(plan.dropSibling).toBe(false);
  });

  it('second_part on a single row links it to a pending sibling without a row to patch', () => {
    const plan = planPaymentGroupEdit(makeTx(), {
      amount: 60000,
      second_part: { account_id: 'acc-2', amount: 40000 },
    });
    expect(plan.sibling).toBeNull();
    expect(plan.dropSibling).toBe(false);
    expect(plan.row.payment_group_id).toEqual(expect.any(String));
    expect(plan.row.payment_sibling).toMatchObject({ account_id: 'acc-2', amount: 40000 });
  });

  it('second_part null drops the sibling and unlinks the row', () => {
    const plan = planPaymentGroupEdit(grouped(), { amount: 100000, second_part: null });
    expect(plan.dropSibling).toBe(true);
    expect(plan.sibling).toBeNull();
    expect(plan.row).toMatchObject({
      amount: 100000,
      net_amount: 100000,
      payment_group_id: null,
      payment_sibling: null,
    });
  });

  it('second_part null on a row without a sibling only clears the link', () => {
    const plan = planPaymentGroupEdit(makeTx(), { second_part: null });
    expect(plan.dropSibling).toBe(false);
    expect(plan.row).toMatchObject({ payment_group_id: null, payment_sibling: null });
  });
});
