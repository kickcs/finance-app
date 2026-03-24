// backend/src/shared/utils/financial-period.ts

/**
 * Resolve startDay for a specific month.
 * If startDay > days in month (e.g. 31 in February), returns last day.
 */
export function resolveStartDay(year: number, month: number, startDay: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.min(startDay, daysInMonth);
}

/**
 * Returns financial month boundaries.
 * start is inclusive, end is EXCLUSIVE (matches existing codebase convention).
 */
export function getFinancialMonthBounds(
  year: number,
  month: number,
  startDay: number,
): { start: Date; end: Date } {
  const resolvedDay = resolveStartDay(year, month, startDay);
  const start = new Date(year, month - 1, resolvedDay);

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextResolvedDay = resolveStartDay(nextYear, nextMonth, startDay);
  const end = new Date(nextYear, nextMonth - 1, nextResolvedDay);

  return { start, end };
}

/**
 * Determines which financial month a date belongs to.
 */
export function getFinancialMonth(date: Date, startDay: number): { year: number; month: number } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const resolvedDay = resolveStartDay(year, month, startDay);

  if (day >= resolvedDay) {
    return { year, month };
  } else {
    if (month === 1) {
      return { year: year - 1, month: 12 };
    }
    return { year, month: month - 1 };
  }
}

/**
 * Returns the current financial month.
 */
export function getCurrentFinancialMonth(startDay: number): { year: number; month: number } {
  return getFinancialMonth(new Date(), startDay);
}
