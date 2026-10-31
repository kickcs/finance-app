/** Символы, на которых тег в описании кончается: правило общее с сервером. */
const TAG_BOUNDARY = /[\s#.,;:!?)]/g;

/** Тег без решёток в начале: так он хранится в фильтре и уходит на сервер. */
export const stripHash = (tag: string) => tag.replace(/^#+/, '');

/** Тег из поля ввода: пробелы становятся подчёркиваниями, остальные границы тега выброшены. */
export function normalizeTagInput(raw: string): string {
  return stripHash(raw.trim()).replace(/\s+/g, '_').replace(TAG_BOUNDARY, '');
}
