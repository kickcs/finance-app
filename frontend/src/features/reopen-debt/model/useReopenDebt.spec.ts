import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useReopenDebt } from './useReopenDebt';
import { mockClosedDebtResponse } from '@/test/mocks/handlers/debts';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('@/shared/ui', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  return { ...orig, useToast: () => ({ toast: toastMock }) };
});

vi.mock('@/shared/api/invalidation', () => ({
  invalidateDebtRelated: vi.fn().mockResolvedValue(undefined),
  invalidateTransactionRelated: vi.fn().mockResolvedValue(undefined),
  invalidateAccountRelated: vi.fn().mockResolvedValue(undefined),
}));

import { invalidateDebtRelated } from '@/shared/api/invalidation';

const USER_ID = 'test-user-1';
const DEBT_ID = mockClosedDebtResponse.id;

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable() {
  let result!: ReturnType<typeof useReopenDebt>;
  const Stub = defineComponent({
    setup() {
      result = useReopenDebt();
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub);
  return result;
}

describe('useReopenDebt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  it('posts to the reopen endpoint and reports success', async () => {
    const reopenSpy = vi.fn();
    server.use(
      http.post('*/api/debts/:id/reopen', ({ params }) => {
        reopenSpy(params.id);
        return HttpResponse.json({ ...mockClosedDebtResponse, isClosed: false });
      }),
    );

    const c = mountComposable();
    const result = await c.reopenDebt(DEBT_ID, USER_ID);

    expect(result).toBe(true);
    expect(reopenSpy).toHaveBeenCalledWith(DEBT_ID);
  });

  it('invalidates debt-related caches and shows a success toast', async () => {
    const c = mountComposable();
    await c.reopenDebt(DEBT_ID, USER_ID);
    await flushPromises();

    expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
  });

  it('clears isReopening after success', async () => {
    const c = mountComposable();
    const promise = c.reopenDebt(DEBT_ID, USER_ID);
    expect(c.isReopening.value).toBe(true);

    await promise;
    expect(c.isReopening.value).toBe(false);
  });

  it('ignores a second call while one is in flight', async () => {
    const reopenSpy = vi.fn();
    server.use(
      http.post('*/api/debts/:id/reopen', () => {
        reopenSpy();
        return HttpResponse.json({ ...mockClosedDebtResponse, isClosed: false });
      }),
    );

    const c = mountComposable();
    const [first, second] = await Promise.all([
      c.reopenDebt(DEBT_ID, USER_ID),
      c.reopenDebt(DEBT_ID, USER_ID),
    ]);

    expect([first, second]).toEqual([true, false]);
    expect(reopenSpy).toHaveBeenCalledTimes(1);
  });

  it('reports failure, toasts and leaves caches untouched when the API errors', async () => {
    server.use(
      http.post('*/api/debts/:id/reopen', () =>
        HttpResponse.json({ message: 'Debt is not closed' }, { status: 409 }),
      ),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const c = mountComposable();
    const result = await c.reopenDebt(DEBT_ID, USER_ID);
    await flushPromises();

    expect(result).toBe(false);
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    expect(invalidateDebtRelated).not.toHaveBeenCalled();
    expect(c.isReopening.value).toBe(false);
    consoleError.mockRestore();
  });
});
