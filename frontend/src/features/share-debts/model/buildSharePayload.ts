import type { Debt, SharedDebtsPayload, SharedDebtEntry } from '@/entities/debt';
import { getDebtSplit } from '@/entities/debt';

/**
 * Приватные долги в снимок не попадают: ссылка открывается без авторизации, и
 * тот, кто её получил, увидит ровно то, что здесь оказалось. Скрытое от чужих
 * глаз в приложении не должно утечь через шаринг.
 */
export function selectShareableDebts(debts: Debt[]): Debt[] {
  return debts.filter((debt) => !debt.is_private && !debt.is_closed);
}

export interface BuildSharePayloadInput {
  personName: string;
  /** Валюта итога — валюта пользователя. */
  currency: string;
  debts: Debt[];
  ownerName: string | null;
  /** Приводит сумму долга к валюте итога по курсу на момент снимка. */
  convert: (amount: number, fromCurrency: string) => number;
  now?: number;
}

export function buildSharePayload({
  personName,
  currency,
  debts,
  ownerName,
  convert,
  now = Date.now(),
}: BuildSharePayloadInput): SharedDebtsPayload {
  const shareable = selectShareableDebts(debts);

  let totalGiven = 0;
  let totalTaken = 0;
  const entries: SharedDebtEntry[] = [];

  for (const debt of shareable) {
    const converted = convert(debt.remaining_amount, debt.currency);
    if (debt.debt_type === 'given') totalGiven += converted;
    else totalTaken += converted;

    const { paid } = getDebtSplit(debt);
    entries.push({
      title: debt.name,
      direction: debt.debt_type,
      currency: debt.currency,
      totalAmount: debt.total_amount,
      remainingAmount: debt.remaining_amount,
      paidAmount: paid,
      dueDate: debt.next_payment_date,
      createdAt: debt.created_at,
    });
  }

  return {
    personName,
    currency,
    net: totalGiven - totalTaken,
    totalGiven,
    totalTaken,
    ownerName,
    snapshotAt: now,
    debts: entries,
  };
}
