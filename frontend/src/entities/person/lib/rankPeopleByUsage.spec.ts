import { describe, it, expect } from 'vitest';
import { rankPeopleByUsage } from './rankPeopleByUsage';
import type { Person } from '../model/types';

const NOW = new Date('2026-07-27T12:00:00.000Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function person(name: string): Person {
  return {
    id: name,
    user_id: 'u1',
    name,
    color: '#3b82f6',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

function debt(name: string, daysAgo: number) {
  return { person_name: name, created_at: new Date(NOW - daysAgo * DAY).toISOString() };
}

describe('rankPeopleByUsage', () => {
  it('ставит частого впереди редкого', () => {
    const people = [person('Редкий'), person('Частый')];
    const debts = [debt('Частый', 1), debt('Частый', 2), debt('Частый', 3), debt('Редкий', 4)];
    expect(rankPeopleByUsage(people, debts, NOW).map((p) => p.name)).toEqual(['Частый', 'Редкий']);
  });

  it('свежие долги перевешивают более многочисленные старые', () => {
    const people = [person('Старый'), person('Свежий')];
    const debts = [
      ...Array.from({ length: 6 }, () => debt('Старый', 720)),
      ...Array.from({ length: 4 }, () => debt('Свежий', 10)),
    ];
    expect(rankPeopleByUsage(people, debts, NOW).map((p) => p.name)).toEqual(['Свежий', 'Старый']);
  });

  it('людей без долгов отправляет в конец и сортирует по алфавиту', () => {
    const people = [person('Яна'), person('Борис'), person('Анна')];
    const debts = [debt('Яна', 5)];
    expect(rankPeopleByUsage(people, debts, NOW).map((p) => p.name)).toEqual([
      'Яна',
      'Анна',
      'Борис',
    ]);
  });

  it('сопоставляет имя без учёта регистра и краевых пробелов', () => {
    const people = [person('Тихий'), person('Азиз')];
    const debts = [debt('  азиз ', 1), debt('АЗИЗ', 2)];
    expect(rankPeopleByUsage(people, debts, NOW).map((p) => p.name)).toEqual(['Азиз', 'Тихий']);
  });

  it('без долгов отдаёт алфавитный порядок', () => {
    const people = [person('Яна'), person('Анна')];
    expect(rankPeopleByUsage(people, undefined, NOW).map((p) => p.name)).toEqual(['Анна', 'Яна']);
  });

  it('пропускает долги без имени', () => {
    const people = [person('Анна')];
    const debts = [{ person_name: null, created_at: new Date(NOW).toISOString() }];
    expect(rankPeopleByUsage(people, debts, NOW).map((p) => p.name)).toEqual(['Анна']);
  });

  it('пропускает долги с битой датой, не ломая порядок остальных', () => {
    const people = [person('Битый'), person('Анна')];
    const debts = [{ person_name: 'Битый', created_at: 'не дата' }, debt('Анна', 1)];
    expect(rankPeopleByUsage(people, debts, NOW).map((p) => p.name)).toEqual(['Анна', 'Битый']);
  });

  it('не мутирует входной массив', () => {
    const people = [person('Яна'), person('Анна')];
    const copy = [...people];
    rankPeopleByUsage(people, [debt('Яна', 1)], NOW);
    expect(people).toEqual(copy);
  });
});
