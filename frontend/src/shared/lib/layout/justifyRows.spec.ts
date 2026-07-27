import { describe, it, expect } from 'vitest';
import { packJustifiedRows } from './justifyRows';

describe('packJustifiedRows', () => {
  it('пустой список даёт пустой результат', () => {
    expect(packJustifiedRows([], 300, 6)).toEqual([]);
  });

  it('всё, что влезает в один ряд, остаётся одним рядом', () => {
    expect(packJustifiedRows([50, 60, 70], 300, 6)).toEqual([[0, 1, 2]]);
  });

  it('неизвестная ширина контейнера даёт один ряд со всеми элементами', () => {
    expect(packJustifiedRows([50, 60, 70], 0, 6)).toEqual([[0, 1, 2]]);
  });

  it('элемент шире контейнера получает собственный ряд и не режется', () => {
    expect(packJustifiedRows([400, 50], 300, 6)).toEqual([[0], [1]]);
  });

  it('ни один ряд не превышает ширину контейнера', () => {
    const widths = [80, 80, 80, 80, 80];
    const rows = packJustifiedRows(widths, 250, 10);

    for (const row of rows) {
      const natural = row.reduce((sum, i) => sum + widths[i], 0) + 10 * (row.length - 1);
      expect(natural).toBeLessThanOrEqual(250);
    }
  });

  it('балансирует ряды вместо жадной набивки', () => {
    // Семь равных чипов в три ряда. Жадная упаковка «пока влезает» даёт
    // 3+3+1 — последний ряд на 100 из 350 px, ровно тот рваный край, из-за
    // которого формула и переписана. Балансировка должна дать 2+2+3.
    const widths = [100, 100, 100, 100, 100, 100, 100];
    const rows = packJustifiedRows(widths, 350, 6);

    expect(rows).toEqual([
      [0, 1],
      [2, 3],
      [4, 5, 6],
    ]);
  });

  it('выравнивает наполнение рядов, а не оставляет тощий хвост', () => {
    const widths = [100, 100, 100, 100, 100, 100, 100];
    const rows = packJustifiedRows(widths, 350, 6);

    const fills = rows.map(
      (row) => row.reduce((sum, i) => sum + widths[i], 0) + 6 * (row.length - 1),
    );
    // Жадная упаковка дала бы разброс 312 − 100 = 212.
    expect(Math.max(...fills) - Math.min(...fills)).toBeLessThan(150);
  });

  it('учитывает зазор при подсчёте числа рядов', () => {
    // Без учёта зазоров 3×100 влезли бы в 300; с двумя зазорами по 6 — нет.
    expect(packJustifiedRows([100, 100, 100], 300, 6).length).toBeGreaterThan(1);
  });

  it('сохраняет исходный порядок элементов', () => {
    expect(packJustifiedRows([100, 100, 100, 100], 250, 6).flat()).toEqual([0, 1, 2, 3]);
  });
});
