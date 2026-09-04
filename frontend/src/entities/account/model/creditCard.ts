import type { Account, AccountWithBalances } from '@/shared/api/database.types';

/** Соглашение о балансе кредитки: минус — долг банку, плюс — свои деньги на карте. */
export interface CreditCardState {
  debt: number;
  ownFunds: number;
  limit: number | null;
  available: number | null;
  utilization: number | null;
}

export function getCreditCardState(
  account: Pick<Account, 'credit_limit'>,
  balance: number,
): CreditCardState {
  const limit = account.credit_limit;
  const debt = Math.max(0, -balance);
  const hasLimit = typeof limit === 'number' && limit > 0;

  return {
    debt,
    ownFunds: Math.max(0, balance),
    limit,
    // Доступное зажато отрезком [0, лимит]: перерасход — это ноль доступного, а не
    // отрицательный остаток, и свои деньги на карте лимит не увеличивают. Без
    // лимита доступного нет вовсе — нулём его показывать нечестно.
    available: hasLimit ? Math.min(limit, Math.max(0, limit + balance)) : null,
    utilization: hasLimit ? Math.min(1, debt / limit) : null,
  };
}

export function isCreditCard(account: Pick<Account, 'type'>): boolean {
  return account.type === 'credit_card';
}

/**
 * Предзаполнение долга при конвертации обычного счёта в кредитку: если на счёте
 * лежит сумма меньше лимита, вероятнее всего это доступный остаток по карте.
 * Нулевой баланс из этой догадки исключён: «на счёте пусто» одинаково похоже и
 * на выбранный лимит, и на карту без долга, а угадывать весь лимит — дороже.
 */
export function suggestDebtOnConversion(balance: number, limit: number | null): number {
  if (typeof limit !== 'number' || limit <= 0) return 0;
  if (balance <= 0 || balance >= limit) return 0;
  return limit - balance;
}

export function sumCreditCardDebtByCurrency(
  accounts: AccountWithBalances[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const account of accounts) {
    if (!isCreditCard(account)) continue;
    for (const balance of account.balances ?? []) {
      const debt = Math.max(0, -balance.balance);
      if (debt === 0) continue;
      totals[balance.currency] = (totals[balance.currency] ?? 0) + debt;
    }
  }
  return totals;
}
