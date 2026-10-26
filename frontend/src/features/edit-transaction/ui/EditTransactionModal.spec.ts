import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { mockGivenDebtResponse } from '@/test/mocks/handlers/debts';
import type { AccountWithBalances } from '@/entities/account';
import type { Transaction } from '@/shared/api/database.types';
import type { TransactionUpdates } from '@/entities/transaction';
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
    settlement_id: null,
    payment_sibling: null,
    ...overrides,
  };
}

let wrapper: ReturnType<typeof renderWithProviders> | null = null;

// Как на страницах: модалка монтируется пустой, транзакция приходит при выборе строки.
async function mountModal(
  transaction: Transaction,
  onSave: (updates: TransactionUpdates) => Promise<boolean> = async () => true,
) {
  wrapper = renderWithProviders(EditTransactionModal, {
    props: {
      modelValue: true,
      transaction: null,
      accounts: ACCOUNTS,
      currency: 'UZS',
      onSave,
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
  describe('запись расчёта по долгу', () => {
    const HINT = 'Сумму платежа по долгу меняют отменой расчёта на экране долга';
    // Нога отработки: недолговая категория, поэтому форма правки для неё открыта
    const workLeg = () =>
      makeTx({
        category_id: 'repair',
        debt_id: 'debt-1',
        settlement_id: 's-1',
        description: 'Ремонт',
      });

    const amountInput = (w: Awaited<ReturnType<typeof mountModal>>) =>
      w.find('input[inputmode="decimal"]').element as HTMLInputElement;

    it('запирает поле суммы и объясняет, как сумму изменить', async () => {
      const w = await mountModal(workLeg());

      expect(amountInput(w).disabled).toBe(true);
      expect(w.text()).toContain(HINT);
    });

    it('у обычной записи поле суммы открыто и подсказки нет', async () => {
      const w = await mountModal(makeTx());

      expect(amountInput(w).disabled).toBe(false);
      expect(w.text()).not.toContain(HINT);
    });

    it('не предлагает вторую часть оплаты: она меняла бы сумму', async () => {
      const w = await mountModal(
        makeTx({ debt_id: null, category_id: 'salary', settlement_id: 's-1' }),
      );

      expect(w.findComponent({ name: 'PaymentPartsEditor' }).exists()).toBe(false);
    });

    it('при сохранении не отправляет сумму, но отправляет остальные правки', async () => {
      const onSave = vi.fn().mockResolvedValue(true);
      const w = await mountModal(workLeg(), onSave);

      await w.find('input:not([inputmode])[placeholder="Описание..."]').setValue('Ремонт крана');
      const save = w.findAll('button').find((b) => b.text().includes('Сохранить'))!;
      await save.trigger('click');
      await flushPromises();

      expect(onSave).toHaveBeenCalledTimes(1);
      const updates = onSave.mock.calls[0][0];
      expect(updates).not.toHaveProperty('amount');
      expect(updates).not.toHaveProperty('second_part');
      expect(updates).toMatchObject({ description: 'Ремонт крана', category_id: 'repair' });
    });

    it('у обычной записи сумма уходит как раньше', async () => {
      const onSave = vi.fn().mockResolvedValue(true);
      const w = await mountModal(makeTx(), onSave);

      const save = w.findAll('button').find((b) => b.text().includes('Сохранить'))!;
      await save.trigger('click');
      await flushPromises();

      expect(onSave.mock.calls[0][0]).toMatchObject({ amount: 60000 });
    });
  });

  // Три вида долговых записей открываются по-разному: что можно сделать с записью,
  // решает связка с расчётом, а не флаг is_debt_related.
  describe('долговые записи по тапу', () => {
    const OLD_NOTE = 'нельзя редактировать или удалять напрямую';
    const MARKER_NOTE = 'Сумма меняется на экране долга; удаление уберёт весь расчёт';
    const AMOUNT_HINT = 'Сумму платежа по долгу меняют отменой расчёта на экране долга';

    type Mounted = Awaited<ReturnType<typeof mountModal>>;
    const amountInput = (w: Mounted) => w.find('input[inputmode="decimal"]');
    const tabs = (w: Mounted) => w.findAll('[role="tab"]');
    const regularDelete = (w: Mounted) => w.find('button[aria-label="Удалить"]');
    const markerDelete = (w: Mounted) => w.find('[data-testid="delete-settlement-record-btn"]');
    const saveButton = (w: Mounted) =>
      w.findAll('button').find((b) => b.text().includes('Сохранить'));

    // (a) Платёж расчёта: помечен is_debt_related, но правится как обычная запись
    const settlementPayment = () =>
      makeTx({
        category_id: 'debt_return_to_me',
        type: 'income',
        is_debt_related: true,
        debt_id: 'debt-1',
        settlement_id: 's-1',
        description: 'Возврат долга',
      });

    // (b) Прощение, зачёт и отметка отработки: денег не двигали, правке не подлежат
    const forgiveness = () =>
      makeTx({
        category_id: 'debt_forgiven',
        is_informational: true,
        is_debt_related: false,
        debt_id: 'debt-1',
        settlement_id: 's-1',
        description: 'Прощение долга: Азиз',
      });

    // (c) Запись без расчёта, например выдача долга
    const debtCreation = () =>
      makeTx({ is_debt_related: true, debt_id: 'debt-1', settlement_id: null });

    describe('платёж расчёта (is_debt_related + settlement_id)', () => {
      it('открывает обычную форму, а не режим просмотра', async () => {
        const w = await mountModal(settlementPayment());

        expect(amountInput(w).exists()).toBe(true);
        expect(saveButton(w)).toBeDefined();
        expect(w.text()).not.toContain(OLD_NOTE);
      });

      it('запирает сумму и вкладки «Расход/Доход»', async () => {
        const w = await mountModal(settlementPayment());

        expect((amountInput(w).element as HTMLInputElement).disabled).toBe(true);
        expect(w.text()).toContain(AMOUNT_HINT);
        expect(tabs(w)).toHaveLength(2);
        expect(tabs(w).every((tab) => tab.attributes('disabled') !== undefined)).toBe(true);
      });

      it('даёт удалить запись — удалится весь расчёт', async () => {
        const w = await mountModal(settlementPayment());

        await regularDelete(w).trigger('click');

        expect(w.emitted('delete')).toHaveLength(1);
      });

      it('у обычной записи вкладки типа остаются живыми', async () => {
        const w = await mountModal(makeTx());

        expect(tabs(w).every((tab) => tab.attributes('disabled') === undefined)).toBe(true);
      });
    });

    describe('информационная запись расчёта (прощение, зачёт, отметка отработки)', () => {
      it('показывает только просмотр: формы правки нет', async () => {
        const w = await mountModal(forgiveness());

        expect(amountInput(w).exists()).toBe(false);
        expect(saveButton(w)).toBeUndefined();
        expect(w.text()).toContain('Прощение долга: Азиз');
      });

      it('объясняет, что сумма меняется на экране долга и что удаление уберёт расчёт', async () => {
        const w = await mountModal(forgiveness());

        expect(w.text()).toContain(MARKER_NOTE);
        expect(w.text()).not.toContain(OLD_NOTE);
      });

      it('даёт удалить запись', async () => {
        const w = await mountModal(forgiveness());

        await markerDelete(w).trigger('click');

        expect(w.emitted('delete')).toHaveLength(1);
      });

      it('так же ведёт себя запись зачёта', async () => {
        const w = await mountModal(
          makeTx({
            category_id: 'debt_offset',
            is_informational: true,
            debt_id: 'debt-1',
            settlement_id: 's-1',
          }),
        );

        expect(amountInput(w).exists()).toBe(false);
        expect(w.text()).toContain(MARKER_NOTE);
        expect(markerDelete(w).exists()).toBe(true);
      });
    });

    describe('долговая запись без расчёта', () => {
      it('остаётся в режиме просмотра с прежним текстом', async () => {
        const w = await mountModal(debtCreation());

        expect(w.text()).toContain(OLD_NOTE);
        expect(w.text()).not.toContain(MARKER_NOTE);
        expect(amountInput(w).exists()).toBe(false);
      });

      it('не даёт ни удалить, ни сохранить', async () => {
        const w = await mountModal(debtCreation());

        expect(regularDelete(w).exists()).toBe(false);
        expect(markerDelete(w).exists()).toBe(false);
        expect(saveButton(w)).toBeUndefined();
      });
    });
  });
});
