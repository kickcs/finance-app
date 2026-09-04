import { describe, it, expect } from 'vitest';
import {
  getCreditCardState,
  isCreditCard,
  suggestDebtOnConversion,
  sumCreditCardDebtByCurrency,
} from './creditCard';
import { VISIBLE_ACCOUNT_TYPES, ACCOUNT_TYPE_ICONS } from './account-types';
import type { AccountWithBalances } from '@/shared/api/database.types';

function makeAccount(over: Partial<AccountWithBalances> = {}): AccountWithBalances {
  return {
    id: 'acc-1',
    user_id: 'u1',
    name: 'Карта',
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

describe('getCreditCardState', () => {
  it('отрицательный баланс — это задолженность', () => {
    const s = getCreditCardState({ credit_limit: 10_000_000 }, -2_350_000);
    expect(s.debt).toBe(2_350_000);
    expect(s.ownFunds).toBe(0);
  });

  it('положительный баланс — собственные средства, долга нет', () => {
    const s = getCreditCardState({ credit_limit: 10_000_000 }, 300_000);
    expect(s.debt).toBe(0);
    expect(s.ownFunds).toBe(300_000);
  });

  it('доступно = лимит + баланс', () => {
    expect(getCreditCardState({ credit_limit: 10_000_000 }, -2_350_000).available).toBe(7_650_000);
  });

  it('при перерасходе доступно — ноль, а не отрицательное', () => {
    expect(getCreditCardState({ credit_limit: 500_000 }, -650_000).available).toBe(0);
  });

  it('свои средства на карте доступное сверх лимита не раздувают', () => {
    expect(getCreditCardState({ credit_limit: 500_000 }, 50_000).available).toBe(500_000);
  });

  it('утилизация — доля долга в лимите', () => {
    expect(getCreditCardState({ credit_limit: 10_000_000 }, -2_000_000).utilization).toBeCloseTo(
      0.2,
    );
  });

  it('утилизация зажата единицей при перерасходе', () => {
    expect(getCreditCardState({ credit_limit: 1_000_000 }, -3_000_000).utilization).toBe(1);
  });

  it('без лимита доступно и утилизация — null', () => {
    const s = getCreditCardState({ credit_limit: null }, -500_000);
    expect(s.limit).toBeNull();
    expect(s.available).toBeNull();
    expect(s.utilization).toBeNull();
    expect(s.debt).toBe(500_000);
  });

  it('нулевой лимит не даёт утилизацию', () => {
    expect(getCreditCardState({ credit_limit: 0 }, -500_000).utilization).toBeNull();
  });
});

describe('isCreditCard', () => {
  it('true для credit_card', () => {
    expect(isCreditCard({ type: 'credit_card' })).toBe(true);
  });
  it('false для остальных типов', () => {
    expect(isCreditCard({ type: 'basic' })).toBe(false);
    expect(isCreditCard({ type: 'savings' })).toBe(false);
  });
});

describe('suggestDebtOnConversion', () => {
  it('баланс внутри [0, лимит) читается как доступный остаток', () => {
    expect(suggestDebtOnConversion(3_000_000, 10_000_000)).toBe(7_000_000);
    expect(suggestDebtOnConversion(0, 10_000_000)).toBe(10_000_000);
  });
  it('баланс выше лимита — 0', () => {
    expect(suggestDebtOnConversion(12_000_000, 10_000_000)).toBe(0);
    expect(suggestDebtOnConversion(10_000_000, 10_000_000)).toBe(0);
  });
  it('отрицательный баланс — 0', () => {
    expect(suggestDebtOnConversion(-500_000, 10_000_000)).toBe(0);
  });
  it('без лимита или при нулевом лимите — 0', () => {
    expect(suggestDebtOnConversion(3_000_000, null)).toBe(0);
    expect(suggestDebtOnConversion(3_000_000, 0)).toBe(0);
  });
});

describe('sumCreditCardDebtByCurrency', () => {
  it('складывает долги только по кредиткам и только по валютам с долгом', () => {
    const cards = [
      makeAccount(),
      makeAccount({
        id: 'acc-2',
        balances: [
          { id: 'b2', account_id: 'acc-2', currency: 'UZS', balance: -650_000, created_at: '' },
          { id: 'b3', account_id: 'acc-2', currency: 'USD', balance: -120, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
      makeAccount({
        id: 'acc-3',
        type: 'basic',
        balances: [
          { id: 'b4', account_id: 'acc-3', currency: 'UZS', balance: -9_000_000, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
    ];
    expect(sumCreditCardDebtByCurrency(cards)).toEqual({ UZS: 3_000_000, USD: 120 });
  });

  it('карта без долга не попадает в итог', () => {
    const cards = [
      makeAccount({
        balances: [
          { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 400_000, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
    ];
    expect(sumCreditCardDebtByCurrency(cards)).toEqual({});
  });

  it('пустой список — пустой итог', () => {
    expect(sumCreditCardDebtByCurrency([])).toEqual({});
  });
});

describe('account-types', () => {
  it('кредитка видна в форме создания', () => {
    expect(VISIBLE_ACCOUNT_TYPES).toEqual(['basic', 'savings', 'cash', 'credit_card']);
  });

  it('у каждого типа есть иконка', () => {
    expect(ACCOUNT_TYPE_ICONS).toEqual({
      basic: 'account_balance_wallet',
      savings: 'savings',
      cash: 'payments',
      credit_card: 'credit_card',
      loan: 'account_balance',
      deposit: 'diamond',
    });
  });
});
