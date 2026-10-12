import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { AccountWithBalances } from '@/entities/account';
import AmountHeadline from './AmountHeadline.vue';

function makeAccount(id: string, balance: number): AccountWithBalances {
  return {
    id,
    user_id: 'user-1',
    name: id,
    type: 'basic',
    icon: 'credit_card',
    color: '#64748b',
    created_at: '2025-01-01T00:00:00.000Z',
    balances: [
      { id: `${id}-uzs`, account_id: id, currency: 'UZS', balance, created_at: '2025-01-01' },
    ],
  } as AccountWithBalances;
}

function mountHeadline(props: Record<string, unknown> = {}) {
  return mount(AmountHeadline, {
    props: {
      amount: 100000,
      currency: 'UZS',
      currencySymbol: 'сўм',
      availableCurrencies: ['UZS'],
      isMultiCurrency: false,
      accounts: [makeAccount('acc-1', 60000), makeAccount('acc-2', 500000)],
      accountId: 'acc-1',
      accountName: 'Uzcard',
      sign: 'minus',
      currentBalance: 60000,
      showInsufficientFunds: true,
      allowSecondPart: true,
      secondPart: null,
      ...props,
    },
    global: { stubs: { UIcon: true, AccountPopover: true } },
  });
}

const coverAction = (w: ReturnType<typeof mountHeadline>) =>
  w.find('[data-testid="cover-shortfall"]');

describe('AmountHeadline — «Доплатить с другого счёта»', () => {
  it('переносит ровно недостачу на второй счёт', async () => {
    const wrapper = mountHeadline();
    await coverAction(wrapper).trigger('click');
    expect(wrapper.emitted('update:secondPart')!.at(-1)).toEqual([
      { accountId: 'acc-2', amount: 40000 },
    ]);
  });

  it('не предлагает доплату, когда другого счёта нет', () => {
    const wrapper = mountHeadline({ accounts: [makeAccount('acc-1', 60000)] });
    expect(coverAction(wrapper).exists()).toBe(false);
  });

  it('не предлагает доплату с пустого счёта — первая часть вышла бы нулевой', () => {
    const wrapper = mountHeadline({ currentBalance: 0 });
    expect(coverAction(wrapper).exists()).toBe(false);
  });

  it('не предлагает доплату там, где второй счёт недоступен', () => {
    const wrapper = mountHeadline({ allowSecondPart: false });
    expect(coverAction(wrapper).exists()).toBe(false);
  });
});
