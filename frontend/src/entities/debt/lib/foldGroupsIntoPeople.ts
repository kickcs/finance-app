import { isPastDate } from '@/shared/lib/date';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import type { Debt, DebtDirection, DebtGroupResponse } from '../model/types';

/**
 * Встречные долги одного человека в одной валюте. Зачёт возможен только внутри
 * валюты: гасить сумы долларами по курсу дня — это уже обмен, а не зачёт.
 */
export interface MutualPosition {
  currency: string;
  /** Сколько вам должны в этой валюте. */
  given: number;
  /** Сколько должны вы. */
  taken: number;
  /** Сколько погасит зачёт — меньшая из двух сторон. */
  offsetAmount: number;
}

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
  /** Валюты, в которых есть обе стороны. Пусто — зачитывать нечего. */
  mutual: MutualPosition[];
  /** Сумма зачёта по всем валютам, приведённая к валюте пользователя. */
  offsetTotal: number;
}

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

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
  const sidesByPerson = new Map<string, Map<string, { given: number; taken: number }>>();

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
        mutual: [],
        offsetTotal: 0,
      };
      byPerson.set(group.person_name, person);
      sidesByPerson.set(group.person_name, new Map());
    }
    const sides = sidesByPerson.get(group.person_name)!;

    for (const debt of group.debts) {
      const debtCurrency = debt.currency || DEFAULT_CURRENCY;
      const amount = convert(debt.remaining_amount, debtCurrency);
      person.net += debt.debt_type === 'given' ? amount : -amount;

      const side = sides.get(debtCurrency) ?? { given: 0, taken: 0 };
      side[debt.debt_type === 'given' ? 'given' : 'taken'] += debt.remaining_amount;
      sides.set(debtCurrency, side);

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

    const sides = sidesByPerson.get(person.personName);
    if (!sides) continue;
    // Валюты сравниваются между собой только после приведения к валюте
    // пользователя: 40 долларов зачёта важнее 50 000 сумов, а не наоборот.
    const weighted: Array<{ position: MutualPosition; weight: number }> = [];
    for (const [currency, { given, taken }] of sides) {
      if (given <= 0 || taken <= 0) continue;
      const offsetAmount = round2(Math.min(given, taken));
      const weight = convert(offsetAmount, currency);
      weighted.push({
        position: { currency, given: round2(given), taken: round2(taken), offsetAmount },
        weight,
      });
      person.offsetTotal += weight;
    }
    weighted.sort((a, b) => b.weight - a.weight);
    person.mutual = weighted.map((entry) => entry.position);
    person.offsetTotal = round2(person.offsetTotal);
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
