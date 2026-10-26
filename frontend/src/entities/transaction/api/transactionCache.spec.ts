import { describe, it, expect, beforeEach } from 'vitest';
import { queryClient } from '@/shared/api/queryClient';
import { transactionQueryKeys } from './queryKeys';
import {
  applyTransactionUpdateToCaches,
  patchTransactionInCaches,
  prependTransactionToRecent,
  removeTransactionFromCaches,
  removeTransactionsFromCaches,
} from './transactionCache';
import type { Transaction } from '@/shared/api/database.types';

const USER_ID = 'user-1';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    user_id: USER_ID,
    account_id: 'acc-1',
    category_id: 'cat-groceries',
    amount: 25000,
    currency: 'UZS',
    type: 'expense',
    description: null,
    date: '2025-06-01T00:00:00.000Z',
    created_at: '2025-06-01T12:00:00.000Z',
    is_debt_related: false,
    is_informational: false,
    debt_id: null,
    to_account_id: null,
    to_amount: null,
    to_currency: null,
    returned_amount: 0,
    net_amount: 25000,
    has_debt_returns: false,
    payment_group_id: null,
    settlement_id: null,
    payment_sibling: null,
    ...overrides,
  };
}

function seedSearchCache(term: string, tx: Transaction) {
  queryClient.setQueryData(transactionQueryKeys.search(USER_ID, term), {
    pages: [{ data: [tx], nextCursor: null, hasMore: false }],
    pageParams: [undefined],
  });
}

describe('transactionCache: search results', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  // Поиск в Истории хранится отдельным InfiniteData той же формы, что и основной
  // список — правки из других экранов (дашборд, добавление/редактирование) должны
  // доходить и туда, иначе открытый поиск показывает устаревшую копию до инвалидации.
  it('patches a transaction inside the cached search results', () => {
    const tx = makeTransaction({ id: 'tx-search' });
    seedSearchCache('groceries', tx);

    patchTransactionInCaches(queryClient, USER_ID, 'tx-search', { description: 'Updated' });

    const cached = queryClient.getQueryData<{ pages: { data: Transaction[] }[] }>(
      transactionQueryKeys.search(USER_ID, 'groceries'),
    );
    expect(cached?.pages[0].data[0].description).toBe('Updated');
  });

  it('removes a transaction from the cached search results', () => {
    const tx = makeTransaction({ id: 'tx-search-del' });
    seedSearchCache('groceries', tx);

    removeTransactionFromCaches(queryClient, USER_ID, 'tx-search-del');

    const cached = queryClient.getQueryData<{ pages: { data: Transaction[] }[] }>(
      transactionQueryKeys.search(USER_ID, 'groceries'),
    );
    expect(cached?.pages[0].data).toEqual([]);
  });
});

// ── Оплата с двух счетов: две строки с общим payment_group_id ───────────────

function makeGroup() {
  const first = makeTransaction({
    id: 'tx-a',
    amount: 60000,
    net_amount: 60000,
    description: 'Ужин',
    payment_group_id: 'grp-1',
    payment_sibling: { id: 'tx-b', account_id: 'acc-2', amount: 40000 },
  });
  const second = makeTransaction({
    id: 'tx-b',
    account_id: 'acc-2',
    amount: 40000,
    net_amount: 40000,
    description: 'Ужин',
    payment_group_id: 'grp-1',
    payment_sibling: { id: 'tx-a', account_id: 'acc-1', amount: 60000 },
  });
  return { first, second };
}

type Pages = { pages: { data: Transaction[] }[] };

function seedGroup() {
  const { first, second } = makeGroup();
  queryClient.setQueryData(transactionQueryKeys.recent(USER_ID), [first, second]);
  queryClient.setQueryData(transactionQueryKeys.infinite(USER_ID), {
    pages: [{ data: [first, second], nextCursor: null, hasMore: false }],
    pageParams: [undefined],
  });
  return { first, second };
}

