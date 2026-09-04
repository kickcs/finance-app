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
    // Доступное зажато в [0, лимит]; без лимита его нет вовсе (null, не 0).
    available: hasLimit ? Math.min(limit, Math.max(0, limit + balance)) : null,
    utilization: hasLimit ? Math.min(1, debt / limit) : null,
  };
}

export function isCreditCard(account: Pick<Account, 'type'>): boolean {
  return account.type === 'credit_card';
}

/**
 * Предзаполнение долга при конвертации в кредитку: минус на счёте — уже долг,
 * плюс меньше лимита — скорее всего доступный остаток. Пустой счёт — 0.
 */
export function suggestDebtOnConversion(balance: number, limit: number | null): number {
  if (balance < 0) return -balance;
  if (typeof limit !== 'number' || limit <= 0) return 0;
  if (balance === 0 || balance >= limit) return 0;
  return limit - balance;
}

// Зеркалит порог сервера: adjust-balance отвечает 400 на разницу меньше 0.01.
const BALANCE_EPSILON = 0.01;

/**
 * Баланс, который нужно выставить корректировкой при конвертации; null — трогать
 * не надо. Нулевой долг обнуляет валюту, только если баланс уже в минусе.
 */
export function conversionTargetBalance(balance: number, debt: number): number | null {
  const owed = Number.isFinite(debt) && debt > 0 ? debt : 0;
  if (owed === 0 && balance >= 0) return null;
  const target = owed === 0 ? 0 : -owed;
  return Math.abs(target - balance) < BALANCE_EPSILON ? null : target;
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
