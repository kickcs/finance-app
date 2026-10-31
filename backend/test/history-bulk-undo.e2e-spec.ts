import { randomUUID } from 'crypto';
import { deflateRawSync, inflateRawSync } from 'zlib';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ConfigService } from '@nestjs/config';
import {
  setupHistoryTestContext,
  seedAccount,
  seedBalance,
  readBalance,
  seedTransaction,
  createOtherUser,
  type HistoryTestContext,
  type SeedTransaction,
} from './helpers/history-test-db';
import { TransactionOrmEntity } from '../src/modules/accounting/infrastructure/persistence/typeorm/transaction.orm-entity';
import {
  BULK_UNDO_TTL_MS,
  bulkUndoKey,
  signBulkUndoToken,
  type BulkUndoRow,
} from '../src/modules/accounting/application/bulk/bulk-undo.token';

const CREATED = new Date('2026-10-20T08:00:00.000Z');

describe('POST /transactions/bulk/undo: отмена массовой правки', () => {
  let ctx: HistoryTestContext;

  beforeEach(async () => {
    ctx = await setupHistoryTestContext();
    await seedBalance(ctx, ctx.accountId, 'UZS', 1_000_000);
    await seedBalance(ctx, ctx.secondAccountId, 'UZS', 500_000);
  });

  afterEach(async () => {
    await ctx.closeAndCleanup();
  });

  const seed = (over: SeedTransaction = {}) =>
    seedTransaction(ctx, { createdAt: CREATED, ...over });

  const row = async (id: string) => {
    const found = await ctx.dataSource.getRepository(TransactionOrmEntity).findOneByOrFail({ id });
    return {
      ...found,
      amount: Number(found.amount),
      toAmount: found.toAmount === null ? null : Number(found.toAmount),
    };
  };

  const balance = (accountId: string) => readBalance(ctx, accountId, 'UZS');

  const bulkIds = async (ids: string[], action: object): Promise<string> => {
    const res = await ctx.post('/transactions/bulk', { selection: { ids }, action });
    expect(res.status).toBe(200);
    const token = (res.body as { undoToken?: string }).undoToken;
    if (!token) throw new Error('Токен отмены не выдан');
    return token;
  };

  const undo = (undoToken: string) => ctx.post('/transactions/bulk/undo', { undoToken });

  const undoKey = () => bulkUndoKey(ctx.app.get(ConfigService));

  const stateOf = async (id: string) => {
    const r = await row(id);
    return {
      categoryId: r.categoryId,
      accountId: r.accountId,
      amount: r.amount,
      currency: r.currency,
      description: r.description,
      type: r.type,
      toAccountId: r.toAccountId,
      toAmount: r.toAmount,
      toCurrency: r.toCurrency,
      paymentGroupId: r.paymentGroupId,
      isDebtRelated: r.isDebtRelated,
    };
  };

  describe('токен', () => {
    it('подделанный и мусорный токены — 400', async () => {
      const id = await seed({ categoryId: 'taxi' });
      const token = await bulkIds([id], { kind: 'category', categoryId: 'transport' });
      const [body, signature] = token.split('.');
      const original = JSON.parse(
        inflateRawSync(Buffer.from(body, 'base64url')).toString(),
      ) as Record<string, unknown>;
      const forgedBody = deflateRawSync(JSON.stringify({ ...original, userId: 'x' })).toString(
        'base64url',
      );

      expect((await undo(`${forgedBody}.${signature}`)).status).toBe(400);
      expect((await undo('not-a-token')).status).toBe(400);
      expect((await ctx.post('/transactions/bulk/undo', {})).status).toBe(400);
      expect((await row(id)).categoryId).toBe('transport');
    });

    it('просроченный токен — 400, строки остаются как после правки', async () => {
      const id = await seed({ categoryId: 'taxi' });
      const state = await stateOf(id);
      const rows: BulkUndoRow[] = [{ id, before: state, after: state }];
      const issuedLongAgo = new Date(Date.now() - BULK_UNDO_TTL_MS - 1000);
      const token = signBulkUndoToken({ userId: ctx.userId, rows }, undoKey(), issuedLongAgo);

      expect((await undo(token)).status).toBe(400);
    });

    it('токен другого пользователя — 403, ничего не откатывается', async () => {
      const id = await seed({ categoryId: 'taxi' });
      const token = await bulkIds([id], { kind: 'category', categoryId: 'transport' });
      const other = await createOtherUser(ctx);

      const res = await request(ctx.app.getHttpServer() as App)
        .post('/transactions/bulk/undo')
        .set('Authorization', `Bearer ${ctx.tokenFor(other.userId)}`)
        .send({ undoToken: token });

      expect(res.status).toBe(403);
      expect((await row(id)).categoryId).toBe('transport');
    });
  });

  describe('откат', () => {
    it('перенос в категорию: отмена возвращает категории и не трогает остатки', async () => {
      const ids = [
        await seed({ categoryId: 'taxi', amount: 1_000 }),
        await seed({ categoryId: 'cafe', amount: 2_000 }),
      ];
      const token = await bulkIds(ids, { kind: 'category', categoryId: 'transport' });
      expect(await Promise.all(ids.map(async (id) => (await row(id)).categoryId))).toEqual([
        'transport',
        'transport',
      ]);

      const res = await undo(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ restored: 2 });
      expect((await row(ids[0])).categoryId).toBe('taxi');
      expect((await row(ids[1])).categoryId).toBe('cafe');
      expect(await balance(ctx.accountId)).toBe(1_000_000);
    });

    it('пара → перевод → отмена: пара, группа, поля перевода и все остатки как были', async () => {
      const target = await seedAccount(ctx);
      const group = randomUUID();
      const first = await seed({
        accountId: ctx.accountId,
        amount: 60_000,
        paymentGroupId: group,
        description: 'Покупка',
        categoryId: 'groceries',
      });
      const second = await seed({
        accountId: ctx.secondAccountId,
        amount: 40_000,
        paymentGroupId: group,
        description: 'Покупка',
        categoryId: 'groceries',
      });
      const beforeStates = [await stateOf(first), await stateOf(second)];
      const token = await bulkIds([first], { kind: 'transfer', toAccountId: target });
      expect(await balance(target)).toBe(100_000);

      const res = await undo(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ restored: 2 });
      expect([await stateOf(first), await stateOf(second)]).toEqual(beforeStates);
      expect(await balance(ctx.accountId)).toBe(1_000_000);
      expect(await balance(ctx.secondAccountId)).toBe(500_000);
      expect(await balance(target)).toBe(0);
    });

    it('смена счёта и тег: отмена возвращает счёт, остатки и описание (в том числе пустое)', async () => {
      const moved = await seed({ amount: 7_000, description: null });
      const income = await seed({ type: 'income', amount: 2_000, description: 'Премия' });
      const before = [await stateOf(moved), await stateOf(income)];

      const accountToken = await bulkIds([moved, income], {
        kind: 'account',
        accountId: ctx.secondAccountId,
      });
      expect(await balance(ctx.accountId)).toBe(1_005_000);
      expect((await undo(accountToken)).status).toBe(200);
      expect([await stateOf(moved), await stateOf(income)]).toEqual(before);
      expect(await balance(ctx.accountId)).toBe(1_000_000);
      expect(await balance(ctx.secondAccountId)).toBe(500_000);

      const tagToken = await bulkIds([moved, income], { kind: 'tag', tag: 'отпуск' });
      expect((await row(moved)).description).toBe('#отпуск');
      expect((await undo(tagToken)).status).toBe(200);
      expect([await stateOf(moved), await stateOf(income)]).toEqual(before);
    });

    it('признак долга у расхода, ставшего переводом, возвращается', async () => {
      const target = await seedAccount(ctx);
      const id = await seed({ amount: 500, isDebtRelated: true });
      const before = await stateOf(id);
      const token = await bulkIds([id], { kind: 'transfer', toAccountId: target });
      expect((await row(id)).isDebtRelated).toBe(false);

      expect((await undo(token)).status).toBe(200);

      expect(await stateOf(id)).toEqual(before);
    });
  });

  describe('строка изменилась после правки', () => {
    it('ручная правка одной строки: 409 для всей отмены, ни одна строка не откатилась', async () => {
      const ids = [
        await seed({ categoryId: 'taxi', amount: 1_000 }),
        await seed({ categoryId: 'taxi', amount: 2_000 }),
        await seed({ categoryId: 'taxi', amount: 3_000 }),
      ];
      const token = await bulkIds(ids, { kind: 'category', categoryId: 'transport' });
      await ctx.dataSource
        .getRepository(TransactionOrmEntity)
        .update({ id: ids[1] }, { categoryId: 'cafe' });

      const res = await undo(token);

      expect(res.status).toBe(409);
      expect((await row(ids[0])).categoryId).toBe('transport');
      expect((await row(ids[1])).categoryId).toBe('cafe');
      expect((await row(ids[2])).categoryId).toBe('transport');
    });

    it('правка суммы или удаление строки тоже блокируют отмену; остатки не меняются', async () => {
      const target = await seedAccount(ctx);
      const a = await seed({ amount: 1_000 });
      const b = await seed({ amount: 2_000 });
      const token = await bulkIds([a, b], { kind: 'transfer', toAccountId: target });
      await ctx.dataSource.getRepository(TransactionOrmEntity).update({ id: a }, { amount: 1_500 });
      const targetBalance = await balance(target);

      expect((await undo(token)).status).toBe(409);
      await ctx.dataSource.getRepository(TransactionOrmEntity).delete({ id: b });
      expect((await undo(token)).status).toBe(409);

      expect((await row(a)).type).toBe('transfer');
      expect(await balance(target)).toBe(targetBalance);
      expect(await balance(ctx.accountId)).toBe(1_000_000);
    });

    it('повторная отмена тем же токеном — 409', async () => {
      const id = await seed({ categoryId: 'taxi' });
      const token = await bulkIds([id], { kind: 'category', categoryId: 'transport' });

      expect((await undo(token)).status).toBe(200);
      expect((await undo(token)).status).toBe(409);
      expect((await row(id)).categoryId).toBe('taxi');
    });
  });
});
