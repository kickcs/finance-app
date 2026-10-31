import { describe, it, expect } from 'vitest';
import { resolvePeriod, periodLabel, isPeriodActive, type HistoryPeriod } from './historyPeriod';

const preset = (p: HistoryPeriod['preset']): HistoryPeriod => ({ preset: p, from: null, to: null });
const custom = (from: string | null, to: string | null): HistoryPeriod => ({
  preset: 'custom',
  from,
  to,
});

describe('resolvePeriod', () => {
  it('без периода границ нет', () => {
    expect(resolvePeriod(null, new Date(2026, 9, 31), 1)).toEqual({});
  });

  describe('month — этот финансовый месяц до сегодня', () => {
    it('календарный месяц: с 1-го числа по сегодня', () => {
      expect(resolvePeriod(preset('month'), new Date(2026, 9, 31), 1)).toEqual({
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });
    });

    it('первый день месяца даёт период из одного дня', () => {
      expect(resolvePeriod(preset('month'), new Date(2026, 9, 1), 1)).toEqual({
        startDate: '2026-10-01',
        endDate: '2026-10-01',
      });
    });

    it('startDay=15 после 15-го числа: месяц начался в этом календарном месяце', () => {
      expect(resolvePeriod(preset('month'), new Date(2026, 9, 20), 15)).toEqual({
        startDate: '2026-10-15',
        endDate: '2026-10-20',
      });
    });

    it('startDay=15 до 15-го числа: месяц начался в прошлом календарном', () => {
      expect(resolvePeriod(preset('month'), new Date(2026, 9, 10), 15)).toEqual({
        startDate: '2026-09-15',
        endDate: '2026-10-10',
      });
    });

    it('startDay=15 в январе до 15-го уходит в декабрь прошлого года', () => {
      expect(resolvePeriod(preset('month'), new Date(2026, 0, 5), 15)).toEqual({
        startDate: '2025-12-15',
        endDate: '2026-01-05',
      });
    });

    it('startDay=31 в коротком месяце сжимается до его последнего дня', () => {
      expect(resolvePeriod(preset('month'), new Date(2026, 2, 5), 31)).toEqual({
        startDate: '2026-02-28',
        endDate: '2026-03-05',
      });
    });

    it('время суток не влияет на границы', () => {
      expect(resolvePeriod(preset('month'), new Date(2026, 9, 31, 23, 59, 59), 1)).toEqual({
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });
    });
  });

  describe('prev_month — прошлый финансовый месяц целиком', () => {
    it('календарный месяц', () => {
      expect(resolvePeriod(preset('prev_month'), new Date(2026, 9, 31), 1)).toEqual({
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      });
    });

    it('в январе прошлый месяц — декабрь прошлого года', () => {
      expect(resolvePeriod(preset('prev_month'), new Date(2026, 0, 10), 1)).toEqual({
        startDate: '2025-12-01',
        endDate: '2025-12-31',
      });
    });

    it('високосный февраль заканчивается 29-м', () => {
      expect(resolvePeriod(preset('prev_month'), new Date(2028, 2, 3), 1)).toEqual({
        startDate: '2028-02-01',
        endDate: '2028-02-29',
      });
    });

    it('startDay=15: от 15-го до 14-го следующего месяца', () => {
      expect(resolvePeriod(preset('prev_month'), new Date(2026, 9, 20), 15)).toEqual({
        startDate: '2026-09-15',
        endDate: '2026-10-14',
      });
    });

    it('startDay=15 до 15-го числа: сдвиг на месяц назад вместе с текущим', () => {
      expect(resolvePeriod(preset('prev_month'), new Date(2026, 9, 10), 15)).toEqual({
        startDate: '2026-08-15',
        endDate: '2026-09-14',
      });
    });
  });

  describe('последние N дней включая сегодня', () => {
    it('last7', () => {
      expect(resolvePeriod(preset('last7'), new Date(2026, 9, 31), 1)).toEqual({
        startDate: '2026-10-25',
        endDate: '2026-10-31',
      });
    });

    it('last7 через границу месяца', () => {
      expect(resolvePeriod(preset('last7'), new Date(2026, 2, 3), 1)).toEqual({
        startDate: '2026-02-25',
        endDate: '2026-03-03',
      });
    });

    it('last30 через границу года', () => {
      expect(resolvePeriod(preset('last30'), new Date(2026, 0, 10), 1)).toEqual({
        startDate: '2025-12-12',
        endDate: '2026-01-10',
      });
    });

    it('не зависит от startDay', () => {
      expect(resolvePeriod(preset('last7'), new Date(2026, 9, 31), 15)).toEqual(
        resolvePeriod(preset('last7'), new Date(2026, 9, 31), 1),
      );
    });
  });

  describe('custom', () => {
    it('обе границы', () => {
      expect(resolvePeriod(custom('2026-10-12', '2026-10-20'), new Date(2026, 9, 31), 1)).toEqual({
        startDate: '2026-10-12',
        endDate: '2026-10-20',
      });
    });

    it('только «с»', () => {
      expect(resolvePeriod(custom('2026-10-12', null), new Date(2026, 9, 31), 1)).toEqual({
        startDate: '2026-10-12',
        endDate: undefined,
      });
    });

    it('только «по»', () => {
      expect(resolvePeriod(custom(null, '2026-10-20'), new Date(2026, 9, 31), 1)).toEqual({
        startDate: undefined,
        endDate: '2026-10-20',
      });
    });

    it('перепутанные границы меняются местами', () => {
      expect(resolvePeriod(custom('2026-10-20', '2026-10-12'), new Date(2026, 9, 31), 1)).toEqual({
        startDate: '2026-10-12',
        endDate: '2026-10-20',
      });
    });

    it('без дат ничего не ограничивает', () => {
      expect(resolvePeriod(custom(null, null), new Date(2026, 9, 31), 1)).toEqual({
        startDate: undefined,
        endDate: undefined,
      });
    });
  });
});

describe('isPeriodActive', () => {
  it('null и пустой custom неактивны', () => {
    expect(isPeriodActive(null)).toBe(false);
    expect(isPeriodActive(custom(null, null))).toBe(false);
  });

  it('пресет и custom с хотя бы одной датой активны', () => {
    expect(isPeriodActive(preset('last7'))).toBe(true);
    expect(isPeriodActive(custom('2026-10-12', null))).toBe(true);
    expect(isPeriodActive(custom(null, '2026-10-12'))).toBe(true);
  });
});

describe('periodLabel', () => {
  it('подписи пресетов', () => {
    expect(periodLabel(preset('month'))).toBe('Этот месяц');
    expect(periodLabel(preset('prev_month'))).toBe('Прошлый месяц');
    expect(periodLabel(preset('last7'))).toBe('Последние 7 дней');
    expect(periodLabel(preset('last30'))).toBe('Последние 30 дней');
  });

  it('custom с двумя датами показывает диапазон', () => {
    const year = new Date().getFullYear();
    const label = periodLabel(custom(`${year}-10-12`, `${year}-10-20`));
    expect(label).toMatch(/^12 окт\.? – 20 окт\.?$/);
  });

  it('custom с одной границей — «с» или «по»', () => {
    const year = new Date().getFullYear();
    expect(periodLabel(custom(`${year}-10-12`, null))).toMatch(/^с 12 окт/);
    expect(periodLabel(custom(null, `${year}-10-20`))).toMatch(/^по 20 окт/);
  });

  it('у неактивного периода подписи нет', () => {
    expect(periodLabel(null)).toBe('');
    expect(periodLabel(custom(null, null))).toBe('');
  });
});
