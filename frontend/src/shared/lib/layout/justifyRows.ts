/**
 * Раскладка чипов по рядам так, чтобы каждый ряд заполнял ширину контейнера.
 *
 * Обычная жадная упаковка «пока влезает» оставляет последний ряд полупустым —
 * именно это и видно на экране как рваный правый край. Здесь сначала считается,
 * сколько рядов вообще нужно, а потом элементы раскладываются по цели
 * «одинаковое наполнение ряда»: тогда добор ширины через `flex-grow`
 * распределяется мелкими долями и не бросается в глаза.
 */

/** Сколько рядов даёт жадная упаковка — это и есть достижимый минимум. */
function fitRowCount(widths: number[], containerWidth: number, gap: number): number {
  let rows = 1;
  let rowWidth = 0;

  for (const width of widths) {
    const add = width + (rowWidth ? gap : 0);
    if (rowWidth && rowWidth + add > containerWidth) {
      rows++;
      rowWidth = width;
    } else {
      rowWidth += add;
    }
  }

  return rows;
}

export function packJustifiedRows(
  widths: number[],
  containerWidth: number,
  gap: number,
): number[][] {
  const count = widths.length;
  if (count === 0) return [];

  const allInOne = () => [widths.map((_, index) => index)];

  // Ширина контейнера ещё не измерена (скрытый узел, первый кадр) — отдаём один
  // ряд: в шаблоне он ведёт себя как прежний `flex-wrap`.
  if (containerWidth <= 0) return allInOne();

  const total = widths.reduce((sum, width) => sum + width, 0) + gap * (count - 1);
  if (total <= containerWidth) return allInOne();

  const rowCount = fitRowCount(widths, containerWidth, gap);
  if (rowCount <= 1) return allInOne();

  const target = total / rowCount;

  const rows: number[][] = [];
  let current: number[] = [];
  let currentWidth = 0;

  for (let index = 0; index < count; index++) {
    const width = widths[index];
    const withItem = currentWidth + width + (current.length ? gap : 0);

    // Переполнение рвём всегда: ряд шире контейнера пришлось бы сжимать, а
    // сжатие режет названия — ровно то, чего мы избегаем.
    const overflows = current.length > 0 && withItem > containerWidth;

    // Балансировка: закрываем ряд, если элемент перелетит цель сильнее, чем
    // недолетает остановка на текущем содержимом. Последний разрешённый ряд не
    // закрываем — иначе появился бы лишний.
    const unbalances =
      current.length > 0 && rows.length < rowCount - 1 && withItem - target > target - currentWidth;

    if (overflows || unbalances) {
      rows.push(current);
      current = [index];
      currentWidth = width;
    } else {
      current.push(index);
      currentWidth = withItem;
    }
  }

  if (current.length) rows.push(current);
  return rows;
}
