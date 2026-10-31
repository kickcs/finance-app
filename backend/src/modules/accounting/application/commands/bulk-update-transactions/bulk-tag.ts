import { BadRequestException } from '@nestjs/common';
import { TAG_BOUNDARY_CHARS } from '../../../domain/constants/hashtag';

const TAG_IN_TEXT = new RegExp(`#[^${TAG_BOUNDARY_CHARS}]+`, 'g');
const TAG_FORBIDDEN_CHAR = new RegExp(`[${TAG_BOUNDARY_CHARS}]`);

/** Тег из ввода пользователя без `#`; регистр сохраняется. Пустой или с границей внутри — отказ. */
export function normalizeTag(input: string): string {
  const trimmed = input.trim();
  const tag = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (tag === '') {
    throw new BadRequestException('Тег не может быть пустым');
  }
  if (TAG_FORBIDDEN_CHAR.test(tag)) {
    throw new BadRequestException('Тег не должен содержать пробелов и знаков # . , ; : ! ? )');
  }
  return tag;
}

/** Есть ли в описании тег `tag` (без `#`), без учёта регистра и по границе тега. */
export function hasTag(description: string | null, tag: string): boolean {
  if (!description) return false;
  const wanted = `#${tag}`.toLowerCase();
  for (const match of description.matchAll(TAG_IN_TEXT)) {
    if (match[0].toLowerCase() === wanted) return true;
  }
  return false;
}

/** Дописывает ` #tag` в конец описания; у пустого описания и у описания с пробелом на конце — без лишнего пробела. */
export function appendTag(description: string | null, tag: string): string {
  const base = description ?? '';
  const separator = base === '' || /\s$/.test(base) ? '' : ' ';
  return `${base}${separator}#${tag}`;
}
