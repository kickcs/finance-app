import type { AccountWithBalances } from '@/entities/account';
import type { SecondPart } from './paymentParts';

/** Счета, которыми можно оплатить вторую часть: не первый и с балансом в валюте операции. */
export function secondPartCandidates(
  accounts: AccountWithBalances[],
  primaryAccountId: string | null,
  currency: string,
): AccountWithBalances[] {
  return accounts.filter(
    (account) =>
      account.id !== primaryAccountId && account.balances.some((b) => b.currency === currency),
  );
}

/** Новая вторая часть: единственный подходящий счёт подставляем сразу, из нескольких выбирает пользователь. */
export function startSecondPart(candidates: AccountWithBalances[], amount = 0): SecondPart {
  return { accountId: candidates.length === 1 ? candidates[0].id : null, amount };
}

export function balanceIn(account: AccountWithBalances | undefined, currency: string): number {
  return account?.balances.find((b) => b.currency === currency)?.balance ?? 0;
}
