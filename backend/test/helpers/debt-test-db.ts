import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { DataSource, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { AppModule } from '../../src/app.module';
import { TransactionOrmEntity } from '../../src/modules/accounting/infrastructure/persistence/typeorm/transaction.orm-entity';
import { AccountOrmEntity } from '../../src/modules/accounting/infrastructure/persistence/typeorm/account.orm-entity';
import { AccountBalanceOrmEntity } from '../../src/modules/accounting/infrastructure/persistence/typeorm/account-balance.orm-entity';
import { DebtOrmEntity } from '../../src/modules/debt/infrastructure/persistence/typeorm/debt.orm-entity';
import { ProfileOrmEntity } from '../../src/modules/identity/infrastructure/persistence/typeorm';
import { CreateTransactionCommand } from '../../src/modules/accounting/application/commands/create-transaction/create-transaction.command';
import { CreateDebtCommand } from '../../src/modules/debt/application/commands/create-debt/create-debt.command';
import type { DebtResponseDto } from '../../src/modules/debt/application/mappers/debt-response.mapper';
import { DEBT_CATEGORY_IDS } from '../../src/modules/accounting/domain/constants/default-categories';

/** Стартовый баланс обоих счетов стенда, в валюте по умолчанию. */
export const INITIAL_BALANCE = 1_000_000;
export const DEFAULT_CURRENCY = 'UZS';

export interface DebtTestContext {
  app: INestApplication;
  dataSource: DataSource;
  commandBus: CommandBus;
  queryBus: QueryBus;
  userId: string;
  /** Основной счёт: на нём по умолчанию заводятся долги. */
  accountId: string;
  secondAccountId: string;
  closeAndCleanup: () => Promise<void>;
}

/** Запись истории с числами вместо строк драйвера (pg отдаёт decimal строкой). */
export interface DebtTestRecord {
  id: string;
  accountId: string;
  categoryId: string;
  amount: number;
  currency: string;
  type: string;
  description: string | null;
  date: Date;
  createdAt: Date;
  isDebtRelated: boolean;
  isInformational: boolean;
  debtId: string | null;
  settlementId: string | null;
}

export interface DebtTestState {
  id: string;
  totalAmount: number;
  remainingAmount: number;
  forgivenAmount: number;
  isClosed: boolean;
  closeTransactionId: string | null;
  transactionId: string | null;
  feeTransactionId: string | null;
  closedAt: Date | null;
}

async function insertAccount(
  dataSource: DataSource,
  userId: string,
  name: string,
  order: number,
): Promise<string> {
  const id = randomUUID();
  await dataSource.getRepository(AccountOrmEntity).insert({
    id,
    userId,
    name,
    balance: 0,
    currency: DEFAULT_CURRENCY,
    icon: 'wallet',
    color: '#000000',
    type: 'basic',
    order,
  } as Partial<AccountOrmEntity>);
  // Балансы лежат отдельной строкой на валюту, а не колонкой счёта.
  await dataSource.getRepository(AccountBalanceOrmEntity).insert({
    accountId: id,
    currency: DEFAULT_CURRENCY,
    balance: INITIAL_BALANCE,
  });
  return id;
}

/** Поднимает приложение, заводит пользователя и два счёта с балансом `INITIAL_BALANCE`. */
export async function setupDebtTestContext(): Promise<DebtTestContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  const dataSource = app.get(DataSource);
  const userId = randomUUID();

  await dataSource.getRepository(ProfileOrmEntity).insert({
    id: userId,
    email: `debt-test-${userId}@test.local`,
    name: 'Debt Test User',
  });

  const accountId = await insertAccount(dataSource, userId, 'Main Account', 0);
  const secondAccountId = await insertAccount(dataSource, userId, 'Second Account', 1);

  const closeAndCleanup = async () => {
    await dataSource.getRepository(TransactionOrmEntity).delete({ userId });
    await dataSource.getRepository(DebtOrmEntity).delete({ userId });
    await dataSource
      .getRepository(AccountBalanceOrmEntity)
      .delete({ accountId: In([accountId, secondAccountId]) });
    await dataSource.getRepository(AccountOrmEntity).delete({ userId });
    await dataSource.getRepository(ProfileOrmEntity).delete({ id: userId });
    await app.close();
  };

  return {
    app,
    dataSource,
    commandBus: app.get(CommandBus),
    queryBus: app.get(QueryBus),
    userId,
    accountId,
    secondAccountId,
    closeAndCleanup,
  };
}

export interface CreateDebtInput {
  debtType: 'given' | 'taken';
  amount: number;
  personName?: string;
  currency?: string;
  /** Счёт долга; по умолчанию основной. */
  accountId?: string;
  /** Дата долга и его записи выдачи: по ней долги выстраиваются «старые первыми». */
  createdAt?: Date;
  /** false — долг без движения денег и без записи выдачи (баланс счёта не трогается). */
  withMoney?: boolean;
  /** Комиссия за выдачу: сверху списывается отдельной записью со счёта долга. */
  feeAmount?: number;
}

