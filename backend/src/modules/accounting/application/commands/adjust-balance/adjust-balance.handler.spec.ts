import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AdjustBalanceHandler } from './adjust-balance.handler';
import { AdjustBalanceCommand } from './adjust-balance.command';
import { TRANSACTION_REPOSITORY } from '../../../domain/repositories/transaction.repository.interface';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import { Account } from '../../../domain/aggregates/account';

describe('AdjustBalanceHandler', () => {
  let handler: AdjustBalanceHandler;

  const mockTransactionRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByAccountId: jest.fn(),
    findByAccountIdWithIncoming: jest.fn(),
    findByDateRange: jest.fn(),
    save: jest.fn(),
    saveMany: jest.fn(),
    delete: jest.fn(),
    deleteByAccountId: jest.fn(),
    countByAccountId: jest.fn(),
    exists: jest.fn(),
    getPaginated: jest.fn(),
    searchPaginated: jest.fn(),
    getByAccountPaginated: jest.fn(),
    getMonthlyStats: jest.fn(),
    getAnalyticsStats: jest.fn(),
    getDailyStats: jest.fn(),
    getHashtags: jest.fn(),
  };

  const mockAccountRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByIdWithBalances: jest.fn(),
    findAllWithBalances: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsForUser: jest.fn(),
    updateOrder: jest.fn(),
  };

  const mockEventPublisher = {
    publishEvents: jest.fn(),
    publishEventsFromMultiple: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: () => Promise<void>) => cb()),
  };

  const now = new Date('2026-03-20T12:00:00Z');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdjustBalanceHandler,
        { provide: TRANSACTION_REPOSITORY, useValue: mockTransactionRepository },
        { provide: ACCOUNT_REPOSITORY, useValue: mockAccountRepository },
        { provide: DomainEventPublisher, useValue: mockEventPublisher },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    handler = module.get<AdjustBalanceHandler>(AdjustBalanceHandler);
    jest.clearAllMocks();
    mockDataSource.transaction.mockImplementation((cb: () => Promise<void>) => cb());
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);
    mockAccountRepository.save.mockImplementation((a) => Promise.resolve(a));
    mockTransactionRepository.save.mockImplementation((t) => Promise.resolve(t));
  });

  it('should create positive adjustment when target > current', async () => {
    const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
      { currency: 'USD', balance: 1000 },
    ]);
    mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

    const command = new AdjustBalanceCommand('user-1', 'acc-1', 1500, 'USD', now, 'Found cash');

    const result = await handler.execute(command);

    expect(result.type).toBe('adjustment');
    expect(result.amount).toBe(500);
    expect(result.isDebtRelated).toBe(false); // positive adjustment
    expect(account.getTotalBalance('USD')).toBe(1500);
  });

  it('should create negative adjustment when target < current', async () => {
    const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
      { currency: 'USD', balance: 1000 },
    ]);
    mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

    const command = new AdjustBalanceCommand('user-1', 'acc-1', 800, 'USD', now);

    const result = await handler.execute(command);

    expect(result.type).toBe('adjustment');
    expect(result.amount).toBe(200);
    expect(result.isDebtRelated).toBe(true); // negative adjustment
    expect(account.getTotalBalance('USD')).toBe(800);
  });

  it('should throw BadRequestException if balance is already correct', async () => {
    const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
      { currency: 'USD', balance: 1000 },
    ]);
    mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

    const command = new AdjustBalanceCommand('user-1', 'acc-1', 1000, 'USD', now);

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if difference is negligible (< 0.01)', async () => {
    const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
      { currency: 'USD', balance: 1000 },
    ]);
    mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

    const command = new AdjustBalanceCommand('user-1', 'acc-1', 1000.005, 'USD', now);

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if account not found', async () => {
    mockAccountRepository.findByIdWithBalances.mockResolvedValue(null);

    const command = new AdjustBalanceCommand('user-1', 'acc-nonexistent', 1000, 'USD', now);

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if account belongs to different user', async () => {
    const account = Account.create('acc-1', 'user-2', 'Wallet', 'wallet', '#000', 'basic', 0, [
      { currency: 'USD', balance: 1000 },
    ]);
    mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

    const command = new AdjustBalanceCommand('user-1', 'acc-1', 1500, 'USD', now);

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
  });

  it('should adjust to zero from positive balance', async () => {
    const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
      { currency: 'USD', balance: 500 },
    ]);
    mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

    const command = new AdjustBalanceCommand('user-1', 'acc-1', 0, 'USD', now);

    const result = await handler.execute(command);

    expect(result.amount).toBe(500);
    expect(result.isDebtRelated).toBe(true);
    expect(account.getTotalBalance('USD')).toBe(0);
  });

  it('should handle adjustment for currency with no existing balance', async () => {
    const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
      { currency: 'USD', balance: 1000 },
    ]);
    mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

    // Adjusting EUR when account only has USD — current EUR balance is 0
    const command = new AdjustBalanceCommand('user-1', 'acc-1', 200, 'EUR', now);

    const result = await handler.execute(command);

    expect(result.amount).toBe(200);
    expect(result.currency).toBe('EUR');
    expect(result.isDebtRelated).toBe(false);
  });
});
