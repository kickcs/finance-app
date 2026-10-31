import { toLocalISODate } from '@/shared/lib/date';
import { formatCompactDate } from '@/shared/lib/format/date';
import { getFinancialMonth, getFinancialMonthBounds } from '@/shared/lib/utils/financialPeriod';

export type PeriodPreset = 'month' | 'prev_month' | 'last7' | 'last30' | 'custom';

/** Период в фильтре «Истории»; `from`/`to` читаются только у `custom`, и любая граница может быть пустой. */
export interface HistoryPeriod {
  preset: PeriodPreset;
  from: string | null;
  to: string | null;
}

/** Календарные даты `YYYY-MM-DD`, обе границы включительно — формат, который ждёт сервер. */
export interface ResolvedPeriod {
  startDate?: string;
  endDate?: string;
}

export const PERIOD_PRESETS: { id: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { id: 'month', label: 'Этот месяц' },
  { id: 'prev_month', label: 'Прошлый месяц' },
  { id: 'last7', label: 'Последние 7 дней' },
  { id: 'last30', label: 'Последние 30 дней' },
];

/** `custom` без единой даты ничего не ограничивает, поэтому чипом «Период» не считается. */
export function isPeriodActive(period: HistoryPeriod | null): period is HistoryPeriod {
  return !!period && (period.preset !== 'custom' || !!period.from || !!period.to);
}

/** Перепутанные границы меняем местами: пустая выборка из-за порядка выбора дат выглядела бы как баг. */
function orderedCustomBounds(period: HistoryPeriod): { from: string | null; to: string | null } {
  const { from, to } = period;
  return from && to && from > to ? { from: to, to: from } : { from, to };
}

/**
 * Границы периода на момент `now`: в хранилище пресет, а не даты, чтобы «последние 7 дней» сдвигались.
 * `new Date(y, m, d ± n)`, а не миллисекунды, — не ломается на переводе часов.
 */
export function resolvePeriod(
  period: HistoryPeriod | null,
  now: Date,
  startDay: number,
): ResolvedPeriod {
  if (!period) return {};
  const day = startDay || 1;
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const today = new Date(y, m, d);

  switch (period.preset) {
    case 'month': {
      const current = getFinancialMonth(today, day);
      const { start } = getFinancialMonthBounds(current.year, current.month, day);
      return { startDate: toLocalISODate(start), endDate: toLocalISODate(today) };
    }
    case 'prev_month': {
      const current = getFinancialMonth(today, day);
      const year = current.month === 1 ? current.year - 1 : current.year;
      const month = current.month === 1 ? 12 : current.month - 1;
      const { start, end } = getFinancialMonthBounds(year, month, day);
      // `end` исключающий — последний день прошлого месяца на сутки раньше.
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
      return { startDate: toLocalISODate(start), endDate: toLocalISODate(last) };
    }
    case 'last7':
      return { startDate: toLocalISODate(new Date(y, m, d - 6)), endDate: toLocalISODate(today) };
    case 'last30':
      return { startDate: toLocalISODate(new Date(y, m, d - 29)), endDate: toLocalISODate(today) };
    case 'custom': {
      const { from, to } = orderedCustomBounds(period);
      return { startDate: from ?? undefined, endDate: to ?? undefined };
    }
  }
}

/** Подпись значения на чипе: «Этот месяц», «12 окт – 20 окт», «с 12 окт»; у неактивного периода пустая. */
export function periodLabel(period: HistoryPeriod | null): string {
  if (!isPeriodActive(period)) return '';
  if (period.preset !== 'custom') {
    return PERIOD_PRESETS.find((p) => p.id === period.preset)?.label ?? '';
  }
  const { from, to } = orderedCustomBounds(period);
  if (from && to) return `${formatCompactDate(from)} – ${formatCompactDate(to)}`;
  if (from) return `с ${formatCompactDate(from)}`;
  return to ? `по ${formatCompactDate(to)}` : '';
}
