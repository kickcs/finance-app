/**
 * Ключ человека. Долги хранят имя свободным текстом, без `person_id`, поэтому
 * единственный доступный ключ — нормализованная строка имени.
 */
export function personKey(name: string): string {
  return name.trim().toLowerCase();
}
