import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CloseAllDebtsDrawer from './CloseAllDebtsDrawer.vue';
import type { Debt } from '@/shared/api/database.types';
import type { AccountWithBalances } from '@/entities/account';

function makeDebt(overrides: Partial<Debt> & { id: string }): Debt {
  return {
    user_id: 'user-1',
    name: overrides.id,
    total_amount: 10_000,
    remaining_amount: 10_000,
    monthly_payment: null,
    next_payment_date: null,
    created_at: '2026-01-01T00:00:00.000Z',
    debt_type: 'given',
    person_name: 'Алексей',
    account_id: null,
    transaction_id: null,
    close_transaction_id: null,
    is_closed: false,
    currency: 'UZS',
    source_transaction_id: null,
    description: null,
    closed_at: null,
    forgiven_amount: 0,
    is_private: false,
    fee_amount: 0,
    ...overrides,
  } as Debt;
}

const accounts = [{ id: 'acc-1', name: 'Карта' }] as unknown as AccountWithBalances[];

/**
 * `UOverlay` уводит содержимое в портал (vaul на мобиле, reka на десктопе) —
 * для юнит-теста самой шторки он подменяется сквозной заглушкой: проверяем
 * логику распределения и пресетов, а не работу портала.
 */
const OverlayStub = {
  name: 'UOverlay',
  props: ['modelValue', 'title', 'desktop', 'maxHeight'],
  template: '<div><slot /><slot name="footer" /></div>',
};

const globalOptions = {
  stubs: {
    UOverlay: OverlayStub,
    AccountSelector: true,
    DebtPaymentFields: true,
    DebtProgressMeter: true,
  },
};

function mountDrawer(debts: Debt[], extraProps: Record<string, unknown> = {}) {
  return mount(CloseAllDebtsDrawer, {
    props: { modelValue: true, debts, personName: 'Алексей', accounts, ...extraProps },
    global: globalOptions,
  });
}

const rows = (w: ReturnType<typeof mountDrawer>) =>
  w.findAll('[data-testid="close-all-debt-row"]').map((r) => r.text());

describe('CloseAllDebtsDrawer', () => {
  const twoDebts = [
    makeDebt({ id: 'd1', name: 'Долг 1', remaining_amount: 10_000, created_at: '2026-01-01' }),
    makeDebt({ id: 'd2', name: 'Долг 2', remaining_amount: 20_000, created_at: '2026-02-01' }),
  ];

  it('по умолчанию заполняет сумму полным остатком и закрывает все долги', () => {
    const wrapper = mountDrawer(twoDebts);
    const text = rows(wrapper);
    expect(text).toHaveLength(2);
    expect(text.every((t) => t.includes('Закроется'))).toBe(true);
    expect(wrapper.text()).toContain('закроется 2 из 2');
  });

  it('распределяет частичную сумму по FIFO — старый долг первым', async () => {
    const wrapper = mountDrawer(twoDebts);
    await wrapper.find('[data-testid="close-all-preset-half"]').trigger('click');

    // Половина от 30 000 = 15 000: первый долг закрыт, второму достаётся 5 000
    const [first, second] = rows(wrapper);
    expect(first).toContain('Закроется');
    expect(second).toContain('Частично');
    expect(wrapper.text()).toContain('закроется 1 из 2');
  });

  it('«Простить» обнуляет сумму и помечает все долги как прощаемые', async () => {
    const wrapper = mountDrawer(twoDebts);
    await wrapper.find('[data-testid="close-all-preset-forgive"]').trigger('click');

    expect(rows(wrapper).every((t) => t.includes('Простится'))).toBe(true);
    expect(wrapper.find('[data-testid="close-all-submit"]').text()).toContain('Простить все долги');
  });

  it('отдаёт выбранный счёт и параметры платежа наружу', async () => {
    const wrapper = mountDrawer(twoDebts);
    await wrapper.find('[data-testid="close-all-submit"]').trigger('click');

    expect(wrapper.emitted('confirm')?.[0]).toEqual([
      'acc-1',
      { paymentAmount: 30_000, forgiveRemainder: false, excessCategoryId: undefined },
    ]);
  });

  it('при разных валютах прячет ввод суммы и показывает итог по каждой валюте', () => {
    const wrapper = mountDrawer([
      makeDebt({ id: 'd1', name: 'Долг 1', remaining_amount: 10_000, currency: 'UZS' }),
      makeDebt({ id: 'd2', name: 'Долг 2', remaining_amount: 100, currency: 'USD' }),
    ]);

    expect(wrapper.find('[data-testid="close-all-amount-input"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="close-all-preset-half"]').exists()).toBe(false);
  });

  it('пока идёт закрытие, кнопка заблокирована и показывает прогресс', () => {
    const wrapper = mountDrawer(twoDebts, { isClosing: true, progress: 1, total: 2 });

    const submit = wrapper.find('[data-testid="close-all-submit"]');
    expect(submit.text()).toContain('Закрываем 1 из 2');
    expect(submit.attributes('disabled')).toBeDefined();
  });
});
