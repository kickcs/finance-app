/**
 * Общие примитивы публичных «ссылок-снимков» (чек, сверка по долгам): у каждого
 * такого модуля есть OG-страница и OG-картинка, и раньше каждый нёс свои копии
 * этих функций.
 */

/**
 * Экранирует текст для вставки в разметку. HTML и SVG — оба XML-подобные, и
 * набор символов один и тот же, поэтому функция одна.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Целые с неразрывной группировкой по три: `229648` → `229 648`. */
export function formatAmount(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Обрезает строку до `max` символов, добавляя многоточие. */
export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Базовый адрес приложения — на нём собираются все публичные ссылки. */
export function getPublicAppUrl(): string {
  return process.env.PUBLIC_APP_URL || 'http://localhost:3000';
}
