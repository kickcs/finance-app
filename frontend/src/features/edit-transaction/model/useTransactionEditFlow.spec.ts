import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { invalidateDebtRelated } from '@/shared/api/invalidation';
import type { Transaction } from '@/shared/api/database.types';
import { useTransactionEditFlow } from './useTransactionEditFlow';

vi.mock('@/shared/ui', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  return { ...orig, useToast: () => ({ toast: vi.fn() }) };
});

vi.mock('@/shared/api/invalidation', () => ({
  invalidateTransactionRelated: vi.fn().mockResolvedValue(undefined),
  invalidateAccountRelated: vi.fn().mockResolvedValue(undefined),
  invalidateDebtRelated: vi.fn().mockResolvedValue(undefined),
}));

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountFlow() {
  let result!: ReturnType<typeof useTransactionEditFlow>;
  const Stub = defineComponent({
    setup() {
      result = useTransactionEditFlow(mockUser.id);
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub, { provideAuth: { user: mockUser } });
  return result;
}

// Платёж по долгу, как он приходит из истории: помечен общим расчётом.
const settlementPayment = {
  id: 'tx-return',
  user_id: mockUser.id,
  account_id: 'acc-1',
  category_id: 'debt_return_to_me',
  amount: 1000,
  currency: 'UZS',
  type: 'income',
  is_debt_related: true,
  is_informational: false,
  debt_id: 'debt-1',
  settlement_id: 's-1',
  payment_sibling: null,
} as unknown as Transaction;

describe('useTransactionEditFlow: удаление записи расчёта по долгу', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  it('свайп открывает подтверждение, после него расчёт удалён, а долги и счета обновлены', async () => {
    const deletedIds: string[] = [];
    server.use(
      http.delete('*/api/transactions/:id', ({ params }) => {
        deletedIds.push(params.id as string);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const flow = mountFlow();
    flow.handleSwipeDelete(settlementPayment);
    expect(flow.showDeleteModal.value).toBe(true);
    expect(flow.selectedTransaction.value?.settlement_id).toBe('s-1');

    await flow.handleDeleteTransaction();

    expect(deletedIds).toEqual(['tx-return']);
    expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), mockUser.id);
    expect(flow.showDeleteModal.value).toBe(false);
  });

  it('отказ сервера оставляет подтверждение открытым и ничего не обновляет', async () => {
    server.use(
      http.delete('*/api/transactions/:id', () =>
        HttpResponse.json(
          { message: 'Сначала отмените более поздний расчёт по долгу «Азиз»' },
          { status: 409 },
        ),
      ),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const flow = mountFlow();
    flow.handleSwipeDelete(settlementPayment);
    await flow.handleDeleteTransaction();

    expect(flow.showDeleteModal.value).toBe(true);
    expect(invalidateDebtRelated).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
