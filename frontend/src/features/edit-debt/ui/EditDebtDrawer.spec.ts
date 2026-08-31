import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { mockGivenDebtResponse } from '@/test/mocks/handlers/debts';
import type { Debt } from '@/shared/api/database.types';
import EditDebtDrawer from './EditDebtDrawer.vue';

vi.mock('@/shared/api/invalidation', () => ({
  invalidateDebtRelated: vi.fn().mockResolvedValue(undefined),
  invalidateTransactionRelated: vi.fn().mockResolvedValue(undefined),
  invalidateAccountRelated: vi.fn().mockResolvedValue(undefined),
}));

/**
 * `UOverlay` уводит содержимое в портал — для теста самой шторки он подменяется
 * сквозной заглушкой: проверяется её форма и то, что уезжает на сервер.
 */
const OverlayStub = {
  name: 'UOverlay',
  props: ['modelValue', 'title', 'desktop', 'maxHeight'],
  template: '<div><slot /><slot name="footer" /></div>',
};

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'debt-1',
    user_id: mockUser.id,
    name: 'Долг от Алексей',
    total_amount: 50000,
    remaining_amount: 50000,
    monthly_payment: null,
    next_payment_date: null,
    created_at: '2026-01-15T12:00:00.000Z',
    debt_type: 'given',
    person_name: 'Алексей',
    account_id: 'acc-1',
    transaction_id: 'tx-debt-1',
    close_transaction_id: null,
    is_closed: false,
    currency: 'UZS',
    source_transaction_id: null,
    description: null,
    closed_at: null,
    forgiven_amount: 0,
    is_private: false,
    fee_amount: 0,
    fee_transaction_id: null,
    ...overrides,
  };
}

let wrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountDrawer(debt: Debt) {
  wrapper = renderWithProviders(EditDebtDrawer, {
    props: { modelValue: true, debt },
    provideAuth: { user: mockUser },
    global: {
      stubs: {
        UOverlay: OverlayStub,
        PersonPicker: true,
        AccountSelector: true,
        DatePickerField: true,
        DueDateField: true,
        DebtDirectionPill: true,
        ToggleRow: true,
      },
    },
  });
  return wrapper;
}

describe('EditDebtDrawer', () => {
  beforeEach(() => {
    server.use(http.get('*/api/debts', () => HttpResponse.json([])));
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  it('закрывается после сохранения', async () => {
    let patchBody: Record<string, unknown> = {};
    server.use(
      http.patch('*/api/debts/:id', async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...mockGivenDebtResponse, ...patchBody });
      }),
    );

    const w = mountDrawer(makeDebt());
    await flushPromises();

    w.findComponent({ name: 'PersonPicker' }).vm.$emit('select', 'Мария');
    await flushPromises();

    await w.find('button').trigger('click');
    await flushPromises();

    expect(patchBody.personName).toBe('Мария');
    expect(w.emitted('saved')).toBeTruthy();
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([false]);
  });

  it('комиссия уезжает на сервер', async () => {
    let patchBody: Record<string, unknown> = {};
    server.use(
      http.patch('*/api/debts/:id', async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...mockGivenDebtResponse, ...patchBody });
      }),
    );

    const w = mountDrawer(makeDebt({ fee_amount: 500, fee_transaction_id: 'tx-fee-1' }));
    await flushPromises();

    const feeInput = w.find('[data-testid="edit-debt-fee-input"] input');
    expect(feeInput.exists()).toBe(true);
    await feeInput.setValue('900');

    await w.find('button').trigger('click');
    await flushPromises();

    expect(patchBody.feeAmount).toBe(900);
  });

  it('у долга без своей записи комиссии поля нет', async () => {
    // Долг из времён, когда комиссию заводил POST /transactions
    const w = mountDrawer(makeDebt({ fee_amount: 500, fee_transaction_id: null }));
    await flushPromises();

    expect(w.find('[data-testid="edit-debt-fee-input"]').exists()).toBe(false);
  });

  it('нетронутая форма не даёт сохранить', async () => {
    const w = mountDrawer(makeDebt());
    await flushPromises();

    expect(w.find('button').attributes('disabled')).toBeDefined();
  });
});
