import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useEditTransaction } from './useEditTransaction';
import { mockTransactionResponse } from '@/test/mocks/handlers/transactions';
import { mockGivenDebtResponse } from '@/test/mocks/handlers/debts';
import { queryClient } from '@/shared/api/queryClient';
import { transactionQueryKeys } from '@/entities/transaction';
import type { Transaction } from '@/shared/api/database.types';

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
  let result!: ReturnType<typeof useEditTransaction>;
  const Stub = defineComponent({
    setup() {
      result = useEditTransaction(USER_ID);
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub, { provideAuth: { user: mockUser } });
  return result;
}

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
    payment_sibling: null,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useEditTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // ── Initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with isUpdating = false', () => {
      const c = mountComposable();
      expect(c.isUpdating.value).toBe(false);
    });

    it('starts with isDeleting = false', () => {
      const c = mountComposable();
      expect(c.isDeleting.value).toBe(false);
    });

    it('starts with no error', () => {
      const c = mountComposable();
      expect(c.error.value).toBeNull();
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('sends PATCH request with correct payload', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.patch('*/api/transactions/:id', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTransactionResponse });
        }),
      );

      const c = mountComposable();
      const tx = makeTransaction();

      await c.update(tx, { amount: 30000, description: 'Updated' });

      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload!.amount).toBe(30000);
      expect(capturedPayload!.description).toBe('Updated');
    });

    it('returns true on success', async () => {
      const c = mountComposable();
      const tx = makeTransaction();

      const result = await c.update(tx, { amount: 10000 });

      expect(result).toBe(true);
    });

    it('shows success toast after update', async () => {
      const c = mountComposable();
      const tx = makeTransaction();

      await c.update(tx, { amount: 10000 });

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Транзакция обновлена', variant: 'success' }),
      );
    });

    it('rejects editing debt-related transactions (non-adjustment)', async () => {
      const patchSpy = vi.fn();
      server.use(
        http.patch('*/api/transactions/:id', () => {
          patchSpy();
          return HttpResponse.json(mockTransactionResponse);
        }),
      );

      const c = mountComposable();
      const tx = makeTransaction({ is_debt_related: true, type: 'expense' });

      const result = await c.update(tx, { amount: 999 });

      expect(result).toBe(false);
      expect(c.error.value).toContain('нельзя редактировать');
      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('allows editing adjustment transactions even if is_debt_related is true', async () => {
      const c = mountComposable();
      const tx = makeTransaction({ is_debt_related: true, type: 'adjustment' });

      const result = await c.update(tx, { amount: 5000 });

      expect(result).toBe(true);
    });

    it('rejects editing transfer transactions', async () => {
      const patchSpy = vi.fn();
      server.use(
        http.patch('*/api/transactions/:id', () => {
          patchSpy();
          return HttpResponse.json(mockTransactionResponse);
        }),
      );

      const c = mountComposable();
      const tx = makeTransaction({ type: 'transfer' });

      const result = await c.update(tx, { amount: 999 });

      expect(result).toBe(false);
      expect(c.error.value).toContain('нельзя редактировать');
      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('returns false and sets error on API 500', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      server.use(
        http.patch('*/api/transactions/:id', () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      const tx = makeTransaction();

      const result = await c.update(tx, { amount: 10000 });

      expect(result).toBe(false);
      expect(c.error.value).toBe('Не удалось обновить транзакцию');
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
      consoleSpy.mockRestore();
    });

    it('resets isUpdating to false after success', async () => {
      const c = mountComposable();
      const tx = makeTransaction();

      await c.update(tx, { amount: 10000 });

      expect(c.isUpdating.value).toBe(false);
    });

    it('resets isUpdating to false after failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      server.use(
        http.patch('*/api/transactions/:id', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      const tx = makeTransaction();

      await c.update(tx, { amount: 1 });

      expect(c.isUpdating.value).toBe(false);
      consoleSpy.mockRestore();
    });

    it('patches the cached transaction list optimistically', async () => {
      const tx = makeTransaction({ id: 'tx-list' });
      queryClient.setQueryData(transactionQueryKeys.list(USER_ID), [tx]);

      const c = mountComposable();
      await c.update(tx, { description: 'New description' });

      const cached = queryClient.getQueryData<Transaction[]>(transactionQueryKeys.list(USER_ID));
      expect(cached?.[0].description).toBe('New description');
    });

    it('rolls back the cached list on API failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      server.use(
        http.patch('*/api/transactions/:id', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 }),
        ),
      );
      const tx = makeTransaction({ id: 'tx-rollback', description: 'Original' });
      queryClient.setQueryData(transactionQueryKeys.list(USER_ID), [tx]);

      const c = mountComposable();
      await c.update(tx, { description: 'Broken update' });

      const cached = queryClient.getQueryData<Transaction[]>(transactionQueryKeys.list(USER_ID));
      expect(cached?.[0].description).toBe('Original');
      consoleSpy.mockRestore();
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('sends DELETE request for the transaction', async () => {
      const deletedIds: string[] = [];
      server.use(
        http.delete('*/api/transactions/:id', ({ params }) => {
          deletedIds.push(params.id as string);
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const c = mountComposable();
      const tx = makeTransaction({ id: 'tx-to-delete' });

      await c.remove(tx);

      expect(deletedIds).toContain('tx-to-delete');
    });

    it('returns true on successful deletion', async () => {
      const c = mountComposable();
      const tx = makeTransaction();

      const result = await c.remove(tx);

      expect(result).toBe(true);
    });

    it('shows success toast after deletion', async () => {
      const c = mountComposable();
      const tx = makeTransaction();

      await c.remove(tx);

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Транзакция удалена', variant: 'success' }),
      );
    });

    it('rejects deletion of debt-related transactions (non-adjustment)', async () => {
      const deleteSpy = vi.fn();
      server.use(
        http.delete('*/api/transactions/:id', () => {
          deleteSpy();
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const c = mountComposable();
      const tx = makeTransaction({ is_debt_related: true, type: 'expense' });

      const result = await c.remove(tx);

      expect(result).toBe(false);
      expect(c.error.value).toContain('нельзя удалять');
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('allows deletion of adjustment transactions even if is_debt_related is true', async () => {
      const c = mountComposable();
      const tx = makeTransaction({ is_debt_related: true, type: 'adjustment' });

      const result = await c.remove(tx);

      expect(result).toBe(true);
    });

    it('blocks deletion when there are open split debts linked to this transaction', async () => {
      const deleteSpy = vi.fn();
      server.use(
        http.get('*/api/debts', () =>
          // Backend returns camelCase — debtsApi.getAll() transforms to snake_case
          HttpResponse.json([
            {
              ...mockGivenDebtResponse,
              sourceTransactionId: 'tx-split',
              isClosed: false,
            },
          ]),
        ),
        http.delete('*/api/transactions/:id', () => {
          deleteSpy();
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const c = mountComposable();
      const tx = makeTransaction({ id: 'tx-split' });

      const result = await c.remove(tx);
      await flushPromises();

      expect(result).toBe(false);
      expect(c.error.value).toContain('открытыми долгами');
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('allows deletion when only closed split debts exist', async () => {
      server.use(
        http.get('*/api/debts', () =>
          // Backend returns camelCase — debtsApi.getAll() transforms to snake_case
          HttpResponse.json([
            {
              ...mockGivenDebtResponse,
              sourceTransactionId: 'tx-closed-split',
              isClosed: true,
            },
          ]),
        ),
      );

      const c = mountComposable();
      const tx = makeTransaction({ id: 'tx-closed-split' });

      const result = await c.remove(tx);
      await flushPromises();

      expect(result).toBe(true);
    });

    it('returns false and sets error on API 500 deletion', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      server.use(
        http.delete('*/api/transactions/:id', () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      const tx = makeTransaction();

      const result = await c.remove(tx);
      await flushPromises();

      expect(result).toBe(false);
      expect(c.error.value).toBe('Не удалось удалить транзакцию');
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
      consoleSpy.mockRestore();
    });

    it('shows backend error message for 400 responses', async () => {
      server.use(
        http.delete('*/api/transactions/:id', () =>
          HttpResponse.json({ message: 'Cannot delete — debt exists' }, { status: 400 }),
        ),
      );

      const c = mountComposable();
      const tx = makeTransaction();

      await c.remove(tx);
      await flushPromises();

      // Should show the backend error message in toast
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    });

    it('resets isDeleting to false after success', async () => {
      const c = mountComposable();
      const tx = makeTransaction();

      await c.remove(tx);

      expect(c.isDeleting.value).toBe(false);
    });

    it('resets isDeleting to false after failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      server.use(
        http.delete('*/api/transactions/:id', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      const tx = makeTransaction();

      await c.remove(tx);
      await flushPromises();

      expect(c.isDeleting.value).toBe(false);
      consoleSpy.mockRestore();
    });

    it('removes the transaction from the cached list optimistically', async () => {
      const tx = makeTransaction({ id: 'tx-to-remove' });
      queryClient.setQueryData(transactionQueryKeys.list(USER_ID), [tx]);

      const c = mountComposable();
      await c.remove(tx);

      const cached = queryClient.getQueryData<Transaction[]>(transactionQueryKeys.list(USER_ID));
      expect(cached).toEqual([]);
    });

    it('restores the cached list when deletion fails server-side', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      server.use(
        http.delete('*/api/transactions/:id', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 }),
        ),
      );
      const tx = makeTransaction({ id: 'tx-keep' });
      queryClient.setQueryData(transactionQueryKeys.list(USER_ID), [tx]);

      const c = mountComposable();
      await c.remove(tx);

      const cached = queryClient.getQueryData<Transaction[]>(transactionQueryKeys.list(USER_ID));
      expect(cached?.map((t) => t.id)).toContain('tx-keep');
      consoleSpy.mockRestore();
    });
  });
});

// ── Оплата с двух счетов ───────────────────────────────────────────────────

describe('useEditTransaction: payment group', () => {
  const first = () =>
    makeTransaction({
      id: 'tx-a',
      amount: 60000,
      net_amount: 60000,
      description: 'Ужин',
      payment_group_id: 'grp-1',
      payment_sibling: { id: 'tx-b', account_id: 'acc-2', amount: 40000 },
    });
  const second = () =>
    makeTransaction({
      id: 'tx-b',
      account_id: 'acc-2',
      amount: 40000,
      net_amount: 40000,
      description: 'Ужин',
      payment_group_id: 'grp-1',
      payment_sibling: { id: 'tx-a', account_id: 'acc-1', amount: 60000 },
    });

  function seed() {
    queryClient.setQueryData(transactionQueryKeys.list(USER_ID), [first(), second()]);
  }
  const cachedList = () =>
    queryClient.getQueryData<Transaction[]>(transactionQueryKeys.list(USER_ID))!;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
    queryClient.clear();
  });

  async function captureBody(run: () => Promise<unknown>) {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch('*/api/transactions/:id', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(mockTransactionResponse);
      }),
    );
    await run();
    return body as Record<string, unknown> | null;
  }

  it('sends second_part as camelCase secondPart', async () => {
    const c = mountComposable();
    const body = await captureBody(() =>
      c.update(makeTransaction(), {
        amount: 60000,
        second_part: { account_id: 'acc-2', amount: 40000 },
      }),
    );
    expect(body!.secondPart).toEqual({ accountId: 'acc-2', amount: 40000 });
  });

  it('sends secondPart: null to remove the second part', async () => {
    const c = mountComposable();
    const body = await captureBody(() => c.update(first(), { amount: 100000, second_part: null }));
    expect(body).toHaveProperty('secondPart', null);
  });

  it('omits secondPart when the edit does not touch it', async () => {
    const c = mountComposable();
    const body = await captureBody(() => c.update(first(), { description: 'Обед' }));
    expect(body).not.toHaveProperty('secondPart');
  });

  it('patches both rows optimistically', async () => {
    seed();
    const c = mountComposable();

    await c.update(first(), {
      description: 'Обед',
      second_part: { account_id: 'acc-3', amount: 30000 },
    });

    const [a, b] = cachedList();
    expect(a.description).toBe('Обед');
    expect(a.payment_sibling).toEqual({ id: 'tx-b', account_id: 'acc-3', amount: 30000 });
    expect(b).toMatchObject({ description: 'Обед', account_id: 'acc-3', amount: 30000 });
  });

  it('drops the sibling row from caches when the second part is removed', async () => {
    seed();
    const c = mountComposable();

    await c.update(first(), { amount: 100000, second_part: null });

    expect(cachedList().map((t) => t.id)).toEqual(['tx-a']);
    expect(cachedList()[0].payment_sibling).toBeNull();
  });

  it('restores both rows when the update fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.patch('*/api/transactions/:id', () =>
        HttpResponse.json({ message: 'Error' }, { status: 500 }),
      ),
    );
    seed();
    const c = mountComposable();

    await c.update(first(), { amount: 100000, second_part: null });

    expect(cachedList()).toEqual([first(), second()]);
    consoleSpy.mockRestore();
  });

  it('removes both rows from caches when a part is deleted', async () => {
    seed();
    const c = mountComposable();

    await c.remove(second());

    expect(cachedList()).toEqual([]);
  });

  it('restores both rows when deleting a group fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.delete('*/api/transactions/:id', () =>
        HttpResponse.json({ message: 'Error' }, { status: 500 }),
      ),
    );
    seed();
    const c = mountComposable();

    await c.remove(first());

    expect(cachedList().map((t) => t.id)).toEqual(['tx-a', 'tx-b']);
    consoleSpy.mockRestore();
  });

  it('blocks deletion when an open split debt hangs on the other part', async () => {
    const deleteSpy = vi.fn();
    server.use(
      http.get('*/api/debts', () =>
        HttpResponse.json([
          { ...mockGivenDebtResponse, sourceTransactionId: 'tx-b', isClosed: false },
        ]),
      ),
      http.delete('*/api/transactions/:id', () => {
        deleteSpy();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    seed();
    const c = mountComposable();

    const result = await c.remove(first());

    expect(result).toBe(false);
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
