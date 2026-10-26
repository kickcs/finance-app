import { randomUUID } from 'crypto';
import type { EntityManager } from 'typeorm';
import { setupDebtTestContext, type DebtTestContext } from './helpers/debt-test-db';
import { BackfillTransactionSettlement1785900000001 } from '../src/database/migrations/1785900000001-BackfillTransactionSettlement';
import { TransactionOrmEntity } from '../src/modules/accounting/infrastructure/persistence/typeorm/transaction.orm-entity';
import { DebtOrmEntity } from '../src/modules/debt/infrastructure/persistence/typeorm/debt.orm-entity';
import { DEBT_CATEGORY_IDS } from '../src/modules/accounting/domain/constants/default-categories';

type Snapshot = Map<string, string | null>;

const T0 = new Date('2026-10-20T10:00:00.000Z');
const at = (base: Date, seconds: number) => new Date(base.getTime() + seconds * 1000);
const PRESET_SETTLEMENT = randomUUID();

describe('Связка старых записей расчётов (миграция)', () => {
  let ctx: DebtTestContext;
  // Имя записи -> id: тесты читают итог по смыслу записи, а не по индексу.
  const ids: Record<string, string> = {};
  let afterFirst: Snapshot;
  let afterSecond: Snapshot;
  let afterDown: Snapshot;

  const sid = (name: string): string | null => {
    const value = afterFirst.get(ids[name]);
    if (value === undefined) throw new Error(`запись ${name} не найдена в срезе`);
    return value;
  };

  async function insertDebt(input: {
    type: 'given' | 'taken';
    name: string;
    personName: string | null;
    transactionId?: string;
    sourceTransactionId?: string;
    feeTransactionId?: string;
  }): Promise<string> {
    const id = randomUUID();
    await ctx.dataSource.getRepository(DebtOrmEntity).insert({
      id,
      userId: ctx.userId,
      name: input.name,
      totalAmount: 1000,
      remainingAmount: 0,
      debtType: input.type,
      currency: 'UZS',
      personName: input.personName,
      accountId: ctx.accountId,
      transactionId: input.transactionId ?? null,
      sourceTransactionId: input.sourceTransactionId ?? null,
      feeTransactionId: input.feeTransactionId ?? null,
    });
    return id;
  }

  /** Запись «как писал старый код»: без settlement_id, если не сказано иное. */
  async function insertRecord(
    name: string,
    input: {
      debtId?: string | null;
      categoryId: string;
      type: 'income' | 'expense';
      date: Date;
      createdAt: Date;
      accountId?: string;
      description?: string;
      isInformational?: boolean;
      settlementId?: string | null;
      id?: string;
    },
  ): Promise<void> {
    const id = input.id ?? randomUUID();
    ids[name] = id;
    await ctx.dataSource.getRepository(TransactionOrmEntity).insert({
      id,
      userId: ctx.userId,
      accountId: input.accountId ?? ctx.accountId,
      categoryId: input.categoryId,
      amount: 100,
      currency: 'UZS',
      type: input.type,
      description: input.description ?? name,
      date: input.date,
      createdAt: input.createdAt,
      isDebtRelated: false,
      isInformational: input.isInformational ?? false,
      debtId: input.debtId ?? null,
      settlementId: input.settlementId ?? null,
    });
  }

  async function snapshot(manager: EntityManager): Promise<Snapshot> {
    const rows = await manager.find(TransactionOrmEntity, { where: { userId: ctx.userId } });
    return new Map(rows.map((r) => [r.id, r.settlementId]));
  }

  async function seed(): Promise<void> {
    const dateAli = new Date('2026-10-20T10:00:00.000Z');
    const dateBob = new Date('2026-10-21T09:00:00.000Z');
    const dateOffset = new Date('2026-10-22T12:00:00.123Z');

    const ali = await insertDebt({ type: 'given', name: 'Долг Ali', personName: 'Ali' });
    const ali2 = await insertDebt({ type: 'given', name: 'Долг Ali 2', personName: 'Ali' });
    const bob = await insertDebt({ type: 'given', name: 'Долг Bobur', personName: 'Bobur' });
    const valiGiven = await insertDebt({ type: 'given', name: 'Долг Vali', personName: 'Vali' });
    const valiTaken = await insertDebt({
      type: 'taken',
      name: 'Долг перед Vali',
      personName: 'Vali',
    });
    const sardor = await insertDebt({ type: 'given', name: 'Долг Sardor', personName: 'Sardor' });
    // Человек не указан: имя из описания берётся из названия долга.
    const rustam = await insertDebt({ type: 'given', name: 'Rustam', personName: '  ' });

    // Выдача, ссылка на чек и комиссия лежат с debt_id, но расчётами не являются.
    const creationId = randomUUID();
    const sourceId = randomUUID();
    const feeId = randomUUID();
    const karim = await insertDebt({
      type: 'given',
      name: 'Долг Karim',
      personName: 'Karim',
      transactionId: creationId,
      sourceTransactionId: sourceId,
      feeTransactionId: feeId,
    });

    // Платёж с прощением: две записи одной даты на одном долге.
    await insertRecord('aliReturn', {
      debtId: ali,
      categoryId: DEBT_CATEGORY_IDS.RETURN_TO_ME,
      type: 'income',
      date: dateAli,
      createdAt: T0,
    });
    await insertRecord('aliForgiven', {
      debtId: ali,
      categoryId: DEBT_CATEGORY_IDS.FORGIVEN,
      type: 'expense',
      date: dateAli,
      createdAt: at(T0, 0.1),
      isInformational: true,
    });
    // Более ранний платёж по тому же долгу: другая дата — другой расчёт.
    await insertRecord('aliEarlierReturn', {
      debtId: ali,
      categoryId: DEBT_CATEGORY_IDS.RETURN_TO_ME,
      type: 'income',
      date: new Date('2026-10-18T10:00:00.000Z'),
      createdAt: new Date('2026-10-18T10:00:00.000Z'),
    });

    // Отработка: нога работы (недолговая категория) и возврат.
    await insertRecord('bobWorkLeg', {
      debtId: bob,
      categoryId: 'food',
      type: 'expense',
      date: dateBob,
      createdAt: at(T0, 3600),
    });
    await insertRecord('bobReturn', {
      debtId: bob,
      categoryId: DEBT_CATEGORY_IDS.RETURN_TO_ME,
      type: 'income',
      date: dateBob,
      createdAt: at(T0, 3600),
    });

    // Зачёт: две записи одной отметки времени на двух долгах одного человека.
    await insertRecord('offsetGiven', {
      debtId: valiGiven,
      categoryId: DEBT_CATEGORY_IDS.OFFSET,
      type: 'income',
      date: dateOffset,
      createdAt: dateOffset,
      isInformational: true,
    });
    await insertRecord('offsetTaken', {
      debtId: valiTaken,
      categoryId: DEBT_CATEGORY_IDS.OFFSET,
      type: 'expense',
      date: dateOffset,
      createdAt: dateOffset,
      isInformational: true,
    });
    // Другая отметка времени — другой зачёт.
    await insertRecord('offsetLater', {
      debtId: valiGiven,
      categoryId: DEBT_CATEGORY_IDS.OFFSET,
      type: 'income',
      date: at(dateOffset, 86400),
      createdAt: at(dateOffset, 86400),
      isInformational: true,
    });

    // Переплата: возврат второго долга Ali на 2 с позже первого, переплата ещё через 1 с.
    // Оба возврата попадают в 5 с окно, выбирается последний.
    await insertRecord('ali2Return', {
      debtId: ali2,
      categoryId: DEBT_CATEGORY_IDS.RETURN_TO_ME,
      type: 'income',
      date: new Date('2026-10-20T10:00:02.000Z'),
      createdAt: at(T0, 2),
    });
    await insertRecord('aliExcess', {
      categoryId: 'other_income',
      type: 'income',
      date: new Date('2026-10-19T00:00:00.000Z'),
      createdAt: at(T0, 3),
      description: 'Переплата по долгу: Ali',
    });
    // Переплата на другом счёте: возврата Ali там нет.
    await insertRecord('aliExcessOtherAccount', {
      categoryId: 'other_income',
      type: 'income',
      date: dateAli,
      createdAt: at(T0, 3),
      accountId: ctx.secondAccountId,
      description: 'Переплата по долгу: Ali',
    });
    // Переплата через 10 с после возврата: вне окна.
    await insertRecord('sardorReturn', {
      debtId: sardor,
      categoryId: DEBT_CATEGORY_IDS.RETURN_TO_ME,
      type: 'income',
      date: at(T0, 7200),
      createdAt: at(T0, 7200),
    });
    await insertRecord('sardorExcessTooLate', {
      categoryId: 'other_income',
      type: 'income',
      date: at(T0, 7210),
      createdAt: at(T0, 7210),
      description: 'Переплата по долгу: Sardor',
    });
    // Человек не указан: пара находится по названию долга.
    await insertRecord('rustamReturn', {
      debtId: rustam,
      categoryId: DEBT_CATEGORY_IDS.RETURN_TO_ME,
      type: 'income',
      date: at(T0, 10800),
      createdAt: at(T0, 10800),
    });
    await insertRecord('rustamExcess', {
      categoryId: 'other_income',
      type: 'income',
      date: at(T0, 10801),
      createdAt: at(T0, 10801),
      description: 'Переплата по долгу: Rustam',
    });

    // Записи, которые связываться не должны.
    await insertRecord('karimCreation', {
      id: creationId,
      debtId: karim,
      categoryId: DEBT_CATEGORY_IDS.GIVEN,
      type: 'expense',
      date: T0,
      createdAt: T0,
    });
    await insertRecord('karimSource', {
      id: sourceId,
      debtId: karim,
      categoryId: 'food',
      type: 'expense',
      date: T0,
      createdAt: T0,
    });
    await insertRecord('karimFee', {
      id: feeId,
      debtId: karim,
      categoryId: 'commission',
      type: 'expense',
      date: T0,
      createdAt: T0,
    });
    await insertRecord('plain', {
      categoryId: 'food',
      type: 'expense',
      date: T0,
      createdAt: T0,
    });
    // Уже связанная запись остаётся при своём расчёте.
    await insertRecord('presetReturn', {
      debtId: bob,
      categoryId: DEBT_CATEGORY_IDS.RETURN_TO_ME,
      type: 'income',
      date: at(dateBob, 86400),
      createdAt: at(dateBob, 86400),
      settlementId: PRESET_SETTLEMENT,
    });
  }

  beforeAll(async () => {
    ctx = await setupDebtTestContext();
    await seed();

    // Миграция глобальна по таблице: гоняем её в транзакции с откатом, чтобы тест
    // не связывал записи общей локальной БД.
    const migration = new BackfillTransactionSettlement1785900000001();
    const queryRunner = ctx.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await migration.up(queryRunner);
      afterFirst = await snapshot(queryRunner.manager);
      await migration.up(queryRunner);
      afterSecond = await snapshot(queryRunner.manager);
      await migration.down(queryRunner);
      afterDown = await snapshot(queryRunner.manager);
    } finally {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
    }
  }, 60_000);

  afterAll(async () => {
    await ctx.closeAndCleanup();
  });

  describe('платежи', () => {
    it('возврат и прощение одной даты по одному долгу делят расчёт', () => {
      expect(sid('aliReturn')).toEqual(expect.any(String));
      expect(sid('aliForgiven')).toBe(sid('aliReturn'));
    });

    it('платёж того же долга в другую дату — другой расчёт', () => {
      expect(sid('aliEarlierReturn')).toEqual(expect.any(String));
      expect(sid('aliEarlierReturn')).not.toBe(sid('aliReturn'));
    });

    it('нога работы и возврат одной даты делят расчёт', () => {
      expect(sid('bobWorkLeg')).toEqual(expect.any(String));
      expect(sid('bobReturn')).toBe(sid('bobWorkLeg'));
      expect(sid('bobReturn')).not.toBe(sid('aliReturn'));
    });

    it('запись выдачи, чека-источника и комиссии долга остаются без расчёта', () => {
      expect(sid('karimCreation')).toBeNull();
      expect(sid('karimSource')).toBeNull();
      expect(sid('karimFee')).toBeNull();
    });

    it('запись без долга остаётся без расчёта', () => {
      expect(sid('plain')).toBeNull();
    });

    it('уже связанную запись не трогает', () => {
      expect(sid('presetReturn')).toBe(PRESET_SETTLEMENT);
    });
  });

  describe('зачёты', () => {
    it('две записи одной отметки по двум долгам человека делят расчёт', () => {
      expect(sid('offsetGiven')).toEqual(expect.any(String));
      expect(sid('offsetTaken')).toBe(sid('offsetGiven'));
    });

    it('зачёт другой отметки времени — другой расчёт', () => {
      expect(sid('offsetLater')).toEqual(expect.any(String));
      expect(sid('offsetLater')).not.toBe(sid('offsetGiven'));
    });
  });

  describe('переплаты', () => {
    it('идёт к расчёту последнего возврата того же человека в окне 5 с', () => {
      expect(sid('ali2Return')).toEqual(expect.any(String));
      expect(sid('aliExcess')).toBe(sid('ali2Return'));
      expect(sid('aliExcess')).not.toBe(sid('aliReturn'));
    });

    it('находит пару по названию долга, если человек не указан', () => {
      expect(sid('rustamReturn')).toEqual(expect.any(String));
      expect(sid('rustamExcess')).toBe(sid('rustamReturn'));
    });

    it('не связывает переплату с возвратом на другом счёте', () => {
      expect(sid('aliExcessOtherAccount')).toBeNull();
    });

    it('не связывает переплату позже чем через 5 с после возврата', () => {
      expect(sid('sardorReturn')).toEqual(expect.any(String));
      expect(sid('sardorExcessTooLate')).toBeNull();
    });
  });

  it('повторный up ничего не меняет', () => {
    expect(afterSecond).toEqual(afterFirst);
  });

  it('down снимает связку со всех записей', () => {
    expect(afterDown.size).toBe(afterFirst.size);
    for (const value of afterDown.values()) expect(value).toBeNull();
  });
});
