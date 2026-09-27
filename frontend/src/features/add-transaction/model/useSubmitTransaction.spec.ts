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
});
