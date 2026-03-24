// frontend/src/shared/lib/utils/financialPeriod.ts

/**
 * Resolve startDay for a specific month.
 * If startDay > days in month, returns last day.
 */
export function resolveStartDay(year: number, month: number, startDay: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.min(startDay, daysInMonth);
}

/**
 * Returns financial month boundaries (exclusive end).
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
 * Returns current financial month.
 */
export function getCurrentFinancialMonth(startDay: number): { year: number; month: number } {
  return getFinancialMonth(new Date(), startDay);
}

const SHORT_MONTHS_RU = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

const FULL_MONTHS_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

/**
 * Format financial period label.
 * startDay=1: "Март 2026"
 * startDay≠1: "15 мар – 14 апр"
 */
export function formatFinancialPeriod(year: number, month: number, startDay: number): string {
  if (startDay === 1) {
    return `${FULL_MONTHS_RU[month - 1]} ${year}`;
  }
  const { start, end } = getFinancialMonthBounds(year, month, startDay);
  const endInclusive = new Date(end.getTime() - 1); // exclusive → last day

  const startStr = `${start.getDate()} ${SHORT_MONTHS_RU[start.getMonth()]}`;
  const endStr = `${endInclusive.getDate()} ${SHORT_MONTHS_RU[endInclusive.getMonth()]}`;

  return `${startStr} – ${endStr}`;
}

/**
 * Days remaining in current financial period, inclusive of today. Minimum 1.
 */
export function getDaysRemainingInPeriod(startDay: number): number {
  const now = new Date();
  const { year, month } = getCurrentFinancialMonth(startDay);
  const { end } = getFinancialMonthBounds(year, month, startDay);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = end.getTime() - todayStart.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}
