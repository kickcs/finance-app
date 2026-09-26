import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/shared/i18n', () => ({
  i18n: {
    global: {
      locale: { value: 'ru' },
      t: (key: string) => {
        const dict: Record<string, string> = {
          'shared.date.today': 'Сегодня',
          'shared.date.yesterday': 'Вчера',
        };
        return dict[key] ?? key;
      },
    },
  },
}));

import { cleanMerchantName, inboxGroupLabel, groupInboxItemsByDay } from './inboxGrouping';
import type { ImportedTransaction } from '@/entities/imported-transaction';

function makeItem(overrides: Partial<ImportedTransaction> = {}): ImportedTransaction {
  return {
    id: 'i1',
    type: 'expense',
    amount: 1000,
    currency: 'UZS',
    merchant: 'ZOOMRAD P2P UZ2HU>TO',
    card_mask: '*1951',
    occurred_at: new Date().toISOString(),
    balance_after: null,
    status: 'pending',
    transaction_id: null,
    suggested_account_id: null,
    suggested_category_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('cleanMerchantName', () => {
  it('обрезает город после >', () => {
    expect(cleanMerchantName('ZOOMRAD P2P UZ2HU>TO')).toBe('ZOOMRAD P2P UZ2HU');
    expect(cleanMerchantName('YANDEX EATS>Toshkent')).toBe('YANDEX EATS');
  });

  it('схлопывает лишние пробелы и триммит', () => {
    expect(cleanMerchantName('  IP  OOO   JETI ASPAN  >TA')).toBe('IP OOO JETI ASPAN');
  });

  it('без разделителя возвращает строку как есть (триммленную)', () => {
    expect(cleanMerchantName(' Кафе Плов ')).toBe('Кафе Плов');
  });

  it('null/undefined/пусто → пустая строка', () => {
    expect(cleanMerchantName(null)).toBe('');
    expect(cleanMerchantName(undefined)).toBe('');
    expect(cleanMerchantName('')).toBe('');
  });
});

describe('inboxGroupLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 27, 12, 0, 0)); // 27 сентября 2026, полдень
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('сегодня', () => {
    expect(inboxGroupLabel(new Date(2026, 8, 27, 19, 19))).toBe('Сегодня');
  });

  it('вчера', () => {
    expect(inboxGroupLabel(new Date(2026, 8, 26, 23, 59))).toBe('Вчера');
  });

  it('раньше — конкретная дата', () => {
    expect(inboxGroupLabel(new Date(2026, 8, 25, 8, 0))).toBe('25 сентября');
  });
});

describe('groupInboxItemsByDay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 27, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('группирует по дню, сохраняя порядок входного списка', () => {
    const today1 = makeItem({ id: 'a', occurred_at: new Date(2026, 8, 27, 19, 19).toISOString() });
    const today2 = makeItem({ id: 'b', occurred_at: new Date(2026, 8, 27, 10, 0).toISOString() });
    const yesterday = makeItem({
      id: 'c',
      occurred_at: new Date(2026, 8, 26, 8, 0).toISOString(),
    });

    const groups = groupInboxItemsByDay([today1, today2, yesterday]);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('Сегодня');
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(groups[1].label).toBe('Вчера');
    expect(groups[1].items.map((i) => i.id)).toEqual(['c']);
  });

  it('уважает порядок сортировки «сначала старые» без пересортировки', () => {
    const yesterday = makeItem({
      id: 'c',
      occurred_at: new Date(2026, 8, 26, 8, 0).toISOString(),
    });
    const today = makeItem({ id: 'a', occurred_at: new Date(2026, 8, 27, 19, 19).toISOString() });

    const groups = groupInboxItemsByDay([yesterday, today]);

    expect(groups.map((g) => g.label)).toEqual(['Вчера', 'Сегодня']);
  });

  it('occurred_at отсутствует → падает обратно на created_at', () => {
    const item = makeItem({
      id: 'a',
      occurred_at: null,
      created_at: new Date(2026, 8, 26, 8, 0).toISOString(),
    });
    const groups = groupInboxItemsByDay([item]);
    expect(groups[0].label).toBe('Вчера');
  });

  it('пустой список → пустой массив групп', () => {
    expect(groupInboxItemsByDay([])).toEqual([]);
  });
});