/**
 * Заводит долг так же, как клиент: запись выдачи в долговой категории, сам долг
 * командой `CreateDebtCommand`, затем привязка записи к долгу (`debt_id`).
 * Возвращает id долга.
 */
export async function createDebt(ctx: DebtTestContext, input: CreateDebtInput): Promise<string> {
  const {
    debtType,
    amount,
    personName = 'Friend',
    currency = DEFAULT_CURRENCY,
    accountId = ctx.accountId,
    createdAt,
    withMoney = true,
    feeAmount,
  } = input;

  let transactionId: string | undefined;
  if (withMoney) {
    const record = await ctx.commandBus.execute<CreateTransactionCommand, { id: string }>(
      new CreateTransactionCommand(
        ctx.userId,
        accountId,
        debtType === 'given' ? DEBT_CATEGORY_IDS.GIVEN : DEBT_CATEGORY_IDS.TAKEN,
        amount,
        currency,
        debtType === 'given' ? 'expense' : 'income',
        createdAt ?? new Date(),
        `${debtType === 'given' ? 'Дал в долг' : 'Взял в долг'}: ${personName}`,
        true,
      ),
    );
    transactionId = record.id;
  }

  const debt = await ctx.commandBus.execute<CreateDebtCommand, DebtResponseDto>(
    new CreateDebtCommand(
      ctx.userId,
      `${debtType === 'given' ? 'Долг' : 'Долг перед'} ${personName}`,
      amount,
      amount,
      debtType,
      currency,
      personName,
      accountId,
      undefined,
      undefined,
      transactionId,
      undefined,
      createdAt,
      undefined,
      undefined,
      feeAmount,
    ),
  );

  if (transactionId) {
    await ctx.dataSource
      .getRepository(TransactionOrmEntity)
      .update({ id: transactionId }, { debtId: debt.id });
  }
  return debt.id;
}

/** Баланс счёта в валюте; нет строки баланса — 0. */
export async function balanceOf(
  ctx: DebtTestContext,
  accountId: string,
  currency: string = DEFAULT_CURRENCY,
): Promise<number> {
  const row = await ctx.dataSource
    .getRepository(AccountBalanceOrmEntity)
    .findOne({ where: { accountId, currency } });
  return row ? Number(row.balance) : 0;
}

/** TypeORM молча отбрасывает `where: { x: undefined }` и отдаёт всю таблицу — на общей БД это тысячи чужих строк. */
function requireId(value: string | null | undefined, name: string): void {
  if (!value) throw new Error(`${name} is required: an empty filter would match every row`);
}

function toRecord(row: TransactionOrmEntity): DebtTestRecord {
  return {
    id: row.id,
    accountId: row.accountId,
    categoryId: row.categoryId,
    amount: Number(row.amount),
    currency: row.currency,
    type: row.type,
    description: row.description,
    date: row.date,
    createdAt: row.createdAt,
    isDebtRelated: row.isDebtRelated,
    isInformational: row.isInformational,
    debtId: row.debtId,
    settlementId: row.settlementId,
  };
}

/**
 * Записи с этим `debt_id`, включая запись выдачи (если долг заводился с деньгами).
 * Порядок внутри одной транзакции БД не определён — ищите запись по категории.
 */
export async function recordsOf(ctx: DebtTestContext, debtId: string): Promise<DebtTestRecord[]> {
  requireId(debtId, 'debtId');
  const rows = await ctx.dataSource
    .getRepository(TransactionOrmEntity)
    .find({ where: { debtId }, order: { createdAt: 'ASC', id: 'ASC' } });
  return rows.map(toRecord);
}

/** Все записи расчёта, в том числе без `debt_id` (переплата). */
export async function recordsOfSettlement(
  ctx: DebtTestContext,
  settlementId: string,
): Promise<DebtTestRecord[]> {
  requireId(settlementId, 'settlementId');
  const rows = await ctx.dataSource
    .getRepository(TransactionOrmEntity)
    .find({ where: { settlementId }, order: { createdAt: 'ASC', id: 'ASC' } });
  return rows.map(toRecord);
}

/** Состояние долга прямо из БД. */
export async function debtOf(ctx: DebtTestContext, debtId: string): Promise<DebtTestState> {
  const row = await ctx.dataSource.getRepository(DebtOrmEntity).findOneOrFail({
    where: { id: debtId },
  });
  return {
    id: row.id,
    totalAmount: Number(row.totalAmount),
    remainingAmount: Number(row.remainingAmount),
    forgivenAmount: Number(row.forgivenAmount),
    isClosed: row.isClosed,
    closeTransactionId: row.closeTransactionId,
    transactionId: row.transactionId,
    feeTransactionId: row.feeTransactionId,
    closedAt: row.closedAt,
  };
}
