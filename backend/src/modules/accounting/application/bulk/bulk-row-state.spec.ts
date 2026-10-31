import { snapshotRow, sameRowState, undoBalanceDeltas } from './bulk-row-state';
import type { BulkUndoRow, BulkUndoRowState } from './bulk-undo.token';
import { Transaction } from '../../domain/aggregates/transaction';

const expense: BulkUndoRowState = {
  categoryId: 'groceries',
  accountId: 'acc-a',
  amount: 60,
  currency: 'UZS',
  description: null,
  type: 'expense',
  toAccountId: null,
  toAmount: null,
  toCurrency: null,
  paymentGroupId: 'group-1',
  isDebtRelated: false,
};

const asTransfer = (state: BulkUndoRowState, toAccountId: string): BulkUndoRowState => ({
  ...state,
  type: 'transfer',
  categoryId: 'transfer',
  toAccountId,
  toAmount: state.amount,
  toCurrency: state.currency,
  paymentGroupId: null,
});

describe('undoBalanceDeltas', () => {
  it('смена категории остатки не двигает', () => {
    const row: BulkUndoRow = {
      id: 't1',
      before: expense,
      after: { ...expense, categoryId: 'transport' },
    };

    expect(undoBalanceDeltas([row])).toEqual([]);
  });

  it('расход, ставший переводом: отмена списывает деньги со счёта-получателя, источник не трогает', () => {
    const rows: BulkUndoRow[] = [
      { id: 't1', before: expense, after: asTransfer(expense, 'acc-c') },
      {
        id: 't2',
        before: { ...expense, accountId: 'acc-b', amount: 40 },
        after: asTransfer({ ...expense, accountId: 'acc-b', amount: 40 }, 'acc-c'),
      },
    ];

    expect(undoBalanceDeltas(rows)).toEqual([{ accountId: 'acc-c', currency: 'UZS', delta: -100 }]);
  });

  it('смена счёта: деньги возвращаются на прежний счёт', () => {
    const row: BulkUndoRow = {
      id: 't1',
      before: expense,
      after: { ...expense, accountId: 'acc-b' },
    };

    expect(undoBalanceDeltas([row])).toEqual([
      { accountId: 'acc-a', currency: 'UZS', delta: -60 },
      { accountId: 'acc-b', currency: 'UZS', delta: 60 },
    ]);
  });

  it('доход при смене счёта зеркален расходу', () => {
    const income = { ...expense, type: 'income', paymentGroupId: null };
    const row: BulkUndoRow = { id: 't1', before: income, after: { ...income, accountId: 'acc-b' } };

    expect(undoBalanceDeltas([row])).toEqual([
      { accountId: 'acc-a', currency: 'UZS', delta: 60 },
      { accountId: 'acc-b', currency: 'UZS', delta: -60 },
    ]);
  });

  it('копейки не накапливают дробную ошибку', () => {
    const cheap = { ...expense, amount: 0.1, paymentGroupId: null };
    const rows: BulkUndoRow[] = [1, 2, 3].map((n) => ({
      id: `t${n}`,
      before: cheap,
      after: { ...cheap, accountId: 'acc-b' },
    }));

    expect(undoBalanceDeltas(rows)).toEqual([
      { accountId: 'acc-a', currency: 'UZS', delta: -0.3 },
      { accountId: 'acc-b', currency: 'UZS', delta: 0.3 },
    ]);
  });
});

describe('snapshotRow / sameRowState', () => {
  it('снимок строки равен сам себе и отличается при смене любого поля', () => {
    const transaction = Transaction.createExpense(
      't1',
      'user',
      'acc-a',
      'groceries',
      60,
      'UZS',
      new Date('2026-10-15T12:00:00Z'),
      'Покупка',
    );

    const state = snapshotRow(transaction);

    expect(state).toMatchObject({
      categoryId: 'groceries',
      accountId: 'acc-a',
      amount: 60,
      currency: 'UZS',
      description: 'Покупка',
      type: 'expense',
      paymentGroupId: null,
      isDebtRelated: false,
    });
    expect(sameRowState(state, snapshotRow(transaction))).toBe(true);
    for (const key of Object.keys(state) as (keyof BulkUndoRowState)[]) {
      const changed = { ...state, [key]: state[key] === 'x' ? 'y' : 'x' };
      expect(sameRowState(state, changed as BulkUndoRowState)).toBe(false);
    }
  });
});
