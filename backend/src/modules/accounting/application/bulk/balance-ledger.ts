import type { BalanceEffect } from '../../domain/services/balance-calculation.service';

export type BalanceDelta = BalanceEffect;

/** Копилка изменений остатков; деньги копятся в копейках, чтобы 0.1 + 0.2 не давало 0.30000000000000004. */
export class BalanceLedger {
  private readonly cents = new Map<
    string,
    { accountId: string; currency: string; cents: number }
  >();

  add(accountId: string, currency: string, amount: number): void {
    const key = `${accountId}|${currency}`;
    const entry = this.cents.get(key) ?? { accountId, currency, cents: 0 };
    entry.cents += Math.round(amount * 100);
    this.cents.set(key, entry);
  }

  /** Провести (`sign` 1) или развернуть (−1) влияние строки на остатки. */
  addEffects(effects: BalanceEffect[], sign: 1 | -1): void {
    for (const effect of effects) this.add(effect.accountId, effect.currency, sign * effect.delta);
  }

  /** Ненулевые изменения в одном порядке для предпросмотра, применения и отмены. */
  deltas(): BalanceDelta[] {
    return [...this.cents.values()]
      .filter((entry) => entry.cents !== 0)
      .map((entry) => ({
        accountId: entry.accountId,
        currency: entry.currency,
        delta: entry.cents / 100,
      }))
      .sort((a, b) => compareText(a.accountId, b.accountId) || compareText(a.currency, b.currency));
  }
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
