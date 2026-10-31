import { BadRequestException } from '@nestjs/common';
import { deflateRawSync } from 'zlib';
import {
  BULK_UNDO_TTL_MS,
  deriveBulkUndoKey,
  signBulkUndoToken,
  verifyBulkUndoToken,
  type BulkUndoRow,
} from './bulk-undo.token';

describe('bulk-undo token', () => {
  const key = deriveBulkUndoKey('jwt-secret');
  const now = new Date('2026-10-31T12:00:00Z');

  const row: BulkUndoRow = {
    id: 'tx-1',
    before: {
      categoryId: 'taxi',
      accountId: 'acc-card',
      amount: 25_000,
      currency: 'UZS',
      description: 'Яндекс Go',
      type: 'expense',
      toAccountId: null,
      toAmount: null,
      toCurrency: null,
      paymentGroupId: null,
      isDebtRelated: false,
    },
    after: {
      categoryId: 'transport',
      accountId: 'acc-card',
      amount: 25_000,
      currency: 'UZS',
      description: 'Яндекс Go',
      type: 'expense',
      toAccountId: null,
      toAmount: null,
      toCurrency: null,
      paymentGroupId: null,
      isDebtRelated: false,
    },
  };

  it('подписанный токен читается обратно', () => {
    const token = signBulkUndoToken({ userId: 'user-1', rows: [row] }, key, now);

    const payload = verifyBulkUndoToken(token, key, now);

    expect(payload.userId).toBe('user-1');
    expect(payload.rows).toEqual([row]);
  });

  it('ключ отмены не совпадает с секретом доступа', () => {
    expect(key.equals(Buffer.from('jwt-secret'))).toBe(false);
  });

  it('подделанные данные — 400', () => {
    const token = signBulkUndoToken({ userId: 'user-1', rows: [row] }, key, now);
    const [, signature] = token.split('.');
    const forged = deflateRawSync(
      JSON.stringify({ v: 1, userId: 'user-1', exp: now.getTime() + 1, rows: [] }),
    ).toString('base64url');

    expect(() => verifyBulkUndoToken(`${forged}.${signature}`, key, now)).toThrow(
      BadRequestException,
    );
  });

  it('чужой ключ — 400', () => {
    const token = signBulkUndoToken({ userId: 'user-1', rows: [row] }, key, now);

    expect(() => verifyBulkUndoToken(token, deriveBulkUndoKey('other'), now)).toThrow(
      BadRequestException,
    );
  });

  it('мусор вместо токена — 400', () => {
    expect(() => verifyBulkUndoToken('not-a-token', key, now)).toThrow(BadRequestException);
    expect(() => verifyBulkUndoToken('', key, now)).toThrow(BadRequestException);
  });

  it('просроченный токен — 400', () => {
    const token = signBulkUndoToken({ userId: 'user-1', rows: [row] }, key, now);
    const later = new Date(now.getTime() + BULK_UNDO_TTL_MS + 1);

    expect(() => verifyBulkUndoToken(token, key, later)).toThrow(BadRequestException);
  });

  it('токен на 2000 строк укладывается в сотни килобайт', () => {
    const rows = Array.from({ length: 2000 }, () => ({ ...row, id: crypto.randomUUID() }));

    const token = signBulkUndoToken({ userId: 'user-1', rows }, key, now);

    expect(token.length).toBeLessThan(300_000);
    expect(verifyBulkUndoToken(token, key, now).rows).toHaveLength(2000);
  });

  it('живёт 10 минут', () => {
    const token = signBulkUndoToken({ userId: 'user-1', rows: [row] }, key, now);
    const edge = new Date(now.getTime() + 10 * 60 * 1000);

    expect(verifyBulkUndoToken(token, key, edge).rows).toHaveLength(1);
  });
});
