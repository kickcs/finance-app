import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import AccountCard from './AccountCard.vue';
import type { AccountWithBalances } from '@/shared/api/database.types';

function makeAccount(over: Partial<AccountWithBalances> = {}): AccountWithBalances {
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
  return renderWithProviders(AccountCard, {
    provideAuth: { user: mockUser },
    props: { account },
  });
}

describe('AccountCard — кредитная карта', () => {
  it('показывает долг со знаком минус и в danger', async () => {
    currentWrapper = render(makeAccount());
    await flushPromises();
    const credit = currentWrapper.find('[data-testid="account-card-credit"]');
    expect(credit.exists()).toBe(true);
    expect(credit.text()).toContain('2,35');
    expect(credit.text()).toContain('млн');
    expect(credit.html()).toContain('text-danger');
  });

  it('показывает доступный остаток при лимите', async () => {
    currentWrapper = render(makeAccount());
    await flushPromises();
    const credit = currentWrapper.find('[data-testid="account-card-credit"]');
    expect(credit.text()).toContain('доступно');
    expect(credit.text()).toContain('7,65');
  });

  it('без долга сумма не красная', async () => {
    currentWrapper = render(
      makeAccount({
        balances: [{ id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 0, created_at: '' }],
      }),
    );
    await flushPromises();
    const credit = currentWrapper.find('[data-testid="account-card-credit"]');
    expect(credit.text()).toContain('0');
    expect(credit.html()).not.toContain('text-danger');
  });

  it('без лимита строки «доступно» нет', async () => {
    currentWrapper = render(makeAccount({ credit_limit: null }));
    await flushPromises();
    expect(currentWrapper.find('[data-testid="account-card-credit"]').text()).not.toContain(
      'доступно',
    );
  });

  it('подпись типа остаётся «Кредитная карта»', async () => {
    currentWrapper = render(makeAccount());
    await flushPromises();
    expect(currentWrapper.text()).toContain('Кредитная карта');
  });

  it('мультивалютный вид у кредитки не меняется', async () => {
    currentWrapper = render(
      makeAccount({
        balances: [
          { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: -2_350_000, created_at: '' },
          { id: 'b2', account_id: 'acc-1', currency: 'USD', balance: -120, created_at: '' },
        ],
      }),
    );
    await flushPromises();
    expect(currentWrapper.find('[data-testid="account-card-credit"]').exists()).toBe(false);
  });

  it('обычный счёт рисуется как раньше', async () => {
    currentWrapper = render(
      makeAccount({
        type: 'basic',
        name: 'Основной',
        balances: [
          { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 50_000, created_at: '' },
        ],
      }),
    );
    await flushPromises();
    expect(currentWrapper.find('[data-testid="account-card-credit"]').exists()).toBe(false);
    expect(currentWrapper.text()).toContain('Основной');
  });
});
