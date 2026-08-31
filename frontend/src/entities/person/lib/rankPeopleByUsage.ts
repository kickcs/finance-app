import { personKey } from './personKey';
import type { Person } from '../model/types';

/**
 * Долг глазами ранжирования: только имя и момент создания. Структурный тип, а
 * не импорт `entities/debt`, — соседний слой той же высоты трогать нельзя.
 */
export interface DebtUsage {
  person_name: string | null;
  created_at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Через столько дней долг весит вдвое меньше свежего. */
const HALF_LIFE_DAYS = 90;

/**
 * Порядок людей: от часто используемых к редким.
 *
 * Вес одного долга затухает по времени (`0.5^(дни/90)`), поэтому шесть долгов
 * двухлетней давности не обгоняют четыре за последний месяц: список должен
 * показывать, с кем пользователь имеет дело сейчас, а не с кем имел когда-то.
 *
 * Ключ — нормализованное имя: долги хранят его свободным текстом, без
 * `person_id`, и «азиз», «Азиз» и « АЗИЗ » — один человек.
 *
 * Контакты без единого долга уходят в хвост по алфавиту: у них нет сигнала, а
 * произвольный порядок сервера читался бы как случайный.
 */
export function rankPeopleByUsage(
  people: Person[],
  debts: DebtUsage[] | undefined,
  now: number = Date.now(),
): Person[] {
  const scores = new Map<string, number>();

  for (const debt of debts ?? []) {
    const name = debt.person_name?.trim();
    if (!name) continue;

    const createdAt = new Date(debt.created_at).getTime();
    // Битая дата дала бы NaN, а NaN в сравнении сортировки молча сломал бы
    // порядок всего списка. Такой долг просто не голосует.
    if (Number.isNaN(createdAt)) continue;

    const ageDays = Math.max(0, (now - createdAt) / DAY_MS);
    const weight = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    const key = personKey(name);
    scores.set(key, (scores.get(key) ?? 0) + weight);
  }

  return [...people].sort((a, b) => {
    const scoreA = scores.get(personKey(a.name)) ?? 0;
    const scoreB = scores.get(personKey(b.name)) ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.name.localeCompare(b.name, 'ru');
  });
}
