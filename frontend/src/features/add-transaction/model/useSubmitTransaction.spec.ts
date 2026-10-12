import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useSubmitTransaction } from './useSubmitTransaction';
import { mockTransactionResponse } from '@/test/mocks/handlers/transactions';
import { queryClient } from '@/shared/api/queryClient';
import { transactionQueryKeys } from '@/entities/transaction';
import { accountQueryKeys } from '@/entities/account';
import type { Transaction, AccountWithBalances } from '@/shared/api/database.types';
import type { TransactionFormData } from './useTransactionForm';

// ── Mocks ──────────────────────────────────────────────────────────────────

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('@/shared/ui', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  return { ...orig, useToast: () => ({ toast: toastMock }) };
});

vi.mock('@/shared/api/invalidation', () => ({
  invalidateTransactionRelated: vi.fn().mockResolvedValue(undefined),
  invalidateAccountRelated: vi.fn().mockResolvedValue(undefined),
  invalidateDebtRelated: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

const USER_ID = mockUser.id;

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable() {
  let result!: ReturnType<typeof useSubmitTransaction>;
  const Stub = defineComponent({
    setup() {
      result = useSubmitTransaction();
      return () => h('div');
    },
  });
  // Пробрасываем singleton-клиент явно: иначе composable мутирует cache
  // тестового QueryClient из renderWithProviders, а спека проверяет singleton.
  currentWrapper = renderWithProviders(Stub, { provideAuth: { user: mockUser }, queryClient });
  return result;
}

function makeAccount(overrides: Partial<AccountWithBalances> = {}): AccountWithBalances {
  return {
    id: 'acc-1',
    user_id: USER_ID,
    name: 'Карта',
    type: 'debit_card',
    icon: null,
    color: null,
    is_archived: false,
    created_at: '2025-01-01T00:00:00.000Z',
    balances: [{ currency: 'UZS', balance: 100000 }],
    ...overrides,
  } as AccountWithBalances;
}

function makeFormData(overrides: Partial<TransactionFormData> = {}): TransactionFormData {
  return {
    accountId: 'acc-1',
    categoryId: 'cat-groceries',
    amount: 15000,
    currency: 'UZS',
    type: 'expense',
    description: '',
    date: Date.now(),
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
    feeAmount: 0,
    feeType: 'fixed',
    secondPart: null,
    ...overrides,
  };
}

describe('useSubmitTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    server.use(http.post('*/api/transactions', () => HttpResponse.json(mockTransactionResponse)));
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
    queryClient.clear();
  });

  it('does not leak the optimistic row into an unrelated account infinite list', async () => {
    queryClient.setQueryData(transactionQueryKeys.infiniteByAccount('acc-1'), {
      pages: [{ data: [], nextCursor: null, hasMore: false }],
      pageParams: [undefined],
    });
    queryClient.setQueryData(transactionQueryKeys.infiniteByAccount('acc-other'), {
      pages: [{ data: [], nextCursor: null, hasMore: false }],
      pageParams: [undefined],
    });

    const c = mountComposable();
    c.submit(USER_ID, makeFormData({ accountId: 'acc-1' }));

    const ownList = queryClient.getQueryData<{ pages: { data: Transaction[] }[] }>(
      transactionQueryKeys.infiniteByAccount('acc-1'),
    );
    const otherList = queryClient.getQueryData<{ pages: { data: Transaction[] }[] }>(
      transactionQueryKeys.infiniteByAccount('acc-other'),
    );

    expect(ownList?.pages[0].data).toHaveLength(1);
    expect(otherList?.pages[0].data).toHaveLength(0);

    await flushPromises();
  });

  it('optimistically debits the account balance for an expense', async () => {
    queryClient.setQueryData(accountQueryKeys.list(USER_ID), [makeAccount()]);

    const c = mountComposable();
    c.submit(USER_ID, makeFormData({ accountId: 'acc-1', amount: 15000, type: 'expense' }));

    await vi.waitFor(() => {
      const accounts = queryClient.getQueryData<AccountWithBalances[]>(
        accountQueryKeys.list(USER_ID),
      );
      expect(accounts?.[0].balances[0].balance).toBe(85000);
    });

    await flushPromises();
  });

  it('prepends the optimistic transaction to the recent list', async () => {
    queryClient.setQueryData(transactionQueryKeys.recent(USER_ID), []);

    const c = mountComposable();
    c.submit(USER_ID, makeFormData());

    const recent = queryClient.getQueryData<Transaction[]>(transactionQueryKeys.recent(USER_ID));
    expect(recent).toHaveLength(1);
    expect(recent?.[0].amount).toBe(15000);

    await flushPromises();
  });

  // ── Оплата с двух счетов ─────────────────────────────────────────────────

  describe('payment group (second part)', () => {
    const TOTAL = 100000;
    const SECOND = { accountId: 'acc-2', amount: 40000 };

    function groupForm(overrides: Partial<TransactionFormData> = {}) {
      return makeFormData({ amount: TOTAL, secondPart: SECOND, ...overrides });
    }

    function seedAccounts() {
      queryClient.setQueryData(accountQueryKeys.list(USER_ID), [
        makeAccount({ id: 'acc-1' }),
        makeAccount({ id: 'acc-2', balances: [{ currency: 'UZS', balance: 70000 }] } as never),
      ]);
    }

    const balances = () =>
      queryClient
        .getQueryData<AccountWithBalances[]>(accountQueryKeys.list(USER_ID))!
        .map((a) => a.balances[0].balance);

    async function captureCreateBody(run: () => void | Promise<void>) {
      let body: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(mockTransactionResponse);
        }),
      );
      await run();
      await vi.waitFor(() => expect(body).not.toBeNull());
      return body as unknown as Record<string, unknown>;
    }

    it('sends the first part as amount and the second as secondPart', async () => {
      const c = mountComposable();
      const body = await captureCreateBody(() => c.submit(USER_ID, groupForm()));

      expect(body.amount).toBe(60000);
      expect(body.accountId).toBe('acc-1');
      expect(body.secondPart).toEqual({ accountId: 'acc-2', amount: 40000 });
      await flushPromises();
    });

    it('sends the full total and no secondPart without a second part', async () => {
      const c = mountComposable();
      const body = await captureCreateBody(() =>
        c.submit(USER_ID, makeFormData({ amount: TOTAL })),
      );

      expect(body.amount).toBe(TOTAL);
      expect(body).not.toHaveProperty('secondPart');
      await flushPromises();
    });

    it('ignores a leftover second part on a transfer', async () => {
      const c = mountComposable();
      const body = await captureCreateBody(() =>
        c.submit(
          USER_ID,
          groupForm({ type: 'transfer', toAccountId: 'acc-2', toAmount: TOTAL, toCurrency: 'UZS' }),
        ),
      );

      expect(body.amount).toBe(TOTAL);
      expect(body).not.toHaveProperty('secondPart');
      await flushPromises();
    });

    it('debits both accounts by their own part for an expense', async () => {
      seedAccounts();
      const c = mountComposable();
      c.submit(USER_ID, groupForm());

      expect(balances()).toEqual([100000 - 60000, 70000 - 40000]);
      await flushPromises();
    });

    it('credits both accounts by their own part for an income', async () => {
      seedAccounts();
      const c = mountComposable();
      c.submit(USER_ID, groupForm({ type: 'income' }));

      expect(balances()).toEqual([100000 + 60000, 70000 + 40000]);
      await flushPromises();
    });

    it('counts the whole total once in monthly stats', async () => {
      const date = new Date();
      queryClient.setQueryData(
        transactionQueryKeys.monthlyStats(USER_ID, date.getFullYear(), date.getMonth() + 1),
        {
          total_income: 0,
          total_expense: 1000,
          income_by_currency: {},
          expense_by_currency: { UZS: 1000 },
        },
      );
      const c = mountComposable();
      c.submit(USER_ID, groupForm({ date: date.getTime() }));

      const stats = queryClient.getQueryData<{ total_expense: number }>(
        transactionQueryKeys.monthlyStats(USER_ID, date.getFullYear(), date.getMonth() + 1),
      );
      expect(stats?.total_expense).toBe(1000 + TOTAL);
      await flushPromises();
    });

    it('prepends both rows to recent, linked to each other', async () => {
      queryClient.setQueryData(transactionQueryKeys.recent(USER_ID), []);
      const c = mountComposable();
      c.submit(USER_ID, groupForm());

      const recent = queryClient.getQueryData<Transaction[]>(transactionQueryKeys.recent(USER_ID))!;
      expect(recent).toHaveLength(2);
      const [a, b] = recent;
      expect(a).toMatchObject({ account_id: 'acc-1', amount: 60000, net_amount: 60000 });
      expect(b).toMatchObject({ account_id: 'acc-2', amount: 40000, net_amount: 40000 });
      expect(a.payment_group_id).toBeTruthy();
      expect(b.payment_group_id).toBe(a.payment_group_id);
      expect(a.payment_sibling).toMatchObject({ id: b.id, account_id: 'acc-2', amount: 40000 });
      expect(b.payment_sibling).toMatchObject({ id: a.id, account_id: 'acc-1', amount: 60000 });
      await flushPromises();
    });

    it('does not leak the optimistic second-part field into the cached row', async () => {
      queryClient.setQueryData(transactionQueryKeys.recent(USER_ID), []);
      const c = mountComposable();
      c.submit(USER_ID, groupForm());

      const recent = queryClient.getQueryData<Transaction[]>(transactionQueryKeys.recent(USER_ID))!;
      expect(recent[0]).not.toHaveProperty('second_part');
      await flushPromises();
    });

    it('puts each part only into its own account infinite list', async () => {
      for (const id of ['acc-1', 'acc-2']) {
        queryClient.setQueryData(transactionQueryKeys.infiniteByAccount(id), {
          pages: [{ data: [], nextCursor: null, hasMore: false }],
          pageParams: [undefined],
        });
      }
      const c = mountComposable();
      c.submit(USER_ID, groupForm());

      const rows = (id: string) =>
        queryClient.getQueryData<{ pages: { data: Transaction[] }[] }>(
          transactionQueryKeys.infiniteByAccount(id),
        )!.pages[0].data;
      expect(rows('acc-1').map((t) => t.amount)).toEqual([60000]);
      expect(rows('acc-2').map((t) => t.amount)).toEqual([40000]);
      await flushPromises();
    });

    it('rolls back balances and both rows when the server rejects', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 }),
        ),
      );
      seedAccounts();
      queryClient.setQueryData(transactionQueryKeys.recent(USER_ID), []);
      const c = mountComposable();
      c.submit(USER_ID, groupForm());
      await vi.waitFor(() => expect(toastMock).toHaveBeenCalled());

      expect(balances()).toEqual([100000, 70000]);
      expect(queryClient.getQueryData(transactionQueryKeys.recent(USER_ID))).toEqual([]);
    });

    it('submitAndWait sends the same payload and returns the first part id', async () => {
      const c = mountComposable();
      const idPromise = c.submitAndWait(USER_ID, groupForm());

      await expect(idPromise).resolves.toBe(mockTransactionResponse.id);
    });

    it('rollbackTransaction drops both rows from the caches', async () => {
      server.use(
        http.delete('*/api/transactions/:id', () => new HttpResponse(null, { status: 204 })),
      );
      queryClient.setQueryData(transactionQueryKeys.recent(USER_ID), [
        groupRow('tx-a', 'acc-1', 60000, { id: 'tx-b', account_id: 'acc-2', amount: 40000 }),
        groupRow('tx-b', 'acc-2', 40000, { id: 'tx-a', account_id: 'acc-1', amount: 60000 }),
      ]);
      const c = mountComposable();

      const ok = await c.rollbackTransaction('tx-a', USER_ID, 'tx-b');

      expect(ok).toBe(true);
      expect(queryClient.getQueryData(transactionQueryKeys.recent(USER_ID))).toEqual([]);
    });
  });
});

function groupRow(
  id: string,
  accountId: string,
  amount: number,
  sibling: Transaction['payment_sibling'],
): Transaction {
  return {
    id,
    user_id: USER_ID,
    account_id: accountId,
    category_id: 'cat-groceries',
    amount,
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
    net_amount: amount,
    has_debt_returns: false,
    payment_group_id: 'grp-1',
    payment_sibling: sibling,
  };
}
