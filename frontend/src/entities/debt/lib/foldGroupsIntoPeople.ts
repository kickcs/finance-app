import { isPastDate } from '@/shared/lib/date';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import type { Debt, DebtDirection, DebtGroupResponse } from '../model/types';

export interface PersonDebtSummary {
  personName: string;
  /** Нетто в валюте пользователя: > 0 — вам должны, < 0 — вы должны. */
  net: number;
  /** Направление по знаку нетто. */
  direction: DebtDirection;
  debts: Debt[];
  debtCount: number;
  /** Ближайшая дата возврата среди долгов человека. */
  nearestDueDate: string | null;
  /** Дни просрочки самого просроченного долга, иначе null. */
  overdueDays: number | null;
  hasPrivate: boolean;
}

const MS_IN_DAY = 24 * 60 * 60 * 1000;

/**
 * `isPastDate` считает просрочкой любую дату строго раньше сегодняшней, поэтому
 * минимум — один день. Без пола получалось бы «просрочено 0 дней» на долге,
 * срок которого истёк вчера, а часы ещё не набежали.
 */
function daysOverdue(dueDate: string): number {
  return Math.max(1, Math.floor((Date.now() - new Date(dueDate).getTime()) / MS_IN_DAY));
}

/**
 * Сервер группирует долги по паре (человек, направление), поэтому встречные
 * долги одного человека приезжают двумя группами. В списке человек — одна
 * строка, значит группы складываются со знаком: «дал» плюсом, «взял» минусом.
 */
export function foldGroupsIntoPeople(
  groups: DebtGroupResponse[],
  convert: (amount: number, fromCurrency: string) => number,
): PersonDebtSummary[] {
  const byPerson = new Map<string, PersonDebtSummary>();

  for (const group of groups) {
    let person = byPerson.get(group.person_name);
    if (!person) {
      person = {
        personName: group.person_name,
        net: 0,
        direction: 'given',
        debts: [],
        debtCount: 0,
        nearestDueDate: null,
        overdueDays: null,
        hasPrivate: false,
      };
      byPerson.set(group.person_name, person);
    }

    for (const debt of group.debts) {
      const amount = convert(debt.remaining_amount, debt.currency || DEFAULT_CURRENCY);
      person.net += debt.debt_type === 'given' ? amount : -amount;
      person.debts.push(debt);
      person.debtCount += 1;
      if (debt.is_private) person.hasPrivate = true;

      if (debt.next_payment_date) {
        if (!person.nearestDueDate || debt.next_payment_date < person.nearestDueDate) {
          person.nearestDueDate = debt.next_payment_date;
        }
        if (isPastDate(debt.next_payment_date)) {
          person.overdueDays = Math.max(
            person.overdueDays ?? 0,
            daysOverdue(debt.next_payment_date),
          );
        }
      }
    }
  }

  const people = Array.from(byPerson.values());
  for (const person of people) {
    person.net = Math.round(person.net * 100) / 100;
    person.direction = person.net >= 0 ? 'given' : 'taken';
  }

  // Просроченные — вверх, дальше по величине: и то и другое про то, чем
  // пользователю стоит заняться в первую очередь.
  return people.sort((a, b) => {
    if (a.overdueDays !== null && b.overdueDays === null) return -1;
    if (a.overdueDays === null && b.overdueDays !== null) return 1;
    if (a.overdueDays !== null && b.overdueDays !== null && a.overdueDays !== b.overdueDays) {
      return b.overdueDays - a.overdueDays;
    }
    return Math.abs(b.net) - Math.abs(a.net);
  });
}
