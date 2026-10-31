import { randomUUID } from 'crypto';
import {
  setupHistoryTestContext,
  seedAccount,
  seedTransaction,
  seedDebt,
  type HistoryTestContext,
  type SeedTransaction,
} from './helpers/history-test-db';
import { DEBT_CATEGORY_IDS } from '../src/modules/accounting/domain/constants/default-categories';
import { BalanceCalculationService } from '../src/modules/accounting/domain/services/balance-calculation.service';
import {
  TRANSACTION_REPOSITORY,
  type ITransactionRepository,
} from '../src/modules/accounting/domain/repositories/transaction.repository.interface';

interface ListRow {
  id: string;
  description: string | null;
  bulkLocked: boolean;
  amount: number;
  netAmount: number;
  type: string;
  isDebtRelated: boolean;
  paymentSibling: { id: string; amount: number } | null;
}

interface ListResponse {
  data: ListRow[];
  hasMore: boolean;
  nextCursor: { date: string; createdAt: string; id: string } | null;
}

interface SummaryResponse {
  count: number;
  eligibleCount: number;
  lockedCount: number;
  totals: { currency: string; amount: number }[];
  asOf: string;
}

const OCT = (day: number) => new Date(`2026-10-${String(day).padStart(2, '0')}T12:00:00Z`);

