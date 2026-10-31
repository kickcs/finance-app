import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { deflateRawSync, inflateRawSync } from 'zlib';

export const BULK_UNDO_TTL_MS = 10 * 60 * 1000;

/** Поля строки, которые меняет массовая правка, — ровно то, что отмена вправе вернуть. */
export interface BulkUndoRowState {
  categoryId: string;
  accountId: string;
  /** Сумма и валюта правкой не меняются, но их ручная правка после неё тоже запрещает отмену. */
  amount: number;
  currency: string;
  description: string | null;
  type: string;
  toAccountId: string | null;
  toAmount: number | null;
  toCurrency: string | null;
  paymentGroupId: string | null;
  /** Перевод сбрасывает признак; без него отмена не вернула бы его строке, где он был. */
  isDebtRelated: boolean;
}

export interface BulkUndoRow {
  id: string;
  before: BulkUndoRowState;
  after: BulkUndoRowState;
}

export interface BulkUndoPayload {
  v: 1;
  userId: string;
  /** Момент истечения, мс эпохи. */
  exp: number;
  rows: BulkUndoRow[];
}

const INVALID = 'Отменить уже нельзя: ссылка на отмену устарела или повреждена';

/** Свой ключ из секрета доступа: токен отмены нельзя выдать за токен входа и наоборот. */
export function deriveBulkUndoKey(secret: string): Buffer {
  return createHmac('sha256', secret).update('bulk-undo:v1').digest();
}

export function bulkUndoKey(config: ConfigService): Buffer {
  return deriveBulkUndoKey(config.getOrThrow<string>('jwt.secret'));
}

function sign(body: string, key: Buffer): Buffer {
  return createHmac('sha256', key).update(body).digest();
}

export function signBulkUndoToken(
  input: { userId: string; rows: BulkUndoRow[] },
  key: Buffer,
  now: Date,
): string {
  const payload: BulkUndoPayload = {
    v: 1,
    userId: input.userId,
    exp: now.getTime() + BULK_UNDO_TTL_MS,
    rows: input.rows,
  };
  // Состояния строк почти одинаковы (те же счета и категории): сжатие уменьшает токен в разы.
  const body = deflateRawSync(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body, key).toString('base64url')}`;
}

/** Подпись проверяется до разбора: неподписанное содержимое не читаем вовсе. */
export function verifyBulkUndoToken(token: string, key: Buffer, now: Date): BulkUndoPayload {
  const [body, signature, ...rest] = token.split('.');
  if (!body || !signature || rest.length > 0) throw new BadRequestException(INVALID);

  const expected = sign(body, key);
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new BadRequestException(INVALID);
  }

  const payload = JSON.parse(
    inflateRawSync(Buffer.from(body, 'base64url')).toString('utf8'),
  ) as BulkUndoPayload;
  // Версию сверяем как неизвестное значение: токен старого формата тоже подписан нашим ключом.
  if ((payload as { v: unknown }).v !== 1 || payload.exp < now.getTime()) {
    throw new BadRequestException(INVALID);
  }
  return payload;
}
