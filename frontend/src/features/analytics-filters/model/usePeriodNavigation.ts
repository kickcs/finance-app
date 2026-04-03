import { ref, computed } from 'vue';
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
import {
  getFinancialMonthBounds,
  getFinancialMonth,
  formatFinancialPeriod,
} from '@/shared/lib/utils/financialPeriod';
import { toLocalISODate } from '@/shared/lib/date';
import { getCachedDateFormat } from '@/shared/lib/format/intlCache';
import type { PeriodScale } from './types';

export function usePeriodNavigation() {
  const { startDay, currentPeriod, currentBounds } = useFinancialPeriod();

  const scale = ref<PeriodScale>('month');
  const offset = ref(0);

  function getToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  /** Resolve financial month bounds for a given offset from current period */
  function resolveMonthBounds(monthOffset: number): { startDate: string; endDate: string } {
    const { year, month } = currentPeriod.value;
    const targetDate = addMonths(new Date(year, month - 1, 1), monthOffset);
    const targetFM = getFinancialMonth(
      new Date(targetDate.getFullYear(), targetDate.getMonth(), startDay.value || 1),
      startDay.value,
    );
    const bounds = getFinancialMonthBounds(targetFM.year, targetFM.month, startDay.value);
    const endInclusive = new Date(bounds.end.getTime() - 1);
    return {
      startDate: toLocalISODate(bounds.start),
      endDate: toLocalISODate(endInclusive),
    };
  }

  /** Resolve financial month label for a given offset from current period */
  function resolveMonthLabel(monthOffset: number): string {
    const { year, month } = currentPeriod.value;
    const targetDate = addMonths(new Date(year, month - 1, 1), monthOffset);
    const targetFM = getFinancialMonth(
      new Date(targetDate.getFullYear(), targetDate.getMonth(), startDay.value || 1),
      startDay.value,
    );
    return formatFinancialPeriod(targetFM.year, targetFM.month, startDay.value);
  }

  const dateRange = computed<{ startDate: string; endDate: string }>(() => {
    const today = getToday();
    const isCurrent = offset.value === 0;

    switch (scale.value) {
      case 'day': {
        const d = new Date(today);
        d.setDate(d.getDate() + offset.value);
        const iso = toLocalISODate(d);
        return { startDate: iso, endDate: iso };
      }

      case 'month': {
        if (isCurrent) {
          const { start } = currentBounds.value;
          return {
            startDate: toLocalISODate(start),
            endDate: toLocalISODate(today),
          };
        }
        return resolveMonthBounds(offset.value);
      }

      case 'year': {
        const targetYear = today.getFullYear() + offset.value;
        if (isCurrent) {
          return {
            startDate: `${targetYear}-01-01`,
            endDate: toLocalISODate(today),
          };
        }
        return {
          startDate: `${targetYear}-01-01`,
          endDate: `${targetYear}-12-31`,
        };
      }
      default:
        return { startDate: '', endDate: '' };
    }
  });

  const comparisonDateRange = computed<{ startDate: string; endDate: string }>(() => {
    const today = getToday();
    const compOffset = offset.value - 1;

    switch (scale.value) {
      case 'day': {
        const d = new Date(today);
        d.setDate(d.getDate() + compOffset);
        const iso = toLocalISODate(d);
        return { startDate: iso, endDate: iso };
      }

      case 'month':
        return resolveMonthBounds(compOffset);

      case 'year': {
        const targetYear = today.getFullYear() + compOffset;
        return {
          startDate: `${targetYear}-01-01`,
          endDate: `${targetYear}-12-31`,
        };
      }
      default:
        return { startDate: '', endDate: '' };
    }
  });

  const label = computed<string>(() => {
    const today = getToday();

    switch (scale.value) {
      case 'day': {
        const d = new Date(today);
        d.setDate(d.getDate() + offset.value);
        const fmt = getCachedDateFormat('ru-RU', {
          day: 'numeric',
          month: 'long',
          weekday: 'short',
        });
        return fmt.format(d);
      }

      case 'month':
        return resolveMonthLabel(offset.value);

      case 'year':
        return String(today.getFullYear() + offset.value);
      default:
        return '';
    }
  });

  const sublabel = computed<string>(() => {
    const { startDate, endDate } = dateRange.value;
    if (!startDate || !endDate) return '';

    const fmt = getCachedDateFormat('ru-RU', { day: 'numeric', month: 'short' });
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const days = daysInPeriod.value;

    return `${fmt.format(start)} – ${fmt.format(end)} · ${days} дн`;
  });

  const isCurrentPeriod = computed(() => offset.value === 0);
  const canGoNext = computed(() => offset.value < 0);
  const canGoPrev = computed(() => true);

  const daysInPeriod = computed(() => {
    const { startDate, endDate } = dateRange.value;
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const diff = end.getTime() - start.getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
  });

  function setScale(newScale: PeriodScale) {
    scale.value = newScale;
    offset.value = 0;
  }

  function next() {
    if (canGoNext.value) {
      offset.value++;
    }
  }

  function prev() {
    offset.value--;
  }

  function goToday() {
    offset.value = 0;
  }

  return {
    scale,
    offset,
    dateRange,
    comparisonDateRange,
    label,
    sublabel,
    isCurrentPeriod,
    canGoNext,
    canGoPrev,
    daysInPeriod,
    setScale,
    next,
    prev,
    goToday,
  };
}
