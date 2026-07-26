import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import type { Debt } from '@/shared/api/database.types';

export interface PersonDebtNet {
  /** Нетто в валюте пользователя: > 0 — вам должны, < 0 — вы должны. */
  net: number;
  debtCount: number;
}

/**
 * Ключ карты. Долги хранят имя человека свободным текстом, без `person_id`,
 * поэтому единственный доступный ключ — нормализованная строка имени.
 */
export function personKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Сворачивает открытые долги в нетто по человеку.
 *
 * Знак — тот же, что в `foldGroupsIntoPeople` на странице долгов: «дал» плюсом,
 * «взял» минусом, чтобы встречные долги одного человека гасили друг друга и
 * строка списка показывала одну итоговую сумму вместо двух.
 */
export function foldDebtsByPersonName(
  debts: Debt[],
  convert: (amount: number, fromCurrency: string) => number,
): Map<string, PersonDebtNet> {
  const byPerson = new Map<string, PersonDebtNet>();

  for (const debt of debts) {
    if (debt.is_closed) continue;

    const name = debt.person_name?.trim();
    if (!name) continue;

    const key = personKey(name);
    const amount = convert(debt.remaining_amount, debt.currency || DEFAULT_CURRENCY);
    const entry = byPerson.get(key) ?? { net: 0, debtCount: 0 };

    entry.net += debt.debt_type === 'given' ? amount : -amount;
    entry.debtCount += 1;
    byPerson.set(key, entry);
  }

  return byPerson;
}
