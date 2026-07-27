/**
 * Currency formatting utilities
 */

import { getCachedNumberFormat } from './intlCache';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  decimals: number;
}

export const CURRENCIES: Record<string, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', locale: 'en-US', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', decimals: 2 },
  RUB: { code: 'RUB', symbol: '₽', locale: 'ru-RU', decimals: 2 },
  UZS: { code: 'UZS', symbol: 'сўм', locale: 'ru-RU', decimals: 0 },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', decimals: 2 },
  CNY: { code: 'CNY', symbol: '¥', locale: 'zh-CN', decimals: 2 },
};

/**
 * Format amount with currency
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = 'USD',
  options?: {
    showSymbol?: boolean;
    compact?: boolean;
    showSign?: boolean;
  },
): string {
  const config = CURRENCIES[currencyCode] ?? CURRENCIES.USD;
  const { showSymbol = true, compact = false, showSign = false } = options ?? {};

  const formatter = getCachedNumberFormat(config.locale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency: config.code,
    minimumFractionDigits: compact ? 0 : config.decimals,
    maximumFractionDigits: compact ? 2 : config.decimals,
    notation: compact ? 'compact' : 'standard',
    signDisplay: showSign ? 'exceptZero' : 'auto',
  });

  return formatter.format(amount);
}

/** Reusable compact formatting option */
export const COMPACT_FORMAT = { compact: true } as const;

/**
 * Компактно и без символа валюты — для плотных списков и осей, где валюта уже
 * названа рядом, а её повтор в каждой строке только съедает ширину.
 */
export const COMPACT_BARE_FORMAT = { compact: true, showSymbol: false } as const;

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCIES[currencyCode]?.symbol ?? currencyCode;
}

/** Проценты не привязаны к валюте, а интерфейс русскоязычный. */
const PERCENT_LOCALE = 'ru-RU';

/**
 * Format percentage
 *
 * Число идёт через Intl, а не через toFixed: тот всегда ставит точку, и рядом с
 * суммой «11,03 млн» доля читалась как «29.7%» — разные разделители в соседних
 * числах одной строки.
 */
export function formatPercentage(
  value: number,
  decimals: number = 1,
  showSign: boolean = false,
): string {
  const formatter = getCachedNumberFormat(PERCENT_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: showSign ? 'exceptZero' : 'auto',
  });

  return `${formatter.format(value)}%`;
}

/**
 * Доля целого — для легенд и диаграмм, где проценты стоят колонкой и должны
 * читаться одинаково. Доли меньше процента показываются как «<1%»: «0%» рядом
 * с ненулевой суммой выглядит как ошибка счёта.
 */
export function formatShare(percent: number): string {
  if (percent > 0 && percent < 1) return '<1%';
  return formatPercentage(percent, 0);
}

/** Выше этого изменение считается от околонулевой базы и точное число ничего не измеряет. */
const PERCENT_DELTA_CAP = 999;

/**
 * Изменение к прошлому периоду. «48 154%» говорит ровно то же, что и «>999%» —
 * что в прошлом периоде было почти пусто, — зато не влезает в колонку.
 */
export function formatPercentDelta(delta: number, showSign = false): string {
  if (delta > PERCENT_DELTA_CAP) return `>${PERCENT_DELTA_CAP}%`;
  if (delta < -PERCENT_DELTA_CAP) return `<-${PERCENT_DELTA_CAP}%`;
  return formatPercentage(delta, 0, showSign);
}

/**
 * Format number with space separators for input display
 * 1000000 → "1 000 000"
 */
export function formatNumberWithSpaces(value: number | string): string {
  const strValue = String(value).replace(/\s/g, '');
  if (!strValue || strValue === '0') return '';

  // Handle negative numbers
  const isNegative = strValue.startsWith('-');
  const absValue = isNegative ? strValue.slice(1) : strValue;

  // Split integer and decimal parts
  const [intPart, decPart] = absValue.split('.');

  // Format integer part with spaces
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // Reconstruct the number
  let result = formatted;
  if (decPart !== undefined) {
    result = `${formatted}.${decPart}`;
  }

  return isNegative ? `-${result}` : result;
}

/**
 * Normalize a raw amount input string to a valid decimal string.
 * Replaces commas with dots, strips non-numeric chars, and enforces a single decimal point.
 * "1,5" → "1.5", "1..2" → "1.2", "abc" → ""
 */
export function sanitizeCurrencyInput(value: string, maxDecimals = 3): string {
  const withDot = value.replace(/,/g, '.');
  const cleaned = withDot.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  const joined = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
  const dotIdx = joined.indexOf('.');
  if (dotIdx !== -1 && joined.length - dotIdx - 1 > maxDecimals) {
    return joined.slice(0, dotIdx + maxDecimals + 1);
  }
  return joined;
}

/**
 * Format currency with optional masking for hidden balances
 * Replaces the repeated pattern: hidden ? '••••' : formatCurrency(...)
 */
export function formatMasked(
  amount: number,
  currencyCode: string,
  hidden: boolean,
  options?: Parameters<typeof formatCurrency>[2],
): string {
  if (hidden) return '••••';
  return formatCurrency(amount, currencyCode, options);
}
