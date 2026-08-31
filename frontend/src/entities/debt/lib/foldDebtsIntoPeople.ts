import { personKey } from '@/entities/person/lib/personKey';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import {
  getDebtOverdueDays,
  type Debt,
  type DebtDirection,
  type DebtGroupResponse,
} from '../model/types';

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
  /** Нормализованное имя: по нему человека находят в других списках. */
  key: string;
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Сворачивает долги в одну строку на человека: «дал» плюсом, «взял» минусом,
 * чтобы встречные долги гасили друг друга и человек показывался одной итоговой
 * суммой вместо двух.
 *
 * Закрытые долги не отсеиваются — что попадёт в свёртку, решает вызывающий
 * (страница долгов сворачивает и закрытые тоже, на вкладке «Закрытые»).
 */
export function foldDebtsIntoPeople(
  debts: Debt[],
  convert: (amount: number, fromCurrency: string) => number,
): PersonDebtSummary[] {
  const byPerson = new Map<string, PersonDebtSummary>();
  const sidesByPerson = new Map<string, Map<string, { given: number; taken: number }>>();

  for (const debt of debts) {
    // Сервер группирует по `person_name` и пустое имя отдаёт как '' — ключ
    // считается так же, иначе безымянные долги разъедутся по строкам.
    const personName = debt.person_name?.trim() ?? '';
    const key = personKey(personName);

    let person = byPerson.get(key);
    if (!person) {
      person = {
        key,
        personName,
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
      byPerson.set(key, person);
      sidesByPerson.set(key, new Map());
    }
    const sides = sidesByPerson.get(key)!;

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
      const overdue = getDebtOverdueDays(debt);
      if (overdue !== null) person.overdueDays = Math.max(person.overdueDays ?? 0, overdue);
    }
  }

  const people = Array.from(byPerson.values());
  for (const person of people) {
    // Конвертация делением оставляет хвост в последних разрядах, и встречные
    // долги, гасящие друг друга ровно, давали бы не 0, а 1e-11 — строка
    // показывала бы «должен вам 0».
    person.net = round2(person.net);
    person.direction = person.net >= 0 ? 'given' : 'taken';

    const sides = sidesByPerson.get(person.key);
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

/**
 * Тот же расчёт для страницы долгов: сервер отдаёт встречные долги человека
 * двумя группами, свёртка их снова склеивает.
 */
export function foldGroupsIntoPeople(
  groups: DebtGroupResponse[],
  convert: (amount: number, fromCurrency: string) => number,
): PersonDebtSummary[] {
  return foldDebtsIntoPeople(
    groups.flatMap((group) => group.debts),
    convert,
  );
}
