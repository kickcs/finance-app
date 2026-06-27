import { describe, it, expect, vi } from 'vitest';

vi.mock('@/shared/i18n', () => ({
  i18n: {
    global: {
      locale: { value: 'en' },
      t: (key: string, named?: Record<string, unknown>) => {
        const dict: Record<string, string> = {
          'shared.date.today': 'Today',
          'shared.date.yesterday': 'Yesterday',
          'shared.date.daysAgo': `${named?.n} days ago`,
        };
        return dict[key] ?? key;
      },
    },
  },
}));

import { formatRelativeDate } from './date';

describe('formatRelativeDate (locale-aware)', () => {
  it('returns the localized "today" string', () => {
    expect(formatRelativeDate(new Date())).toBe('Today');
  });
  it('returns the localized "yesterday" string', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    expect(formatRelativeDate(d)).toBe('Yesterday');
  });
  it('returns the localized "N days ago" string', () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    expect(formatRelativeDate(d)).toBe('3 days ago');
  });
});