describe('История: фильтры, предикат участия и итог', () => {
  let ctx: HistoryTestContext;
  let minute = 0;

  beforeEach(async () => {
    minute = 0;
    ctx = await setupHistoryTestContext();
  });

  /**
   * Дата дня `day` с уникальной минутой: у строк разные `date`, и курсор ленты не упирается в
   * тай-брейк по `created_at` (колонка без часового пояса, на не-UTC машине он съезжает).
   */
  const uniqueDate = (day: number) => new Date(OCT(day).getTime() + minute++ * 60_000);

  afterEach(async () => {
    await ctx.closeAndCleanup();
  });

  const list = async (query = '', pageSize = 100): Promise<ListResponse> => {
    const res = await ctx.get(`/transactions?pageSize=${pageSize}${query ? `&${query}` : ''}`);
    expect(res.status).toBe(200);
    return res.body as ListResponse;
  };

  /** Все страницы ленты по курсору — ровно то, что увидит пользователь, домотав до конца. */
  const listAll = async (query = '', pageSize = 3): Promise<ListRow[]> => {
    const rows: ListRow[] = [];
    let cursor = '';
    for (let page = 0; page < 100; page++) {
      const res = await list(`${query}${cursor}`, pageSize);
      rows.push(...res.data);
      if (!res.hasMore || !res.nextCursor) return rows;
      const { date, createdAt, id } = res.nextCursor;
      cursor = `&cursorDate=${date}&cursorCreatedAt=${createdAt}&cursorId=${id}`;
    }
    throw new Error('Лента не кончилась за 100 страниц');
  };

  const summary = async (query = ''): Promise<SummaryResponse> => {
    const res = await ctx.get(`/transactions/summary${query ? `?${query}` : ''}`);
    expect(res.status).toBe(200);
    return res.body as SummaryResponse;
  };

  const labels = (rows: ListRow[]): string[] => rows.map((r) => r.description ?? '').sort();

  describe('bulkLocked: предикат участия в массовой правке', () => {
    it('помечает каждую строку, которая вне правки, и не трогает обычные', async () => {
      await seedTransaction(ctx, { description: 'informational', isInformational: true });
      await seedTransaction(ctx, {
        description: 'adjustment',
        type: 'adjustment',
        categoryId: 'balance_adjustment',
      });
      await seedTransaction(ctx, {
        description: 'debt-id',
        debtId: randomUUID(),
        isDebtRelated: true,
      });
      await seedTransaction(ctx, { description: 'settlement', settlementId: randomUUID() });
      const loanRow = await seedTransaction(ctx, {
        description: 'loan-row',
        categoryId: DEBT_CATEGORY_IDS.GIVEN,
        isDebtRelated: true,
      });
      // Строка чека, из которой создан долг, и строка комиссии не несут ни одного флага.
      const receiptSource = await seedTransaction(ctx, { description: 'receipt-source' });
      const feeRow = await seedTransaction(ctx, { description: 'fee', categoryId: 'commission' });
      await seedDebt(ctx, { transactionId: loanRow });
      await seedDebt(ctx, { sourceTransactionId: receiptSource });
      await seedDebt(ctx, { feeTransactionId: feeRow });

      await seedTransaction(ctx, { description: 'plain-expense' });
      await seedTransaction(ctx, { description: 'plain-income', type: 'income' });
      await seedTransaction(ctx, {
        description: 'plain-transfer',
        type: 'transfer',
        toAccountId: ctx.secondAccountId,
        toAmount: 100,
        toCurrency: 'UZS',
        categoryId: 'transfer',
      });

      const res = await list();

      expect(Object.fromEntries(res.data.map((r) => [r.description, r.bulkLocked]))).toEqual({
        informational: true,
        adjustment: true,
        'debt-id': true,
        settlement: true,
        'loan-row': true,
        'receipt-source': true,
        fee: true,
        'plain-expense': false,
        'plain-income': false,
        'plain-transfer': false,
      });
    });

    it('пара оплаты закрыта целиком, если долг висит на одной половине', async () => {
      const paymentGroupId = randomUUID();
      await seedTransaction(ctx, { description: 'pair-free', amount: 60, paymentGroupId });
      const shared = await seedTransaction(ctx, {
        description: 'pair-shared',
        amount: 40,
        paymentGroupId,
        accountId: ctx.secondAccountId,
      });
      await seedDebt(ctx, { sourceTransactionId: shared });
      await seedTransaction(ctx, { description: 'plain-expense' });

      const res = await list();
      const totals = await summary();

      expect(Object.fromEntries(res.data.map((r) => [r.description, r.bulkLocked]))).toEqual({
        'pair-free': true,
        'pair-shared': true,
        'plain-expense': false,
      });
      expect(totals).toMatchObject({ count: 3, lockedCount: 2, eligibleCount: 1 });
    });
  });

  describe('GET /transactions: фильтры', () => {
    it('несколько категорий: повторяющийся параметр, одно значение и список через запятую', async () => {
      await seedTransaction(ctx, { description: 'food', categoryId: 'food' });
      await seedTransaction(ctx, { description: 'taxi', categoryId: 'taxi' });
      await seedTransaction(ctx, { description: 'rent', categoryId: 'rent' });

      expect(labels((await list('categoryIds=food&categoryIds=taxi')).data)).toEqual([
        'food',
        'taxi',
      ]);
      expect(labels((await list('categoryIds=taxi')).data)).toEqual(['taxi']);
      expect(labels((await list('categoryIds=food,rent')).data)).toEqual(['food', 'rent']);
    });

    it('категории принимаются как строки, а не UUID: встроенный slug и пользовательский UUID', async () => {
      const custom = randomUUID();
      await seedTransaction(ctx, {
        description: 'gift',
        type: 'income',
        categoryId: 'gifts_income',
      });
      await seedTransaction(ctx, { description: 'custom', categoryId: custom });
      await seedTransaction(ctx, { description: 'other', categoryId: 'food' });

      const res = await list(`categoryIds=gifts_income&categoryIds=${custom}`);

      expect(labels(res.data)).toEqual(['custom', 'gift']);
    });

    it('несколько счетов; счёт ловит и входящий перевод', async () => {
      await seedTransaction(ctx, { description: 'on-first' });
      await seedTransaction(ctx, { description: 'on-second', accountId: ctx.secondAccountId });
      await seedTransaction(ctx, {
        description: 'first-to-second',
        type: 'transfer',
        categoryId: 'transfer',
        toAccountId: ctx.secondAccountId,
        toAmount: 100,
        toCurrency: 'UZS',
      });
      const third = await seedAccount(ctx);
      await seedTransaction(ctx, { description: 'on-third', accountId: third });

      expect(labels((await list(`accountIds=${ctx.secondAccountId}`)).data)).toEqual([
        'first-to-second',
        'on-second',
      ]);
      expect(labels((await list(`accountIds=${ctx.accountId}&accountIds=${third}`)).data)).toEqual([
        'first-to-second',
        'on-first',
        'on-third',
      ]);
    });

    it('старые categoryId и accountId работают как раньше: счёт не видит входящий перевод', async () => {
      await seedTransaction(ctx, { description: 'food', categoryId: 'food' });
      await seedTransaction(ctx, { description: 'taxi', categoryId: 'taxi' });
      await seedTransaction(ctx, {
        description: 'incoming',
        type: 'transfer',
        categoryId: 'transfer',
        toAccountId: ctx.secondAccountId,
        toAmount: 100,
        toCurrency: 'UZS',
      });

      expect(labels((await list('categoryId=taxi')).data)).toEqual(['taxi']);
      expect(labels((await list('search=ax')).data)).toEqual(['taxi']);
      expect(labels((await list(`accountId=${ctx.secondAccountId}`)).data)).toEqual([]);
    });

    it('поиск ищет % и _ буквально, а не как шаблон LIKE', async () => {
      await seedTransaction(ctx, { description: 'скидка 50%' });
      await seedTransaction(ctx, { description: 'скидка 500' });
      await seedTransaction(ctx, { description: 'a_b' });
      await seedTransaction(ctx, { description: 'axb' });

      expect(labels((await list('search=50%25')).data)).toEqual(['скидка 50%']);
      expect(labels((await list('search=a_b')).data)).toEqual(['a_b']);
    });

    it('тег: граница как у getHashtags, без учёта регистра', async () => {
      await seedTransaction(ctx, { description: 'plain #кафе' });
      await seedTransaction(ctx, { description: 'comma #Кафе, с друзьями' });
      await seedTransaction(ctx, { description: 'paren (#кафе) вечером' });
      await seedTransaction(ctx, { description: 'other #кафе2' });
      await seedTransaction(ctx, { description: 'prefix #кафеман' });
      await seedTransaction(ctx, { description: 'мульти #работа #кафе' });
      await seedTransaction(ctx, { description: 'no tag кафе' });
      await seedTransaction(ctx, { description: null });

      const expected = [
        'comma #Кафе, с друзьями',
        'paren (#кафе) вечером',
        'plain #кафе',
        'мульти #работа #кафе',
      ];
      expect(labels((await list(`tags=${encodeURIComponent('кафе')}`)).data)).toEqual(expected);
      expect(labels((await list(`tags=${encodeURIComponent('#КАФЕ')}`)).data)).toEqual(expected);
    });

    it('несколько тегов: подходит строка хотя бы с одним; спецсимволы тега не ломают запрос', async () => {
      await seedTransaction(ctx, { description: 'a #работа' });
      await seedTransaction(ctx, { description: 'b #кафе' });
      await seedTransaction(ctx, { description: 'c #c++ урок' });
      await seedTransaction(ctx, { description: 'd #cxx' });
      await seedTransaction(ctx, { description: 'e #другое' });

      expect(labels((await list('tags=работа&tags=кафе')).data)).toEqual(['a #работа', 'b #кафе']);
      expect(labels((await list(`tags=${encodeURIComponent('c++')}`)).data)).toEqual([
        'c #c++ урок',
      ]);
    });

    it('период включает обе границы календарных дней, дни считаются в часовом поясе пользователя', async () => {
      await ctx.closeAndCleanup();
      ctx = await setupHistoryTestContext('Asia/Tashkent');
      const at = (iso: string) => new Date(iso);
      await seedTransaction(ctx, { description: 'before', date: at('2026-09-30T23:59:59+05:00') });
      await seedTransaction(ctx, {
        description: 'first-instant',
        date: at('2026-10-01T00:00:00+05:00'),
      });
      await seedTransaction(ctx, { description: 'middle', date: at('2026-10-15T12:00:00+05:00') });
      await seedTransaction(ctx, {
        description: 'last-moment',
        date: at('2026-10-31T23:59:59+05:00'),
      });
      await seedTransaction(ctx, { description: 'after', date: at('2026-11-01T00:00:00+05:00') });

      const res = await list('startDate=2026-10-01&endDate=2026-10-31');

      expect(labels(res.data)).toEqual(['first-instant', 'last-moment', 'middle']);
      expect(labels((await list('startDate=2026-10-31')).data)).toEqual(['after', 'last-moment']);
      expect(labels((await list('endDate=2026-10-01')).data)).toEqual(['before', 'first-instant']);
    });

    it('отвергает не-календарные даты, неверный UUID счёта и тег с границей внутри', async () => {
      expect((await ctx.get('/transactions?startDate=2026-10-01T10:00:00Z')).status).toBe(400);
      expect((await ctx.get('/transactions?endDate=2026-02-31')).status).toBe(400);
      expect((await ctx.get('/transactions?accountIds=not-a-uuid')).status).toBe(400);
      expect((await ctx.get('/transactions?tags=a%20b')).status).toBe(400);
    });

    it('фильтры сочетаются и работают со страницами по курсору', async () => {
      for (let day = 1; day <= 7; day++) {
        await seedTransaction(ctx, {
          description: `taxi-${day}`,
          categoryId: 'taxi',
          date: OCT(day),
        });
      }
      await seedTransaction(ctx, { description: 'food', categoryId: 'food', date: OCT(4) });

      const rows = await listAll('categoryIds=taxi&startDate=2026-10-02&endDate=2026-10-06', 2);

      expect(rows.map((r) => r.description)).toEqual([
        'taxi-6',
        'taxi-5',
        'taxi-4',
        'taxi-3',
        'taxi-2',
      ]);
    });
  });

  describe('asOf: сверка выборки с моментом итога', () => {
    it('в итог не попадают строки, созданные после asOf, а граница включается', async () => {
      const asOf = new Date('2026-10-20T10:00:00.000Z');
      await seedTransaction(ctx, {
        description: 'before',
        createdAt: new Date(asOf.getTime() - 1000),
      });
      await seedTransaction(ctx, { description: 'at', createdAt: asOf });
      await seedTransaction(ctx, {
        description: 'after',
        createdAt: new Date(asOf.getTime() + 1000),
      });
      const repository = ctx.app.get<ITransactionRepository>(TRANSACTION_REPOSITORY);

      const summaryAt = await repository.getSummary(ctx.userId, { asOf });
      const summaryNow = await repository.getSummary(ctx.userId, {});

      expect(summaryAt.count).toBe(2);
      expect(summaryNow.count).toBe(3);
    });
  });

  describe('type=expense: возвращённые расходы отсеиваются в SQL', () => {
    /** Долг на расход `sourceId` и возврат по нему на `amount`. */
    const returnOnto = async (sourceId: string, amount: number) => {
      const debtId = await seedDebt(ctx, { sourceTransactionId: sourceId });
      await seedTransaction(ctx, {
        description: `return-${amount}`,
        type: 'income',
        categoryId: DEBT_CATEGORY_IDS.RETURN_TO_ME,
        isDebtRelated: true,
        amount,
        debtId,
        date: uniqueDate(28),
      });
    };

    it('страница по 2 приходит полной, а полностью возвращённая строка не попадает', async () => {
      const fully = await seedTransaction(ctx, {
        description: 'fully',
        amount: 100,
        date: OCT(20),
      });
      await returnOnto(fully, 100);
      await seedTransaction(ctx, { description: 'new-1', date: OCT(19) });
      await seedTransaction(ctx, { description: 'new-2', date: OCT(18) });
      const partial = await seedTransaction(ctx, {
        description: 'partial',
        amount: 100,
        date: OCT(17),
      });
      await returnOnto(partial, 40);

      const firstPage = await list('type=expense', 2);

      expect(firstPage.data.map((r) => r.description)).toEqual(['new-1', 'new-2']);
      expect(firstPage.hasMore).toBe(true);
      const all = await listAll('type=expense', 2);
      expect(all.map((r) => r.description)).toEqual(['new-1', 'new-2', 'partial']);
      expect(all[2].netAmount).toBe(60);
    });

    it('пара оплаты: отсев совпадает с долей возвратов, которую считает paymentPartReturnedAmount', async () => {
      const group = (name: string) => ({ group: randomUUID(), name });
      // Пары: возврат на первую половину 100 / 70 / 30 при половинах 60 + 40.
      const scenarios = [
        { ...group('full'), returned: 100 },
        { ...group('over'), returned: 70 },
        { ...group('under'), returned: 30 },
      ];
      for (const { group: paymentGroupId, name, returned } of scenarios) {
        const first = await seedTransaction(ctx, {
          description: `${name}-a`,
          amount: 60,
          paymentGroupId,
          date: uniqueDate(10),
        });
        await seedTransaction(ctx, {
          description: `${name}-b`,
          amount: 40,
          accountId: ctx.secondAccountId,
          paymentGroupId,
          date: uniqueDate(10),
        });
        await returnOnto(first, returned);
      }

      const withoutFilter = await listAll('', 4);
      const byLabel = Object.fromEntries(
        withoutFilter.map((r) => [r.description, r.netAmount]),
      ) as Record<string, number>;
      // Эталон — те же netAmount из ленты без фильтра: SQL должен оставить ровно строки с net > 0.
      expect(byLabel).toMatchObject({
        'full-a': 0,
        'full-b': 0,
        'over-a': 0,
        'over-b': 30,
        'under-a': 30,
        'under-b': 40,
      });

      const expense = await listAll('type=expense', 4);

      expect(labels(expense)).toEqual(['over-b', 'under-a', 'under-b']);
      expect(expense.every((r) => r.netAmount > 0)).toBe(true);
    });

    it('на любых данных type=expense равен строкам ленты без фильтра с типом expense и net > 0', async () => {
      const a = await seedTransaction(ctx, { description: 'a', amount: 50, date: OCT(5) });
      await returnOnto(a, 50);
      const b = await seedTransaction(ctx, { description: 'b', amount: 50, date: OCT(6) });
      await returnOnto(b, 20);
      await seedTransaction(ctx, { description: 'c', date: OCT(7) });
      await seedTransaction(ctx, { description: 'income', type: 'income', date: OCT(8) });

      const all = await listAll('', 3);
      const reference = all
        .filter((r) => r.type === 'expense' && !r.isDebtRelated && r.netAmount > 0)
        .map((r) => r.id)
        .sort();
      const filtered = (await listAll('type=expense', 3)).map((r) => r.id).sort();

      expect(filtered).toEqual(reference);
    });
  });

  describe('GET /transactions/summary', () => {
    it('смешанные валюты дают по строке на валюту, со знаком: доход плюс, расход минус', async () => {
      await seedTransaction(ctx, { type: 'income', amount: 300 });
      await seedTransaction(ctx, { amount: 100 });
      await seedTransaction(ctx, { amount: 50, currency: 'USD' });

      const res = await summary();

      expect(res.count).toBe(3);
      expect([...res.totals].sort((x, y) => x.currency.localeCompare(y.currency))).toEqual([
        { currency: 'USD', amount: -50 },
        { currency: 'UZS', amount: 200 },
      ]);
    });

    it('корректировка по своему направлению, перевод даёт 0, но считается; информационная не двигает сумму', async () => {
      await seedTransaction(ctx, {
        type: 'adjustment',
        amount: 70,
        categoryId: 'balance_adjustment',
      });
      await seedTransaction(ctx, {
        type: 'adjustment',
        amount: 20,
        categoryId: 'balance_adjustment',
        isDebtRelated: true,
      });
      await seedTransaction(ctx, {
        type: 'transfer',
        categoryId: 'transfer',
        amount: 999,
        toAccountId: ctx.secondAccountId,
        toAmount: 999,
        toCurrency: 'UZS',
      });
      await seedTransaction(ctx, { amount: 500, isInformational: true });

      const res = await summary();

      expect(res.count).toBe(4);
      expect(res.totals).toEqual([{ currency: 'UZS', amount: 50 }]);
    });

    it('знак каждой строки в totals совпадает с BalanceCalculationService.nonTransferDirection', async () => {
      // SQL итога и доменный знак не могут переиспользовать друг друга; суммы — степени двойки,
      // поэтому расхождение знака у любой строки меняет итог.
      const paymentGroupId = randomUUID();
      const transfer = {
        type: 'transfer',
        categoryId: 'transfer',
        toAccountId: ctx.secondAccountId,
        toCurrency: 'UZS',
      };
      const adjustment = { type: 'adjustment', categoryId: 'balance_adjustment' };
      const rows: (SeedTransaction & { amount: number })[] = [
        { type: 'income', amount: 1 },
        { type: 'income', amount: 2, isDebtRelated: true },
        { type: 'expense', amount: 4 },
        { type: 'expense', amount: 8, isDebtRelated: true },
        { ...transfer, amount: 16, toAmount: 16 },
        { ...adjustment, amount: 32 },
        { ...adjustment, amount: 64, isDebtRelated: true },
        { type: 'expense', amount: 128, paymentGroupId },
        { type: 'expense', amount: 256, paymentGroupId, accountId: ctx.secondAccountId },
        { type: 'expense', amount: 512, isInformational: true },
        { type: 'income', amount: 1024, isInformational: true },
        { type: 'income', amount: 1, currency: 'USD' },
        { ...adjustment, amount: 2, currency: 'USD', isDebtRelated: true },
      ];
      for (const row of rows) await seedTransaction(ctx, row);

      const expected = new Map<string, number>();
      for (const row of rows) {
        // Информационную строку итог обнуляет сам: до расчёта остатков такие строки не доходят.
        const sign = row.isInformational
          ? 0
          : BalanceCalculationService.nonTransferDirection(row.type!, row.isDebtRelated ?? false);
        const currency = row.currency ?? 'UZS';
        expected.set(currency, (expected.get(currency) ?? 0) + sign * row.amount);
      }

      const res = await summary();

      expect(res.count).toBe(rows.length);
      expect([...res.totals].sort((x, y) => x.currency.localeCompare(y.currency))).toEqual(
        [...expected]
          .map(([currency, amount]) => ({ currency, amount }))
          .sort((x, y) => x.currency.localeCompare(y.currency)),
      );
    });

    it('валюта, где все строки — переводы, остаётся в totals с нулём', async () => {
      await seedTransaction(ctx, {
        type: 'transfer',
        categoryId: 'transfer',
        currency: 'USD',
        toAccountId: ctx.secondAccountId,
        toAmount: 100,
        toCurrency: 'USD',
      });

      expect((await summary()).totals).toEqual([{ currency: 'USD', amount: 0 }]);
    });

    it('lockedCount считает долговые строки, eligibleCount = count − lockedCount', async () => {
      const loan = await seedTransaction(ctx, {
        categoryId: DEBT_CATEGORY_IDS.GIVEN,
        isDebtRelated: true,
      });
      await seedDebt(ctx, { transactionId: loan });
      const receipt = await seedTransaction(ctx, {});
      await seedDebt(ctx, { sourceTransactionId: receipt });
      await seedTransaction(ctx, { debtId: randomUUID() });
      await seedTransaction(ctx, { settlementId: randomUUID() });
      await seedTransaction(ctx, { isInformational: true });
      await seedTransaction(ctx, { type: 'adjustment', categoryId: 'balance_adjustment' });
      await seedTransaction(ctx, {});
      await seedTransaction(ctx, { type: 'income' });

      const res = await summary();

      expect(res).toMatchObject({ count: 8, lockedCount: 6, eligibleCount: 2 });
    });

    it('пара оплаты — две строки, как в ленте', async () => {
      const paymentGroupId = randomUUID();
      await seedTransaction(ctx, { amount: 60, paymentGroupId });
      await seedTransaction(ctx, { amount: 40, paymentGroupId, accountId: ctx.secondAccountId });

      const res = await summary();

      expect(res.count).toBe(2);
      expect(res.totals).toEqual([{ currency: 'UZS', amount: -100 }]);
    });

    it('пустая выборка: нули и пустой totals; asOf — ISO-момент сервера', async () => {
      const before = Date.now();

      const res = await summary('categoryIds=nothing');

      expect(res).toMatchObject({ count: 0, eligibleCount: 0, lockedCount: 0, totals: [] });
      expect(new Date(res.asOf).toISOString()).toBe(res.asOf);
      expect(new Date(res.asOf).getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(new Date(res.asOf).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('принимает те же фильтры, что и лента, и отвергает курсор и размер страницы', async () => {
      await seedTransaction(ctx, { description: 'taxi #такси', categoryId: 'taxi', date: OCT(5) });
      await seedTransaction(ctx, { description: 'food', categoryId: 'food', date: OCT(5) });

      expect(
        (await summary('categoryIds=taxi&tags=такси&startDate=2026-10-05&endDate=2026-10-05'))
          .count,
      ).toBe(1);
      expect((await ctx.get('/transactions/summary?pageSize=10')).status).toBe(400);
    });

    it.each([
      ['type=expense'],
      ['type=income'],
      ['categoryIds=taxi&categoryIds=food'],
      ['tags=кафе'],
      ['accountIds=ACCOUNT_2'],
      ['startDate=2026-10-03&endDate=2026-10-06'],
      ['type=expense&categoryIds=food&startDate=2026-10-03'],
      ['search=pair'],
      ['search=%D0%9A%D0%B0%D1%84%D0%B5&type=expense&accountIds=ACCOUNT_1&startDate=2026-10-04'],
    ])('count совпадает с лентой, пролистанной до конца: %s', async (queryTemplate) => {
      const query = queryTemplate
        .replace('ACCOUNT_1', ctx.accountId)
        .replace('ACCOUNT_2', ctx.secondAccountId);
      const returned = await seedTransaction(ctx, {
        description: 'returned #кафе',
        categoryId: 'food',
        amount: 80,
        date: uniqueDate(3),
      });
      const debtId = await seedDebt(ctx, { sourceTransactionId: returned });
      await seedTransaction(ctx, {
        type: 'income',
        categoryId: DEBT_CATEGORY_IDS.RETURN_TO_ME,
        isDebtRelated: true,
        amount: 80,
        debtId,
        date: uniqueDate(28),
      });
      const group = randomUUID();
      await seedTransaction(ctx, {
        description: 'pair-a #кафе',
        categoryId: 'food',
        amount: 30,
        paymentGroupId: group,
        date: uniqueDate(4),
      });
      await seedTransaction(ctx, {
        description: 'pair-b',
        categoryId: 'food',
        amount: 20,
        paymentGroupId: group,
        accountId: ctx.secondAccountId,
        date: uniqueDate(4),
      });
      await seedTransaction(ctx, { description: 'taxi', categoryId: 'taxi', date: uniqueDate(5) });
      await seedTransaction(ctx, {
        description: 'salary',
        type: 'income',
        categoryId: 'salary',
        date: uniqueDate(6),
      });
      await seedTransaction(ctx, {
        description: 'move',
        type: 'transfer',
        categoryId: 'transfer',
        toAccountId: ctx.secondAccountId,
        toAmount: 5,
        toCurrency: 'UZS',
        date: uniqueDate(7),
      });
      await seedTransaction(ctx, {
        description: 'late #Кафе',
        categoryId: 'food',
        date: uniqueDate(9),
      });

      const rows = await listAll(query, 2);
      const res = await summary(query);

      expect(res.count).toBe(rows.length);
      expect(res.lockedCount).toBe(rows.filter((r) => r.bulkLocked).length);
    });
  });
});
