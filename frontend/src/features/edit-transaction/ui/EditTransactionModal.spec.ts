import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { mockGivenDebtResponse } from '@/test/mocks/handlers/debts';
import type { AccountWithBalances } from '@/entities/account';
import type { Transaction } from '@/shared/api/database.types';
import EditTransactionModal from './EditTransactionModal.vue';

const ACCOUNTS = ['acc-1', 'acc-2'].map(
  (id) =>
    ({
      id,
      user_id: mockUser.id,
      name: id,
      type: 'basic',
      icon: 'credit_card',
      color: '#3b82f6',
      created_at: '2025-01-01T00:00:00.000Z',
      balances: [
        { id: `${id}-uzs`, account_id: id, currency: 'UZS', balance: 500000, created_at: '' },
      ],
    }) as AccountWithBalances,
);

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    user_id: mockUser.id,
    account_id: 'acc-1',
    category_id: 'food',
    amount: 60000,
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
    net_amount: 60000,
    has_debt_returns: false,
    payment_group_id: null,
    payment_sibling: null,
    ...overrides,
  };
}

let wrapper: ReturnType<typeof renderWithProviders> | null = null;

// Как на страницах: модалка монтируется пустой, транзакция приходит при выборе строки.
async function mountModal(transaction: Transaction) {
  wrapper = renderWithProviders(EditTransactionModal, {
    props: {
      modelValue: true,
      transaction: null,
      accounts: ACCOUNTS,
      currency: 'UZS',
      onSave: async () => true,
    },
    provideAuth: { user: mockUser },
    global: {
      stubs: {
        UModal: { template: '<div><slot /><slot name="actions" /></div>' },
        PaymentPartsEditor: { name: 'PaymentPartsEditor', template: '<div />' },
        SplitParticipantList: {
          name: 'SplitParticipantList',
          props: ['participants', 'myShare'],
          template: '<div />',
        },
        AccountSelector: true,
        CategoryChips: true,
      },
    },
  });
  await wrapper.setProps({ transaction });
  return wrapper;
}

describe('EditTransactionModal', () => {
  afterEach(() => {
    server.resetHandlers();
    wrapper?.unmount();
    wrapper = null;
  });

  it('offers a second account on a regular expense', async () => {
    const w = await mountModal(makeTx());
    expect(w.findComponent({ name: 'PaymentPartsEditor' }).exists()).toBe(true);
  });

  it('does not offer a second account on a debt leg', async () => {
    const w = await mountModal(makeTx({ debt_id: 'debt-1' }));
    expect(w.findComponent({ name: 'PaymentPartsEditor' }).exists()).toBe(false);
  });

  it('does not offer a second account on an informational row', async () => {
    const w = await mountModal(makeTx({ is_informational: true }));
    expect(w.findComponent({ name: 'PaymentPartsEditor' }).exists()).toBe(false);
  });

  it('shows split debts of the other part and counts my share from the operation total', async () => {
    server.use(
      http.get('*/api/debts', () =>
        HttpResponse.json([
          {
            ...mockGivenDebtResponse,
            id: 'sd-1',
            transactionId: null,
            sourceTransactionId: 'tx-1',
            totalAmount: 30000,
            remainingAmount: 30000,
          },
        ]),
      ),
    );

    // Открыта вторая часть (наличные 40 000), долги указывают на первую (карта 60 000).
    const w = await mountModal(
      makeTx({
        id: 'tx-2',
        account_id: 'acc-2',
        amount: 40000,
        net_amount: 40000,
        payment_group_id: 'grp-1',
        payment_sibling: { id: 'tx-1', account_id: 'acc-1', amount: 60000 },
      }),
    );
    await flushPromises();

    const list = w.findComponent({ name: 'SplitParticipantList' });
    expect(list.exists()).toBe(true);
    expect(list.props('myShare')).toBe(100000 - 30000);
  });
});
