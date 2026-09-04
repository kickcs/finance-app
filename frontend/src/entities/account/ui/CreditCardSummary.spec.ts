import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import CreditCardSummary from './CreditCardSummary.vue';
import type { AccountWithBalances } from '@/shared/api/database.types';

function makeCard(over: Partial<AccountWithBalances> = {}): AccountWithBalances {
  return {
    id: 'acc-1',
    user_id: 'u1',
    name: 'Кредитка',
    icon: 'credit_card',
    color: '#f97316',
    type: 'credit_card',
    order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    credit_limit: 10_000_000,
    grace_period_days: null,
    billing_day: null,
    total_amount: null,
    interest_rate: null,
    monthly_payment: null,
    start_date: null,
    end_date: null,
    maturity_date: null,
    is_replenishable: null,
    is_withdrawable: null,
    balances: [
      { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: -2_350_000, created_at: '' },
    ],
    ...over,
  } as AccountWithBalances;
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

function render(account: AccountWithBalances) {
  return renderWithProviders(CreditCardSummary, {
    provideAuth: { user: mockUser },
    props: { account },
  });
}

describe('CreditCardSummary', () => {
  it('герой — задолженность при отрицательном балансе', async () => {
    currentWrapper = render(makeCard());
    await flushPromises();
    expect(currentWrapper.text()).toContain('Задолженность');
    expect(currentWrapper.text()).toContain('2 350 000');
    expect(currentWrapper.find('.text-danger').exists()).toBe(true);
  });

  it('герой — «Долга нет» при нулевом балансе', async () => {
    currentWrapper = render(
      makeCard({
        balances: [{ id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 0, created_at: '' }],
      } as Partial<AccountWithBalances>),
    );
    await flushPromises();
    expect(currentWrapper.text()).toContain('Долга нет');
  });

  it('герой — свои средства при положительном балансе', async () => {
    currentWrapper = render(
      makeCard({
        balances: [
          { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 300_000, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
    );
    await flushPromises();
    expect(currentWrapper.text()).toContain('Свои средства');
    expect(currentWrapper.text()).toContain('300 000');
  });

  it('метр и концы дорожки — при лимите и долге', async () => {
    currentWrapper = render(makeCard());
    await flushPromises();
    expect(currentWrapper.find('[role="progressbar"]').exists()).toBe(true);
    expect(currentWrapper.text()).toContain('доступно');
    expect(currentWrapper.text()).toContain('7 650 000');
    expect(currentWrapper.text()).toContain('лимит');
  });

  it('без долга метра нет', async () => {
    currentWrapper = render(
      makeCard({
        balances: [{ id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 0, created_at: '' }],
      } as Partial<AccountWithBalances>),
    );
    await flushPromises();
    expect(currentWrapper.find('[role="progressbar"]').exists()).toBe(false);
  });

  it('без лимита — подсказка вместо дорожки', async () => {
    currentWrapper = render(makeCard({ credit_limit: null }));
    await flushPromises();
    expect(currentWrapper.find('[role="progressbar"]').exists()).toBe(false);
    expect(currentWrapper.text()).toContain('Укажите лимит, чтобы видеть доступный остаток');
  });

  it('метр краснеет при использовании выше 80 %', async () => {
    currentWrapper = render(
      makeCard({
        credit_limit: 1_000_000,
        balances: [
          { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: -900_000, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
    );
    await flushPromises();
    expect(currentWrapper.html()).toContain('bg-danger');
  });

  it('показывает только заданные параметры карты', async () => {
    currentWrapper = render(makeCard({ grace_period_days: 55, billing_day: 5 }));
    await flushPromises();
    const text = currentWrapper.text();
    expect(text).toContain('Грейс-период');
    expect(text).toContain('55 дней');
    expect(text).toContain('День выписки');
    expect(text).toContain('5-е число');
    expect(text).not.toContain('Мин. платёж');
  });

  it('остальные валюты — строкой с подписью «долг» или «свои средства»', async () => {
    currentWrapper = render(
      makeCard({
        balances: [
          { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: -2_350_000, created_at: '' },
          { id: 'b2', account_id: 'acc-1', currency: 'USD', balance: -120, created_at: '' },
          { id: 'b3', account_id: 'acc-1', currency: 'EUR', balance: 40, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
    );
    await flushPromises();
    const text = currentWrapper.text();
    expect(text).toContain('USD');
    expect(text).toContain('долг');
    expect(text).toContain('EUR');
    expect(text).toContain('свои средства');
  });
});