const recentIds = () =>
  queryClient.getQueryData<Transaction[]>(transactionQueryKeys.recent(USER_ID))?.map((t) => t.id);
const infiniteRows = () =>
  queryClient.getQueryData<Pages>(transactionQueryKeys.infinite(USER_ID))!.pages[0].data;

describe('transactionCache: payment group', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('removeTransactionsFromCaches drops every given id from recent and infinite lists', () => {
    seedGroup();

    removeTransactionsFromCaches(queryClient, USER_ID, ['tx-a', 'tx-b']);

    expect(recentIds()).toEqual([]);
    expect(infiniteRows()).toEqual([]);
  });

  it('removeTransactionFromCaches still removes a single row', () => {
    seedGroup();

    removeTransactionFromCaches(queryClient, USER_ID, 'tx-a');

    expect(recentIds()).toEqual(['tx-b']);
  });

  it('prependTransactionToRecent puts both parts of a group on top', () => {
    const { first } = makeGroup();
    const other = makeTransaction({ id: 'tx-old' });
    queryClient.setQueryData(transactionQueryKeys.recent(USER_ID), [other]);

    prependTransactionToRecent(queryClient, USER_ID, first);

    const recent = queryClient.getQueryData<Transaction[]>(transactionQueryKeys.recent(USER_ID))!;
    expect(recent.map((t) => t.id)).toEqual(['tx-a', 'tx-b', 'tx-old']);
    expect(recent[1]).toMatchObject({ account_id: 'acc-2', amount: 40000 });
  });

  it('prependTransactionToRecent keeps working for a single transaction', () => {
    queryClient.setQueryData(transactionQueryKeys.recent(USER_ID), []);

    prependTransactionToRecent(queryClient, USER_ID, makeTransaction({ id: 'tx-solo' }));

    expect(recentIds()).toEqual(['tx-solo']);
  });

  it('applyTransactionUpdateToCaches carries shared fields to the sibling row', () => {
    const { first } = seedGroup();

    applyTransactionUpdateToCaches(queryClient, USER_ID, first, { description: 'Обед' });

    const rows = infiniteRows();
    expect(rows.map((t) => t.description)).toEqual(['Обед', 'Обед']);
    expect(rows[1]).toMatchObject({ account_id: 'acc-2', amount: 40000 });
  });

  it('applyTransactionUpdateToCaches updates the sibling account and amount from second_part', () => {
    const { first } = seedGroup();

    applyTransactionUpdateToCaches(queryClient, USER_ID, first, {
      amount: 70000,
      second_part: { account_id: 'acc-3', amount: 30000 },
    });

    const [a, b] = infiniteRows();
    expect(a).toMatchObject({ amount: 70000, net_amount: 70000 });
    expect(a.payment_sibling).toEqual({ id: 'tx-b', account_id: 'acc-3', amount: 30000 });
    expect(b).toMatchObject({ account_id: 'acc-3', amount: 30000, net_amount: 30000 });
    expect(b.payment_sibling).toEqual({ id: 'tx-a', account_id: 'acc-1', amount: 70000 });
  });

  it('applyTransactionUpdateToCaches removes the sibling row when second_part is null', () => {
    const { first } = seedGroup();

    applyTransactionUpdateToCaches(queryClient, USER_ID, first, {
      amount: 100000,
      second_part: null,
    });

    const rows = infiniteRows();
    expect(rows.map((t) => t.id)).toEqual(['tx-a']);
    expect(rows[0]).toMatchObject({
      amount: 100000,
      net_amount: 100000,
      payment_group_id: null,
      payment_sibling: null,
    });
    expect(recentIds()).toEqual(['tx-a']);
  });

  it('applyTransactionUpdateToCaches works when editing the second part row', () => {
    const { second } = seedGroup();

    applyTransactionUpdateToCaches(queryClient, USER_ID, second, { category_id: 'cat-cafe' });

    expect(infiniteRows().map((t) => t.category_id)).toEqual(['cat-cafe', 'cat-cafe']);
  });
});
