/**
 * Date formatting utilities
 */

import { getCachedDateFormat } from './intlCache';
import { i18n } from '@/shared/i18n';

/** Maps the active app locale to a BCP-47 Intl locale tag. */
const INTL_LOCALE: Record<string, string> = { ru: 'ru-RU', en: 'en-US' };

function activeIntlLocale(): string {
  return INTL_LOCALE[i18n.global.locale.value] ?? 'ru-RU';
}

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
  const { format = 'short', locale = activeIntlLocale() } = options ?? {};

  switch (format) {
    case 'full':
      return getCachedDateFormat(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);

    case 'short':
      return getCachedDateFormat(locale, {
        day: 'numeric',
        month: 'short',
      }).format(date);

    case 'relative':
      return formatRelativeDate(date);

    case 'time':
      return getCachedDateFormat(locale, {
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
  const t = i18n.global.t;

  if (days === 0) {
    return t('shared.date.today');
  } else if (days === 1) {
    return t('shared.date.yesterday');
  } else if (days < 7) {
    return t('shared.date.daysAgo', { n: days });
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

  const locale = activeIntlLocale();

  if (isThisYear) {
    return getCachedDateFormat(locale, {
      day: 'numeric',
      month: 'long',
    }).format(date);
  }

  return getCachedDateFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Format date for display in locale format (e.g. "19 февраля 2026")
 */
export function formatLocalDate(dateStr: string | number, locale = activeIntlLocale()): string {
  return getCachedDateFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateStr));
}
