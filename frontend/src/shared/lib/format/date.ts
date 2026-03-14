/**
 * Date formatting utilities
 */

/**
 * Format date
 */
export function formatDate(
  timestamp: number | Date | string,
  options?: {
    format?: 'full' | 'short' | 'relative' | 'time';
    locale?: string;
  },
): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const { format = 'short', locale = 'ru-RU' } = options ?? {};

  switch (format) {
    case 'full':
      return new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);

    case 'short':
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
      }).format(date);

    case 'relative':
      return formatRelativeDate(date);

    case 'time':
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);

    default:
      return date.toLocaleDateString(locale);
  }
}

/**
 * Format relative date (today, yesterday, etc.)
 */
export function formatRelativeDate(date: Date | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return 'Сегодня';
  } else if (days === 1) {
    return 'Вчера';
  } else if (days < 7) {
    return `${days} дн. назад`;
  } else {
    return formatDate(d, { format: 'short' });
  }
}

/**
 * Format date for grouping transactions
 */
export function formatDateGroup(timestamp: number | string | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const isThisYear = date.getFullYear() === now.getFullYear();

  if (isThisYear) {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
    }).format(date);
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Format date for display in locale format (e.g. "19 февраля 2026")
 */
export function formatLocalDate(dateStr: string | number, locale = 'ru-RU'): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Get start of day timestamp
 */
export function getStartOfDay(date: Date = new Date()): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Get end of day timestamp
 */
export function getEndOfDay(date: Date = new Date()): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Get start of month timestamp
 */
export function getStartOfMonth(date: Date = new Date()): number {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Get end of month timestamp
 */
export function getEndOfMonth(date: Date = new Date()): number {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
