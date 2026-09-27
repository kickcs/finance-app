import { describe, it, expect, beforeEach } from 'vitest';
import { queryClient } from '@/shared/api/queryClient';
import { transactionQueryKeys } from './queryKeys';
import { patchTransactionInCaches, removeTransactionFromCaches } from './transactionCache';
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
