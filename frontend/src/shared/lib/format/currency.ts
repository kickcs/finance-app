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
 * Get currency symbol
 */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCIES[currencyCode]?.symbol ?? currencyCode;
}

/**
 * Format percentage
 */
export function formatPercentage(
  value: number,
  decimals: number = 1,
  showSign: boolean = false,
): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
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
