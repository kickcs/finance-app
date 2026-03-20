import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useEditTransaction } from './useEditTransaction';
import { mockTransactionResponse } from '@/test/mocks/handlers/transactions';
import { mockGivenDebtResponse } from '@/test/mocks/handlers/debts';
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
  });
});
