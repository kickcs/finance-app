/**
 * Номер карты живёт в приложении голыми цифрами: пробелы — это оформление, и
 * хранить их значило бы сравнивать «1234 5678» с «12345678» как разные номера.
 */

const MIN_DIGITS = 12;
const MAX_DIGITS = 19;

/** Оставляет только цифры и обрезает по длине самой длинной карты (19). */
export function normalizeCardNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, MAX_DIGITS);
}

/**
 * Длину не проверяем на равенство 16: Maestro бывает до 19 цифр, а часть
 * локальных карт короче. Контрольную сумму (Луна) тоже не считаем — Humo и
 * Uzcard её не проходят, и валидный номер уехал бы в ошибку.
 */
export function isValidCardNumber(value: string): boolean {
  const digits = normalizeCardNumber(value);
  return digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS;
}

/** Группы по четыре — так номер сверяют с пластиком в руках. */
export function formatCardNumber(value: string): string {
  const digits = normalizeCardNumber(value);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}
