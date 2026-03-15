/**
 * Shared cache for Intl formatter instances.
 *
 * Creating Intl.NumberFormat / Intl.DateTimeFormat objects is ~40x more
 * expensive than calling .format(), so we cache them keyed on the
 * serialised (locale + options) pair.
 */

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function buildKey(kind: string, locale: string, options: object): string {
  return `${kind}|${locale}|${JSON.stringify(options)}`;
}

export function getCachedNumberFormat(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = buildKey('n', locale, options);
  let fmt = cache.get(key) as Intl.NumberFormat | undefined;
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options);
    cache.set(key, fmt);
  }
  return fmt;
}

export function getCachedDateFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = buildKey('d', locale, options);
  let fmt = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options);
    cache.set(key, fmt);
  }
  return fmt;
}
