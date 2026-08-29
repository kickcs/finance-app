import { describe, it, expect } from 'vitest';
import { usePanelState } from './usePanelState';
import type { TransactionFormData, TransactionType } from './useTransactionForm';
import type { AccountWithBalances } from '@/entities/account';

// ---------------------------------------------------------------------------
// usePanelState — pure unit tests
// ---------------------------------------------------------------------------

const ACCOUNT: AccountWithBalances = {
  id: 'acc-1',
  user_id: 'user-1',
  name: 'HamkorBank',
  type: 'bank',
  color: '#4F46E5',
  icon: 'account_balance',
  is_archived: false,
  created_at: '2025-01-01T00:00:00.000Z',
  balances: [{ currency: 'UZS', balance: 1_466_615 }],
} as unknown as AccountWithBalances;

function state(overrides: Partial<TransactionFormData> & { type: TransactionType }) {
  const formData: TransactionFormData = {
    accountId: ACCOUNT.id,
    categoryId: 'cat-salary',
    amount: 0,
    currency: 'UZS',
    description: '',
    date: Date.now(),
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
    feeAmount: 0,
    feeType: 'fixed',
    ...overrides,
  };
  return usePanelState({ formData, accounts: [ACCOUNT] }, () => {});
}

describe('hasSufficientFunds', () => {
  it('доход не списывает счёт — предупреждения нет даже сверх остатка', () => {
    expect(state({ type: 'income', amount: 16_341_440 }).hasSufficientFunds.value).toBe(true);
  });

  it('расход сверх остатка не проходит', () => {
    expect(state({ type: 'expense', amount: 16_341_440 }).hasSufficientFunds.value).toBe(false);
  });

  it('расход в пределах остатка проходит', () => {
    expect(state({ type: 'expense', amount: 1_000_000 }).hasSufficientFunds.value).toBe(true);
  });

  it('перевод сверх остатка не проходит — деньги уходят с исходного счёта', () => {
    expect(state({ type: 'transfer', amount: 2_000_000 }).hasSufficientFunds.value).toBe(false);
  });
});
