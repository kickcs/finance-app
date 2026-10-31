import { describe, it, expect, beforeEach } from 'vitest';
import { queryClient } from '@/shared/api/queryClient';
import { transactionQueryKeys } from './queryKeys';
import {
  applyTransactionUpdateToCaches,
  patchTransactionInCaches,
  prependTransactionToRecent,
  removeTransactionFromCaches,
  removeTransactionsFromCaches,
  restoreTransactionCaches,
  shrinkSummaryCaches,
  cachedFilterRows,
  snapshotTransactionCaches,
} from './transactionCache';
import type { TransactionsSummary } from './transactionsApi';
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

const SEARCH_KEY = transactionQueryKeys.infinite(USER_ID, { search: 'groceries' });

function seedSearchCache(tx: Transaction) {
  queryClient.setQueryData(SEARCH_KEY, {
    pages: [{ data: [tx], nextCursor: null, hasMore: false }],
    pageParams: [undefined],
  });
}

describe('transactionCache: search results', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  // Найденное — та же лента с фильтром `search`: правки с других экранов доходят и до неё.
  it('patches a transaction inside the cached search results', () => {
    seedSearchCache(makeTransaction({ id: 'tx-search' }));

    patchTransactionInCaches(queryClient, USER_ID, 'tx-search', { description: 'Updated' });

    const cached = queryClient.getQueryData<{ pages: { data: Transaction[] }[] }>(SEARCH_KEY);
    expect(cached?.pages[0].data[0].description).toBe('Updated');
  });

  it('removes a transaction from the cached search results', () => {
    seedSearchCache(makeTransaction({ id: 'tx-search-del' }));

    removeTransactionFromCaches(queryClient, USER_ID, 'tx-search-del');

    const cached = queryClient.getQueryData<{ pages: { data: Transaction[] }[] }>(SEARCH_KEY);
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

// ── Итог выборки на время отложенного удаления ──────────────────────────────

function makeSummary(overrides: Partial<TransactionsSummary> = {}): TransactionsSummary {
  return {
    count: 10,
    eligible_count: 9,
    locked_count: 1,
    totals: [{ currency: 'UZS', amount: -250000 }],
    as_of: '2025-06-01T12:00:00.000Z',
    ...overrides,
  };
}

const summaryKey = (filters?: Parameters<typeof transactionQueryKeys.summary>[1]) =>
  transactionQueryKeys.summary(USER_ID, filters);

describe('transactionCache: summary', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  const TAXI = { category_ids: ['taxi'] };

  it('shrinkSummaryCaches lowers only the summary of the given filter', () => {
    queryClient.setQueryData(summaryKey(TAXI), makeSummary());

    shrinkSummaryCaches(queryClient, USER_ID, TAXI, 3);

    expect(queryClient.getQueryData<TransactionsSummary>(summaryKey(TAXI))).toMatchObject({
      count: 7,
      eligible_count: 6,
      locked_count: 1,
    });
    expect(queryClient.getQueryState(summaryKey(TAXI))?.isInvalidated).toBe(false);
  });

  it('invalidates summaries of other filters instead of guessing their numbers', () => {
    const other = makeSummary({ count: 4, eligible_count: 4, locked_count: 0 });
    queryClient.setQueryData(summaryKey(TAXI), makeSummary());
    queryClient.setQueryData(summaryKey({ type: 'expense' }), other);
    queryClient.setQueryData(summaryKey(), other);

    shrinkSummaryCaches(queryClient, USER_ID, TAXI, 3);

    for (const key of [summaryKey({ type: 'expense' }), summaryKey()]) {
      expect(queryClient.getQueryData(key)).toEqual(other);
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    }
  });

  it('does not touch another user', () => {
    const foreign = transactionQueryKeys.summary('user-2', TAXI);
    queryClient.setQueryData(foreign, makeSummary());

    shrinkSummaryCaches(queryClient, USER_ID, TAXI, 3);

    expect(queryClient.getQueryData(foreign)).toEqual(makeSummary());
    expect(queryClient.getQueryState(foreign)?.isInvalidated).toBe(false);
  });

  it('keeps totals while rows remain, because the removed sum is unknown on the client', () => {
    queryClient.setQueryData(summaryKey(TAXI), makeSummary());

    shrinkSummaryCaches(queryClient, USER_ID, TAXI, 3);

    expect(queryClient.getQueryData<TransactionsSummary>(summaryKey(TAXI))?.totals).toEqual([
      { currency: 'UZS', amount: -250000 },
    ]);
  });

  it('clamps at zero and clears totals once nothing is left', () => {
    queryClient.setQueryData(
      summaryKey(TAXI),
      makeSummary({ count: 5, eligible_count: 4, locked_count: 1 }),
    );

    shrinkSummaryCaches(queryClient, USER_ID, TAXI, 50);

    expect(queryClient.getQueryData<TransactionsSummary>(summaryKey(TAXI))).toMatchObject({
      count: 0,
      eligible_count: 0,
      totals: [],
    });
  });

  it('leaves a never-loaded summary alone', () => {
    shrinkSummaryCaches(queryClient, USER_ID, TAXI, 3);

    expect(queryClient.getQueryData(summaryKey(TAXI))).toBeUndefined();
  });

  it('snapshot includes summary entries, so restore brings the old numbers back', () => {
    queryClient.setQueryData(summaryKey(), makeSummary());
    const snapshot = snapshotTransactionCaches(queryClient, USER_ID);

    shrinkSummaryCaches(queryClient, USER_ID, {}, 10);
    restoreTransactionCaches(queryClient, snapshot);

    expect(queryClient.getQueryData<TransactionsSummary>(summaryKey())).toEqual(makeSummary());
  });
});

describe('transactionCache: cachedFilterRows', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  const page = (rows: Transaction[]) => ({
    pages: [{ data: rows, nextCursor: null, hasMore: false }],
    pageParams: [undefined],
  });

  it('returns rows loaded under exactly this filter, across pages', () => {
    const filter = { category_ids: ['taxi'] };
    queryClient.setQueryData(transactionQueryKeys.infinite(USER_ID, filter), {
      pages: [
        { data: [makeTransaction({ id: 'a' })], nextCursor: null, hasMore: true },
        { data: [makeTransaction({ id: 'b' })], nextCursor: null, hasMore: false },
      ],
      pageParams: [undefined, undefined],
    });
    queryClient.setQueryData(
      transactionQueryKeys.infinite(USER_ID, {}),
      page([makeTransaction({ id: 'other' })]),
    );

    expect(cachedFilterRows(queryClient, USER_ID, filter).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('is empty while the filter has not loaded yet', () => {
    expect(cachedFilterRows(queryClient, USER_ID, { search: 'такси' })).toEqual([]);
  });
});
