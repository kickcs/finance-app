import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { TransactionOrmEntity } from '../../src/modules/accounting/infrastructure/persistence/typeorm/transaction.orm-entity';
import { AccountOrmEntity } from '../../src/modules/accounting/infrastructure/persistence/typeorm/account.orm-entity';
import { DebtOrmEntity } from '../../src/modules/debt/infrastructure/persistence/typeorm/debt.orm-entity';
import { ProfileOrmEntity } from '../../src/modules/identity/infrastructure/persistence/typeorm';
import { TRANSACTION_REPOSITORY } from '../../src/modules/accounting/domain/repositories/transaction.repository.interface';
import type { ITransactionRepository } from '../../src/modules/accounting/domain/repositories/transaction.repository.interface';
import { DEBT_CATEGORY_IDS } from '../../src/modules/accounting/domain/constants/default-categories';
import { randomUUID } from 'crypto';

export interface AnalyticsTestContext {
  app: INestApplication;
  dataSource: DataSource;
  repository: ITransactionRepository;
  userId: string;
  accountId: string;
  closeAndCleanup: () => Promise<void>;
}

export async function setupAnalyticsTestContext(): Promise<AnalyticsTestContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  const dataSource = app.get(DataSource);
  const repository = app.get<ITransactionRepository>(TRANSACTION_REPOSITORY);

  const userId = randomUUID();
  const accountId = randomUUID();

  await dataSource.getRepository(ProfileOrmEntity).insert({
    id: userId,
    email: `analytics-test-${userId}@test.local`,
    name: 'Analytics Test User',
  });

  await dataSource.getRepository(AccountOrmEntity).insert({
    id: accountId,
    userId,
    name: 'Test Account',
    balance: 0,
    currency: 'UZS',
    icon: 'wallet',
    color: '#000000',
    type: 'basic',
    order: 0,
  } as Partial<AccountOrmEntity>);

  const closeAndCleanup = async () => {
    await dataSource.getRepository(TransactionOrmEntity).delete({ userId });
    await dataSource.getRepository(DebtOrmEntity).delete({ userId });
    await dataSource.getRepository(AccountOrmEntity).delete({ userId });
    await dataSource.getRepository(ProfileOrmEntity).delete({ id: userId });
    await app.close();
  };

  return { app, dataSource, repository, userId, accountId, closeAndCleanup };
}

export interface SeedExpenseInput {
  ctx: AnalyticsTestContext;
  amount: number;
  categoryId: string;
  date: Date;
  currency?: string;
  isDebtRelated?: boolean;
  debtId?: string | null;
  accountId?: string;
}

export async function seedExpense(input: SeedExpenseInput): Promise<string> {
  const { ctx, amount, categoryId, date, currency = 'UZS', isDebtRelated = false, debtId = null } = input;
  const id = randomUUID();
  await ctx.dataSource.getRepository(TransactionOrmEntity).insert({
    id,
    userId: ctx.userId,
    accountId: input.accountId ?? ctx.accountId,
    categoryId,
    amount,
    currency,
    type: 'expense',
    description: null,
    date,
    isDebtRelated,
    debtId,
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
  } as Partial<TransactionOrmEntity>);
  return id;
}

export interface SeedDebtInput {
  ctx: AnalyticsTestContext;
  totalAmount: number;
  remainingAmount: number;
  debtType: 'given' | 'taken';
  sourceTransactionId?: string | null;
  closeTransactionId?: string | null;
  isClosed?: boolean;
  currency?: string;
  accountId?: string;
  personName?: string;
}

export async function seedDebt(input: SeedDebtInput): Promise<string> {
  const id = randomUUID();
  await input.ctx.dataSource.getRepository(DebtOrmEntity).insert({
    id,
    userId: input.ctx.userId,
    name: 'Test debt',
    totalAmount: input.totalAmount,
    remainingAmount: input.remainingAmount,
    debtType: input.debtType,
    personName: input.personName ?? 'Friend',
    accountId: input.accountId ?? input.ctx.accountId,
    transactionId: null,
    closeTransactionId: input.closeTransactionId ?? null,
    sourceTransactionId: input.sourceTransactionId ?? null,
    isClosed: input.isClosed ?? false,
    currency: input.currency ?? 'UZS',
    description: null,
    forgivenAmount: 0,
    isPrivate: false,
  } as Partial<DebtOrmEntity>);
  return id;
}

export interface SeedDebtReturnInput {
  ctx: AnalyticsTestContext;
  amount: number;
  date: Date;
  debtId: string;
  direction: 'to_me' | 'from_me';
  currency?: string;
  accountId?: string;
}

export async function seedDebtReturn(input: SeedDebtReturnInput): Promise<string> {
  const categoryId =
    input.direction === 'to_me'
      ? DEBT_CATEGORY_IDS.RETURN_TO_ME
      : DEBT_CATEGORY_IDS.RETURN_FROM_ME;
  return seedExpense({
    ctx: input.ctx,
    amount: input.amount,
    categoryId,
    date: input.date,
    currency: input.currency,
    isDebtRelated: true,
    debtId: input.debtId,
    accountId: input.accountId,
  });
}
