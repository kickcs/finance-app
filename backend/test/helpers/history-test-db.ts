import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { TransactionOrmEntity } from '../../src/modules/accounting/infrastructure/persistence/typeorm/transaction.orm-entity';
import { AccountOrmEntity } from '../../src/modules/accounting/infrastructure/persistence/typeorm/account.orm-entity';
import { AccountBalanceOrmEntity } from '../../src/modules/accounting/infrastructure/persistence/typeorm/account-balance.orm-entity';
import { DebtOrmEntity } from '../../src/modules/debt/infrastructure/persistence/typeorm/debt.orm-entity';
import { ProfileOrmEntity } from '../../src/modules/identity/infrastructure/persistence/typeorm';

export interface HistoryTestContext {
  app: INestApplication;
  dataSource: DataSource;
  userId: string;
  accountId: string;
  secondAccountId: string;
  /** GET от имени пользователя стенда. */
  get: (path: string) => request.Test;
  /** POST с JSON-телом от имени пользователя стенда. */
  post: (path: string, body: object) => request.Test;
  /** Токен доступа любого пользователя: так проверяется чужой доступ. */
  tokenFor: (userId: string) => string;
  /** Пользователи, созданные `createOtherUser`: убираются вместе со стендом. */
  extraUserIds: string[];
  closeAndCleanup: () => Promise<void>;
}

async function insertAccount(dataSource: DataSource, userId: string, order: number) {
  const id = randomUUID();
  await dataSource.getRepository(AccountOrmEntity).insert({
    id,
    userId,
    name: `Account ${order}`,
    balance: 0,
    currency: 'UZS',
    icon: 'wallet',
    color: '#000000',
    type: 'basic',
    order,
  } as Partial<AccountOrmEntity>);
  return id;
}

/**
 * Приложение с настоящей БД и настоящим JWT-гардом: запросы идут через контроллер, DTO и разбор
 * query-строки, как у клиента.
 */
export async function setupHistoryTestContext(timezone?: string): Promise<HistoryTestContext> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  await app.init();

  const dataSource = app.get(DataSource);
  const userId = randomUUID();
  const token = app.get(JwtService, { strict: false }).sign({ sub: userId });

  await dataSource.getRepository(ProfileOrmEntity).insert({
    id: userId,
    email: `history-test-${userId}@test.local`,
    name: 'History Test User',
    ...(timezone ? { timezone } : {}),
  });
  const accountId = await insertAccount(dataSource, userId, 0);
  const secondAccountId = await insertAccount(dataSource, userId, 1);
  const jwt = app.get(JwtService, { strict: false });
  const extraUserIds: string[] = [];

  return {
    app,
    dataSource,
    userId,
    accountId,
    secondAccountId,
    extraUserIds,
    tokenFor: (id) => jwt.sign({ sub: id }),
    get: (path) =>
      request(app.getHttpServer() as App)
        .get(path)
        .set('Authorization', `Bearer ${token}`),
    post: (path, body) =>
      request(app.getHttpServer() as App)
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    closeAndCleanup: async () => {
      for (const id of [userId, ...extraUserIds]) {
        await dataSource.getRepository(TransactionOrmEntity).delete({ userId: id });
        await dataSource.getRepository(DebtOrmEntity).delete({ userId: id });
        await dataSource.getRepository(AccountOrmEntity).delete({ userId: id });
        await dataSource.query('DELETE FROM categories WHERE user_id = $1', [id]);
        await dataSource.getRepository(ProfileOrmEntity).delete({ id });
      }
      await app.close();
    },
  };
}

/** Второй пользователь со своим счётом; его данные чужие для пользователя стенда. */
export async function createOtherUser(
  ctx: HistoryTestContext,
): Promise<{ userId: string; accountId: string }> {
  const userId = randomUUID();
  await ctx.dataSource.getRepository(ProfileOrmEntity).insert({
    id: userId,
    email: `history-other-${userId}@test.local`,
    name: 'History Other User',
  });
  ctx.extraUserIds.push(userId);
  return { userId, accountId: await insertAccount(ctx.dataSource, userId, 0) };
}

