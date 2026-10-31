import { randomUUID } from 'crypto';
import {
  setupHistoryTestContext,
  seedAccount,
  seedBalance,
  readBalance,
  seedTransaction,
  seedDebt,
  createOtherUser,
  type HistoryTestContext,
  type SeedTransaction,
} from './helpers/history-test-db';
import { TransactionOrmEntity } from '../src/modules/accounting/infrastructure/persistence/typeorm/transaction.orm-entity';
import {
  TRANSACTION_REPOSITORY,
  type ITransactionRepository,
} from '../src/modules/accounting/domain/repositories/transaction.repository.interface';

interface BulkResponse {
  changed: number;
  skipped: { reason: string; count: number }[];
  balanceDeltas: { accountId: string; currency: string; delta: number }[];
  undoToken?: string;
}

interface SummaryResponse {
  count: number;
  eligibleCount: number;
  lockedCount: number;
  asOf: string;
}

// Строки созданы до этого момента, поэтому в выборку «на asOf» попадают.
const CREATED = new Date('2026-10-20T08:00:00.000Z');
const AS_OF = '2026-10-25T00:00:00.000Z';
const OCTOBER = { startDate: '2026-10-01', endDate: '2026-10-31' };

describe('POST /transactions/bulk: массовая правка истории', () => {
  let ctx: HistoryTestContext;
  let secondAccountId: string;

  beforeEach(async () => {
    ctx = await setupHistoryTestContext();
    secondAccountId = ctx.secondAccountId;
    await seedBalance(ctx, ctx.accountId, 'UZS', 1_000_000);
    await seedBalance(ctx, secondAccountId, 'UZS', 500_000);
  });

  afterEach(async () => {
    await ctx.closeAndCleanup();
  });

  const seed = (over: SeedTransaction = {}) =>
    seedTransaction(ctx, { createdAt: CREATED, ...over });

  const seedMany = async (count: number, over: SeedTransaction): Promise<void> => {
    const repository = ctx.dataSource.getRepository(TransactionOrmEntity);
    const rows = Array.from({ length: count }, () => ({
      id: randomUUID(),
      userId: ctx.userId,
      accountId: over.accountId ?? ctx.accountId,
      categoryId: over.categoryId ?? 'food',
      amount: 100,
      currency: 'UZS',
      type: 'expense',
      description: null,
      date: new Date('2026-10-15T12:00:00Z'),
      createdAt: CREATED,
      isDebtRelated: false,
      isInformational: false,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      await repository.insert(rows.slice(i, i + 500) as Partial<TransactionOrmEntity>[]);
    }
  };

  const row = async (id: string) => {
    const found = await ctx.dataSource.getRepository(TransactionOrmEntity).findOneBy({ id });
    return found && { ...found, amount: Number(found.amount) };
  };

  const rowOrFail = async (id: string) => {
    const found = await row(id);
    if (!found) throw new Error(`Строка ${id} не найдена`);
    return found;
  };

  const bulk = (body: object) => ctx.post('/transactions/bulk', body);

  const byFilter = (filter: object, expectedCount: number, asOf = AS_OF) => ({
    filter,
    asOf,
    expectedCount,
  });

  const balance = (accountId: string) => readBalance(ctx, accountId, 'UZS');

  const insertCategory = async (userId: string, type: string): Promise<string> => {
    const id = randomUUID();
    await ctx.dataSource.query(
      `INSERT INTO categories (id, user_id, name, icon, color, type, sort_order, is_frequent)
       VALUES ($1, $2, 'Своя', 'tag', '#000000', $3, 0, true)`,
      [id, userId, type],
    );
    return id;
  };

  describe('выборка по фильтру', () => {
    it('«Такси, октябрь» → «Транспорт»: меняются все подходящие, долговая строка и чужой месяц нет', async () => {
      const taxi = [
        await seed({ categoryId: 'taxi', amount: 10_000, date: new Date('2026-10-03T09:00:00Z') }),
        await seed({ categoryId: 'taxi', amount: 12_000, date: new Date('2026-10-10T09:00:00Z') }),
        await seed({ categoryId: 'taxi', amount: 8_000, date: new Date('2026-10-20T09:00:00Z') }),
      ];
      const september = await seed({
        categoryId: 'taxi',
        date: new Date('2026-09-28T09:00:00Z'),
      });
      const debtRow = await seed({ categoryId: 'taxi' });
      await seedDebt(ctx, { transactionId: debtRow });
      const food = await seed({ categoryId: 'food' });

      const summary = (
        await ctx.get(
          '/transactions/summary?categoryIds=taxi&startDate=2026-10-01&endDate=2026-10-31',
        )
      ).body as SummaryResponse;
      expect(summary).toMatchObject({ eligibleCount: 3, lockedCount: 1 });
      const body = {
        selection: byFilter(
          { categoryIds: ['taxi'], ...OCTOBER },
          summary.eligibleCount,
          summary.asOf,
        ),
        action: { kind: 'category', categoryId: 'transport' },
      };

      const preview = await bulk({ ...body, dryRun: true });
      expect(preview.status).toBe(200);
      expect(preview.body).toEqual({
        changed: 3,
        skipped: [{ reason: 'locked', count: 1 }],
        balanceDeltas: [],
      });
      for (const id of taxi) expect((await rowOrFail(id)).categoryId).toBe('taxi');

      const applied = await bulk(body);

      expect(applied.status).toBe(200);
      const result = applied.body as BulkResponse;
      expect(result).toMatchObject({
        changed: 3,
        skipped: [{ reason: 'locked', count: 1 }],
        balanceDeltas: [],
      });
      expect(result.undoToken).toEqual(expect.any(String));
      for (const id of taxi) expect((await rowOrFail(id)).categoryId).toBe('transport');
      expect((await rowOrFail(debtRow)).categoryId).toBe('taxi');
      expect((await rowOrFail(september)).categoryId).toBe('taxi');
      expect((await rowOrFail(food)).categoryId).toBe('food');
      expect(await balance(ctx.accountId)).toBe(1_000_000);
      expect(await balance(secondAccountId)).toBe(500_000);
    });

    it('фильтр по счёту поймал одну половину пары: changed = 1 и в предпросмотре, и в применении, переводами становятся обе', async () => {
      const target = await seedAccount(ctx);
      const group = randomUUID();
      const onA = await seed({ accountId: ctx.accountId, amount: 60_000, paymentGroupId: group });
      const onB = await seed({ accountId: secondAccountId, amount: 40_000, paymentGroupId: group });

      const summary = (await ctx.get(`/transactions/summary?accountIds=${ctx.accountId}`))
        .body as SummaryResponse;
      expect(summary).toMatchObject({ count: 1, eligibleCount: 1 });
      const body = {
        selection: byFilter({ accountIds: [ctx.accountId] }, summary.eligibleCount, summary.asOf),
        action: { kind: 'transfer', toAccountId: target },
      };
      const expected = {
        changed: 1,
        skipped: [],
        balanceDeltas: [{ accountId: target, currency: 'UZS', delta: 100_000 }],
      };

      const preview = await bulk({ ...body, dryRun: true });
      expect(preview.status).toBe(200);
      expect(preview.body).toEqual(expected);

      const applied = await bulk(body);
      expect(applied.status).toBe(200);
      expect(applied.body).toMatchObject(expected);
      for (const id of [onA, onB]) {
        expect(await rowOrFail(id)).toMatchObject({
          type: 'transfer',
          toAccountId: target,
          paymentGroupId: null,
        });
      }
      expect(await balance(ctx.accountId)).toBe(1_000_000);
      expect(await balance(secondAccountId)).toBe(500_000);
      expect(await balance(target)).toBe(100_000);
    });

    it('поиск в фильтре: итог, предпросмотр и применение берут ровно строки ленты по тому же поиску', async () => {
      await seed({ description: 'Такси домой', categoryId: 'taxi' });
      await seed({ description: 'такси в аэропорт', categoryId: 'taxi' });
      await seed({
        description: 'Такси, сентябрь',
        categoryId: 'taxi',
        date: new Date('2026-09-10T12:00:00Z'),
      });
      await seed({ description: 'Такси за друга', categoryId: 'food' });
      await seed({ description: 'Обед', categoryId: 'taxi' });
      const debtRow = await seed({ description: 'такси по долгу', categoryId: 'taxi' });
      await seedDebt(ctx, { transactionId: debtRow });
      const query =
        'search=%D1%82%D0%B0%D0%BA%D1%81%D0%B8&categoryIds=taxi&startDate=2026-10-01&endDate=2026-10-31';
      const filter = { search: 'такси', categoryIds: ['taxi'], ...OCTOBER };

      const feed = await ctx.get(`/transactions?pageSize=100&${query}`);
      const rows = (feed.body as { data: { id: string; bulkLocked: boolean }[] }).data;
      const eligible = rows.filter((r) => !r.bulkLocked).map((r) => r.id);
      const summary = (await ctx.get(`/transactions/summary?${query}`)).body as SummaryResponse;
      expect(summary).toMatchObject({ count: rows.length, eligibleCount: eligible.length });
      expect(eligible).toHaveLength(2);

      const body = {
        selection: byFilter(filter, summary.eligibleCount, summary.asOf),
        action: { kind: 'tag', tag: 'поиск' },
      };
      const preview = await bulk({ ...body, dryRun: true });
      const applied = await bulk(body);

      expect(preview.body).toMatchObject({ changed: 2, skipped: [{ reason: 'locked', count: 1 }] });
      expect(applied.status).toBe(200);
      const tagged = await ctx.dataSource
        .getRepository(TransactionOrmEntity)
        .find({ where: { userId: ctx.userId } });
      expect(
        tagged
          .filter((t) => t.description?.endsWith('#поиск'))
          .map((t) => t.id)
          .sort(),
      ).toEqual([...eligible].sort());
    });

    it('строка, созданная после asOf, не меняется и в ожидаемое число не входит', async () => {
      const early = await seed({ categoryId: 'taxi' });
      const late = await seedTransaction(ctx, {
        categoryId: 'taxi',
        createdAt: new Date('2026-10-26T08:00:00.000Z'),
      });
      const filter = { categoryIds: ['taxi'] };

      const stale = await bulk({
        selection: byFilter(filter, 2),
        action: { kind: 'category', categoryId: 'transport' },
      });
      expect(stale.status).toBe(409);

      const res = await bulk({
        selection: byFilter(filter, 1),
        action: { kind: 'category', categoryId: 'transport' },
      });

      expect(res.status).toBe(200);
      expect((res.body as BulkResponse).changed).toBe(1);
      expect((await rowOrFail(early)).categoryId).toBe('transport');
      expect((await rowOrFail(late)).categoryId).toBe('taxi');
    });

    it('строку выборки удалили между предпросмотром и применением: 409, ничего не записано', async () => {
      const ids = [
        await seed({ categoryId: 'taxi', accountId: ctx.accountId, amount: 1_000 }),
        await seed({ categoryId: 'taxi', accountId: ctx.accountId, amount: 2_000 }),
        await seed({ categoryId: 'taxi', accountId: ctx.accountId, amount: 3_000 }),
      ];
      const body = {
        selection: byFilter({ categoryIds: ['taxi'] }, 3),
        action: { kind: 'account', accountId: secondAccountId },
      };
      expect((await bulk({ ...body, dryRun: true })).status).toBe(200);

      await ctx.dataSource.getRepository(TransactionOrmEntity).delete({ id: ids[1] });
      const res = await bulk(body);
      const dry = await bulk({ ...body, dryRun: true });

      expect(res.status).toBe(409);
      expect(dry.status).toBe(409);
      expect((await rowOrFail(ids[0])).accountId).toBe(ctx.accountId);
      expect((await rowOrFail(ids[2])).accountId).toBe(ctx.accountId);
      expect(await balance(ctx.accountId)).toBe(1_000_000);
      expect(await balance(secondAccountId)).toBe(500_000);
    });

    it('строку правили вручную и она ушла из фильтра: число не сошлось, 409', async () => {
      const first = await seed({ categoryId: 'taxi' });
      await seed({ categoryId: 'taxi' });
      await ctx.dataSource
        .getRepository(TransactionOrmEntity)
        .update({ id: first }, { categoryId: 'food' });

      const res = await bulk({
        selection: byFilter({ categoryIds: ['taxi'] }, 2),
        action: { kind: 'category', categoryId: 'transport' },
      });

      expect(res.status).toBe(409);
    });

    it('больше 2000 подходящих строк: 400 с понятным текстом, в предпросмотре тоже', async () => {
      await seedMany(2001, { categoryId: 'bulk-limit' });
      const body = {
        selection: byFilter({ categoryIds: ['bulk-limit'] }, 2001),
        action: { kind: 'category', categoryId: 'transport' },
      };

      const res = await bulk(body);
      const dry = await bulk({ ...body, dryRun: true });

      expect(res.status).toBe(400);
      expect(dry.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('2000');
    });

    it('ровно 2000 строк проходят', async () => {
      await seedMany(2000, { categoryId: 'bulk-limit' });

      const res = await bulk({
        selection: byFilter({ categoryIds: ['bulk-limit'] }, 2000),
        action: { kind: 'category', categoryId: 'transport' },
      });

      expect(res.status).toBe(200);
      expect((res.body as BulkResponse).changed).toBe(2000);
    });
  });

  describe('замки', () => {
    /** Чужое соединение пытается взять строку без ожидания: ошибка 55P03 значит, что строка заперта. */
    const probe = (id: string) =>
      ctx.dataSource.query('SELECT id FROM transactions WHERE id = $1 FOR UPDATE NOWAIT', [id]);

    it('выборка и вторые половины пар заперты до конца транзакции, чужие строки свободны', async () => {
      const repository = ctx.app.get<ITransactionRepository>(TRANSACTION_REPOSITORY);
      const group = randomUUID();
      const selected = await seed({ categoryId: 'taxi', paymentGroupId: group });
      const sibling = await seed({
        categoryId: 'food',
        paymentGroupId: group,
        accountId: secondAccountId,
      });
      const outside = await seed({ categoryId: 'food' });

      await ctx.dataSource.transaction(async (manager) => {
        const loaded = await repository.findForBulk(
          ctx.userId,
          { kind: 'filter', filter: { categoryIds: ['taxi'] }, maxRows: 10 },
          manager,
          { lock: true },
        );
        expect(loaded.selected.map((r) => r.transaction.id)).toEqual([selected]);
        expect(loaded.siblings.map((r) => r.transaction.id)).toEqual([sibling]);

        await expect(probe(selected)).rejects.toMatchObject({ code: '55P03' });
        await expect(probe(sibling)).rejects.toMatchObject({ code: '55P03' });
        await expect(probe(outside)).resolves.toBeDefined();
      });
    });

    it('предпросмотр строки не запирает', async () => {
      const repository = ctx.app.get<ITransactionRepository>(TRANSACTION_REPOSITORY);
      const id = await seed({ categoryId: 'taxi' });

      await ctx.dataSource.transaction(async (manager) => {
        await repository.findForBulk(ctx.userId, { kind: 'ids', ids: [id] }, manager, {
          lock: false,
        });

        await expect(probe(id)).resolves.toBeDefined();
      });
    });
  });

  describe('выборка по id', () => {
    it('чужая строка — 403, несуществующая — 409, ничего не записано', async () => {
      const own = await seed({ categoryId: 'taxi' });
      const other = await createOtherUser(ctx);
      const foreign = await ctx.dataSource.getRepository(TransactionOrmEntity).save({
        id: randomUUID(),
        userId: other.userId,
        accountId: other.accountId,
        categoryId: 'taxi',
        amount: 100,
        currency: 'UZS',
        type: 'expense',
        date: new Date('2026-10-15T12:00:00Z'),
      } as TransactionOrmEntity);
      const action = { kind: 'category', categoryId: 'transport' };

      const withForeign = await bulk({ selection: { ids: [own, foreign.id] }, action });
      const withMissing = await bulk({ selection: { ids: [own, randomUUID()] }, action });

      expect(withForeign.status).toBe(403);
      expect(withMissing.status).toBe(409);
      expect((await rowOrFail(own)).categoryId).toBe('taxi');
      expect((await rowOrFail(foreign.id)).categoryId).toBe('taxi');
    });

    it('повторные id считаются один раз; обе половины пары — одна позиция', async () => {
      const group = randomUUID();
      const first = await seed({ categoryId: 'taxi', paymentGroupId: group, amount: 60 });
      const second = await seed({
        categoryId: 'taxi',
        paymentGroupId: group,
        accountId: secondAccountId,
        amount: 40,
      });

      const res = await bulk({
        selection: { ids: [first, first, second] },
        action: { kind: 'category', categoryId: 'transport' },
      });

      expect(res.status).toBe(200);
      expect((res.body as BulkResponse).changed).toBe(2);
      expect((await rowOrFail(first)).categoryId).toBe('transport');
      expect((await rowOrFail(second)).categoryId).toBe('transport');
    });

    it('больше 2000 id: 400 с текстом по-русски без пути поля, в предпросмотре тоже', async () => {
      const ids = Array.from({ length: 2001 }, () => randomUUID());
      const body = { selection: { ids }, action: { kind: 'delete' } };

      for (const res of [await bulk(body), await bulk({ ...body, dryRun: true })]) {
        expect(res.status).toBe(400);
        expect((res.body as { message: unknown }).message).toBe(
          'Выбрано больше 2000 операций. Снимите часть отметок или сузьте фильтр.',
        );
      }
    });

    it('тело без выборки или с обеими выборками сразу — 400', async () => {
      const action = { kind: 'delete' };

      expect((await bulk({ selection: {}, action })).status).toBe(400);
      expect(
        (
          await bulk({
            selection: { ids: [randomUUID()], ...byFilter({}, 0) },
            action,
          })
        ).status,
      ).toBe(400);
      expect((await bulk({ selection: { ids: [] }, action })).status).toBe(400);
      const tooMany = Array.from({ length: 2001 }, () => randomUUID());
      expect((await bulk({ selection: { ids: tooMany }, action })).status).toBe(400);
      expect(
        (await bulk({ selection: { ids: [randomUUID()] }, action: { kind: 'nope' } })).status,
      ).toBe(400);
    });
  });

  describe('категория', () => {
    it('встроенные категории со slug-id: фильтр по доходу и перенос в другой slug', async () => {
      const gift = await seed({ type: 'income', categoryId: 'gifts_income', amount: 500 });
      const other = await seed({ type: 'income', categoryId: 'salary', amount: 500 });

      const res = await bulk({
        selection: byFilter({ categoryIds: ['gifts_income'] }, 1),
        action: { kind: 'category', categoryId: 'cashback' },
      });

      expect(res.status).toBe(200);
      expect((res.body as BulkResponse).changed).toBe(1);
      expect((await rowOrFail(gift)).categoryId).toBe('cashback');
      expect((await rowOrFail(other)).categoryId).toBe('salary');
    });

    it('своя категория (UUID) годится целью; чужая, выдуманная и служебные — 400', async () => {
      const own = await insertCategory(ctx.userId, 'expense');
      const other = await createOtherUser(ctx);
      const foreign = await insertCategory(other.userId, 'expense');
      const id = await seed({ categoryId: 'taxi' });

      const ok = await bulk({
        selection: { ids: [id] },
        action: { kind: 'category', categoryId: own },
      });
      expect(ok.status).toBe(200);
      expect((await rowOrFail(id)).categoryId).toBe(own);

      for (const categoryId of [
        foreign,
        randomUUID(),
        'no-such-slug',
        'transfer',
        'balance_adjustment',
        'debt_given',
        'debt_offset',
      ]) {
        const res = await bulk({
          selection: { ids: [id] },
          action: { kind: 'category', categoryId },
        });
        expect(res.status).toBe(400);
      }
      expect((await rowOrFail(id)).categoryId).toBe(own);
    });

    it('строка уже в целевой категории — already_in_category; changed и пропуски покрывают выборку', async () => {
      const taxi = await seed({ categoryId: 'taxi' });
      const already = await seed({ categoryId: 'transport' });
      const income = await seed({ type: 'income', categoryId: 'salary' });

      const res = await bulk({
        selection: { ids: [taxi, already, income] },
        action: { kind: 'category', categoryId: 'transport' },
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        changed: 1,
        skipped: [
          { reason: 'wrong_type', count: 1 },
          { reason: 'already_in_category', count: 1 },
        ],
      });
      expect((await rowOrFail(taxi)).categoryId).toBe('transport');
    });

    it('категория другого типа не ломает операцию: строки пропускаются как wrong_type', async () => {
      const expense = await seed({ categoryId: 'taxi' });

      const res = await bulk({
        selection: { ids: [expense] },
        action: { kind: 'category', categoryId: 'salary' },
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        changed: 0,
        skipped: [{ reason: 'wrong_type', count: 1 }],
      });
      expect((await rowOrFail(expense)).categoryId).toBe('taxi');
      expect((res.body as BulkResponse).undoToken).toBeUndefined();
    });
  });

  describe('перевод на свой счёт', () => {
    it('пара оплаты → два перевода: источники не меняются, целевой +a+b, группа снята у обеих', async () => {
      const target = await seedAccount(ctx);
      const group = randomUUID();
      const first = await seed({
        accountId: ctx.accountId,
        amount: 60_000,
        paymentGroupId: group,
        description: 'Покупка',
      });
      const second = await seed({
        accountId: secondAccountId,
        amount: 40_000,
        paymentGroupId: group,
        description: 'Покупка',
      });

      const res = await bulk({
        selection: { ids: [first] },
        action: { kind: 'transfer', toAccountId: target },
      });

      expect(res.status).toBe(200);
      // В выборке одна половина: в счёт идёт она, хотя переводами становятся обе.
      expect(res.body).toMatchObject({
        changed: 1,
        skipped: [],
        balanceDeltas: [{ accountId: target, currency: 'UZS', delta: 100_000 }],
      });
      for (const [id, accountId, amount] of [
        [first, ctx.accountId, 60_000],
        [second, secondAccountId, 40_000],
      ] as const) {
        expect(await rowOrFail(id)).toMatchObject({
          type: 'transfer',
          categoryId: 'transfer',
          accountId,
          amount,
          toAccountId: target,
          toCurrency: 'UZS',
          paymentGroupId: null,
          isDebtRelated: false,
        });
        expect(Number((await rowOrFail(id)).toAmount)).toBe(amount);
      }
      expect(await balance(ctx.accountId)).toBe(1_000_000);
      expect(await balance(secondAccountId)).toBe(500_000);
      expect(await balance(target)).toBe(100_000);
      const orphans = await ctx.dataSource
        .getRepository(TransactionOrmEntity)
        .count({ where: { paymentGroupId: group } });
      expect(orphans).toBe(0);
    });

    it('пара, у которой одна половина уже на целевом счёте, пропускается целиком', async () => {
      const group = randomUUID();
      const first = await seed({ accountId: ctx.accountId, paymentGroupId: group });
      const second = await seed({ accountId: secondAccountId, paymentGroupId: group });
      const single = await seed({ accountId: ctx.accountId, amount: 5_000 });
      const alreadyThere = await seed({ accountId: secondAccountId });

      const res = await bulk({
        selection: { ids: [first, single, alreadyThere] },
        action: { kind: 'transfer', toAccountId: secondAccountId },
      });

      expect(res.body).toMatchObject({
        changed: 1,
        skipped: [
          { reason: 'same_account', count: 1 },
          { reason: 'pair_on_target', count: 1 },
        ],
        balanceDeltas: [{ accountId: secondAccountId, currency: 'UZS', delta: 5_000 }],
      });
      expect((await rowOrFail(first)).type).toBe('expense');
      expect((await rowOrFail(second)).paymentGroupId).toBe(group);
      expect((await rowOrFail(single)).type).toBe('transfer');
      expect(await balance(secondAccountId)).toBe(505_000);
    });

    it('чужой и несуществующий целевой счёт — 403 и 404', async () => {
      const id = await seed({});
      const other = await createOtherUser(ctx);

      const foreign = await bulk({
        selection: { ids: [id] },
        action: { kind: 'transfer', toAccountId: other.accountId },
      });
      const missing = await bulk({
        selection: { ids: [id] },
        action: { kind: 'account', accountId: randomUUID() },
      });

      expect(foreign.status).toBe(403);
      expect(missing.status).toBe(404);
      expect((await rowOrFail(id)).type).toBe('expense');
    });
  });

  describe('смена счёта', () => {
    it('одиночная строка переезжает с балансом; пара с половиной на целевом счёте — pair_on_target, пара целиком — pair_split', async () => {
      const group = randomUUID();
      const pairFirst = await seed({
        accountId: ctx.accountId,
        paymentGroupId: group,
        amount: 600,
      });
      const pairSecond = await seed({
        accountId: secondAccountId,
        paymentGroupId: group,
        amount: 400,
      });
      const third = await seedAccount(ctx);
      const wholeGroup = randomUUID();
      const wholeFirst = await seed({ accountId: ctx.accountId, paymentGroupId: wholeGroup });
      const wholeSecond = await seed({ accountId: third, paymentGroupId: wholeGroup });
      const expense = await seed({ accountId: ctx.accountId, amount: 10_000 });
      const income = await seed({ accountId: ctx.accountId, type: 'income', amount: 3_000 });

      const res = await bulk({
        selection: { ids: [pairFirst, wholeFirst, wholeSecond, expense, income] },
        action: { kind: 'account', accountId: secondAccountId },
      });

      expect(res.body).toMatchObject({
        changed: 2,
        skipped: [
          { reason: 'pair_on_target', count: 1 },
          { reason: 'pair_split', count: 2 },
        ],
      });
      expect((await rowOrFail(wholeFirst)).accountId).toBe(ctx.accountId);
      expect((await rowOrFail(wholeSecond)).accountId).toBe(third);
      expect((res.body as BulkResponse).balanceDeltas).toHaveLength(2);
      expect((res.body as BulkResponse).balanceDeltas).toEqual(
        expect.arrayContaining([
          { accountId: ctx.accountId, currency: 'UZS', delta: 7_000 },
          { accountId: secondAccountId, currency: 'UZS', delta: -7_000 },
        ]),
      );
      expect((await rowOrFail(expense)).accountId).toBe(secondAccountId);
      expect((await rowOrFail(income)).accountId).toBe(secondAccountId);
      expect((await rowOrFail(pairFirst)).accountId).toBe(ctx.accountId);
      expect((await rowOrFail(pairSecond)).paymentGroupId).toBe(group);
      expect(await balance(ctx.accountId)).toBe(1_007_000);
      expect(await balance(secondAccountId)).toBe(493_000);
    });
  });

  describe('тег', () => {
    it('дописывает тег в описание и пропускает строки, где он уже есть', async () => {
      const plain = await seed({ description: 'Такси домой' });
      const empty = await seed({ description: null });
      const tagged = await seed({ description: 'Работа #Командировка' });

      const res = await bulk({
        selection: { ids: [plain, empty, tagged] },
        action: { kind: 'tag', tag: '#командировка' },
      });

      expect(res.body).toMatchObject({
        changed: 2,
        skipped: [{ reason: 'already_tagged', count: 1 }],
        balanceDeltas: [],
      });
      expect((await rowOrFail(plain)).description).toBe('Такси домой #командировка');
      expect((await rowOrFail(empty)).description).toBe('#командировка');
      expect((await rowOrFail(tagged)).description).toBe('Работа #Командировка');
    });

    it('тег с пробелом — 400', async () => {
      const id = await seed({});

      const res = await bulk({
        selection: { ids: [id] },
        action: { kind: 'tag', tag: 'два слова' },
      });

      expect(res.status).toBe(400);
    });
  });

  describe('удаление', () => {
    it('пара удаляется целиком, оба баланса возвращаются, токена отмены нет', async () => {
      const group = randomUUID();
      const first = await seed({
        accountId: ctx.accountId,
        amount: 60_000,
        paymentGroupId: group,
      });
      const second = await seed({
        accountId: secondAccountId,
        amount: 40_000,
        paymentGroupId: group,
      });

      const res = await bulk({ selection: { ids: [first] }, action: { kind: 'delete' } });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ changed: 1, skipped: [] });
      expect((res.body as BulkResponse).balanceDeltas).toHaveLength(2);
      expect((res.body as BulkResponse).balanceDeltas).toEqual(
        expect.arrayContaining([
          { accountId: ctx.accountId, currency: 'UZS', delta: 60_000 },
          { accountId: secondAccountId, currency: 'UZS', delta: 40_000 },
        ]),
      );
      expect((res.body as BulkResponse).undoToken).toBeUndefined();
      expect(await row(first)).toBeNull();
      expect(await row(second)).toBeNull();
      expect(await balance(ctx.accountId)).toBe(1_060_000);
      expect(await balance(secondAccountId)).toBe(540_000);
    });

    it('доход, расход и перевод возвращают деньги как одиночное удаление; строки под замком остаются', async () => {
      const income = await seed({ type: 'income', amount: 2_000 });
      const expense = await seed({ amount: 500 });
      const transfer = await seed({
        type: 'transfer',
        categoryId: 'transfer',
        amount: 1_000,
        toAccountId: secondAccountId,
        toAmount: 1_000,
        toCurrency: 'UZS',
      });
      const locked = await seed({ amount: 777 });
      await seedDebt(ctx, { feeTransactionId: locked });

      const res = await bulk({
        selection: { ids: [income, expense, transfer, locked] },
        action: { kind: 'delete' },
      });

      expect(res.body).toMatchObject({
        changed: 3,
        skipped: [{ reason: 'locked', count: 1 }],
      });
      expect(await balance(ctx.accountId)).toBe(1_000_000 - 2_000 + 500 + 1_000);
      expect(await balance(secondAccountId)).toBe(500_000 - 1_000);
      expect(await row(locked)).not.toBeNull();
      expect(await row(income)).toBeNull();
      expect(await row(transfer)).toBeNull();
    });
  });

  describe('предпросмотр', () => {
    const actions = (target: string): Record<string, string>[] => [
      { kind: 'transfer', toAccountId: target },
      { kind: 'account', accountId: ctx.secondAccountId },
      { kind: 'delete' },
      { kind: 'category', categoryId: 'transport' },
      { kind: 'tag', tag: 'проверка' },
    ];

    it.each(['transfer', 'account', 'delete', 'category', 'tag'])(
      'действие %s: ничего не пишет, отдаёт те же skipped и balanceDeltas, что применение; токен только у применения',
      async (kind) => {
        const target = await seedAccount(ctx);
        const group = randomUUID();
        const ids = [
          await seed({ accountId: ctx.accountId, amount: 9_000, categoryId: 'taxi' }),
          await seed({ accountId: ctx.accountId, amount: 1_500, categoryId: 'taxi' }),
          await seed({
            accountId: ctx.accountId,
            amount: 300,
            categoryId: 'taxi',
            paymentGroupId: group,
          }),
          await seed({
            accountId: ctx.secondAccountId,
            amount: 200,
            categoryId: 'taxi',
            paymentGroupId: group,
          }),
          await seed({ categoryId: 'taxi', isInformational: true }),
        ];
        const action = actions(target).find((candidate) => candidate.kind === kind)!;
        const body = { selection: { ids }, action };
        const snapshot = async () => ({
          rows: await Promise.all(ids.map((id) => row(id))),
          balances: [
            await balance(ctx.accountId),
            await balance(ctx.secondAccountId),
            await balance(target),
          ],
        });
        const before = await snapshot();

        const preview = await bulk({ ...body, dryRun: true });

        expect(preview.status).toBe(200);
        expect((preview.body as BulkResponse).undoToken).toBeUndefined();
        expect(await snapshot()).toEqual(before);

        const applied = await bulk(body);

        const { undoToken, ...appliedResult } = applied.body as BulkResponse;
        expect(appliedResult).toEqual(preview.body);
        expect(typeof undoToken).toBe(kind === 'delete' ? 'undefined' : 'string');
        expect(appliedResult.skipped.find((s) => s.reason === 'locked')).toEqual({
          reason: 'locked',
          count: 1,
        });
      },
    );
  });
});