/** Остаток счёта в валюте напрямую в БД. */
export async function seedBalance(
  ctx: HistoryTestContext,
  accountId: string,
  currency: string,
  balance: number,
): Promise<void> {
  await ctx.dataSource
    .getRepository(AccountBalanceOrmEntity)
    .insert({ accountId, currency, balance } as Partial<AccountBalanceOrmEntity>);
}

/** Остаток счёта в валюте; нет строки — 0, как у приложения. */
export async function readBalance(
  ctx: HistoryTestContext,
  accountId: string,
  currency: string,
): Promise<number> {
  const row = await ctx.dataSource
    .getRepository(AccountBalanceOrmEntity)
    .findOne({ where: { accountId, currency } });
  return row ? Number(row.balance) : 0;
}

/** Ещё один счёт пользователя стенда. */
export async function seedAccount(ctx: HistoryTestContext, order = 2): Promise<string> {
  return insertAccount(ctx.dataSource, ctx.userId, order);
}

export interface SeedTransaction {
  accountId?: string;
  categoryId?: string;
  amount?: number;
  currency?: string;
  type?: string;
  description?: string | null;
  date?: Date;
  createdAt?: Date;
  isDebtRelated?: boolean;
  isInformational?: boolean;
  debtId?: string | null;
  toAccountId?: string | null;
  toAmount?: number | null;
  toCurrency?: string | null;
  paymentGroupId?: string | null;
  settlementId?: string | null;
}

/** Строка истории напрямую в БД: флаги задаются точно, без побочных действий команд. */
export async function seedTransaction(
  ctx: HistoryTestContext,
  over: SeedTransaction = {},
): Promise<string> {
  const id = randomUUID();
  await ctx.dataSource.getRepository(TransactionOrmEntity).insert({
    id,
    userId: ctx.userId,
    accountId: over.accountId ?? ctx.accountId,
    categoryId: over.categoryId ?? 'food',
    amount: over.amount ?? 100,
    currency: over.currency ?? 'UZS',
    type: over.type ?? 'expense',
    description: over.description ?? null,
    date: over.date ?? new Date('2026-10-15T12:00:00Z'),
    ...(over.createdAt ? { createdAt: over.createdAt } : {}),
    isDebtRelated: over.isDebtRelated ?? false,
    isInformational: over.isInformational ?? false,
    debtId: over.debtId ?? null,
    toAccountId: over.toAccountId ?? null,
    toAmount: over.toAmount ?? null,
    toCurrency: over.toCurrency ?? null,
    paymentGroupId: over.paymentGroupId ?? null,
    settlementId: over.settlementId ?? null,
  } as Partial<TransactionOrmEntity>);
  return id;
}

export interface SeedDebtLinks {
  transactionId?: string | null;
  sourceTransactionId?: string | null;
  feeTransactionId?: string | null;
  closeTransactionId?: string | null;
  isClosed?: boolean;
}

/** Долг со ссылками на строки истории; сумма и остаток не важны для предиката. */
export async function seedDebt(ctx: HistoryTestContext, links: SeedDebtLinks): Promise<string> {
  const id = randomUUID();
  await ctx.dataSource.getRepository(DebtOrmEntity).insert({
    id,
    userId: ctx.userId,
    name: 'Test debt',
    totalAmount: 1000,
    remainingAmount: links.isClosed ? 0 : 1000,
    debtType: 'given',
    personName: 'Friend',
    accountId: ctx.accountId,
    transactionId: links.transactionId ?? null,
    sourceTransactionId: links.sourceTransactionId ?? null,
    feeTransactionId: links.feeTransactionId ?? null,
    closeTransactionId: links.closeTransactionId ?? null,
    isClosed: links.isClosed ?? false,
    currency: 'UZS',
    description: null,
    forgivenAmount: 0,
    isPrivate: false,
  } as Partial<DebtOrmEntity>);
  return id;
}
