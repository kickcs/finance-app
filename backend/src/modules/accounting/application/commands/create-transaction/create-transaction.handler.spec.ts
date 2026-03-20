import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateTransactionHandler } from './create-transaction.handler';
import { CreateTransactionCommand } from './create-transaction.command';
import { TRANSACTION_REPOSITORY } from '../../../domain/repositories/transaction.repository.interface';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import { Account } from '../../../domain/aggregates/account';

describe('CreateTransactionHandler', () => {
  let handler: CreateTransactionHandler;

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

  const createMockAccount = (
    id: string,
    userId: string,
    balances: { currency: string; balance: number }[] = [],
  ) => {
    return Account.create(id, userId, `Account ${id}`, 'wallet', '#000', 'basic', 0, balances);
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateTransactionHandler,
        { provide: TRANSACTION_REPOSITORY, useValue: mockTransactionRepository },
        { provide: ACCOUNT_REPOSITORY, useValue: mockAccountRepository },
        { provide: DomainEventPublisher, useValue: mockEventPublisher },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    handler = module.get<CreateTransactionHandler>(CreateTransactionHandler);
    jest.clearAllMocks();
    mockDataSource.transaction.mockImplementation((cb: () => Promise<void>) => cb());
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);
    mockAccountRepository.save.mockImplementation((a) => Promise.resolve(a));
    mockTransactionRepository.save.mockImplementation((t) => Promise.resolve(t));
  });

  describe('income transaction', () => {
    it('should create income and credit account', async () => {
      const account = createMockAccount('acc-1', 'user-1', [{ currency: 'USD', balance: 1000 }]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      const command = new CreateTransactionCommand(
        'user-1',
        'acc-1',
        'cat-salary',
        5000,
        'USD',
        'income',
        now,
        'Salary',
      );

      const result = await handler.execute(command);

      expect(result.type).toBe('income');
      expect(result.amount).toBe(5000);
      expect(result.currency).toBe('USD');
      expect(account.getTotalBalance('USD')).toBe(6000);
      expect(mockTransactionRepository.save).toHaveBeenCalledTimes(1);
      expect(mockAccountRepository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('expense transaction', () => {
    it('should create expense and debit account', async () => {
      const account = createMockAccount('acc-1', 'user-1', [{ currency: 'USD', balance: 1000 }]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      const command = new CreateTransactionCommand(
        'user-1',
        'acc-1',
        'cat-food',
        50,
        'USD',
        'expense',
        now,
        'Lunch',
      );

      const result = await handler.execute(command);

      expect(result.type).toBe('expense');
      expect(result.amount).toBe(50);
      expect(account.getTotalBalance('USD')).toBe(950);
    });
  });

  describe('transfer transaction', () => {
    it('should transfer between accounts (same currency)', async () => {
      const fromAccount = createMockAccount('acc-from', 'user-1', [
        { currency: 'USD', balance: 1000 },
      ]);
      const toAccount = createMockAccount('acc-to', 'user-1', [{ currency: 'USD', balance: 500 }]);

      mockAccountRepository.findByIdWithBalances
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);

      const command = new CreateTransactionCommand(
        'user-1',
        'acc-from',
        'transfer',
        300,
        'USD',
        'transfer',
        now,
        undefined,
        false,
        'acc-to',
        300,
        'USD',
      );

      const result = await handler.execute(command);

      expect(result.type).toBe('transfer');
      expect(result.toAccountId).toBe('acc-to');
      expect(fromAccount.getTotalBalance('USD')).toBe(700);
      expect(toAccount.getTotalBalance('USD')).toBe(800);
    });

    it('should handle cross-currency transfer', async () => {
      const fromAccount = createMockAccount('acc-usd', 'user-1', [
        { currency: 'USD', balance: 1000 },
      ]);
      const toAccount = createMockAccount('acc-eur', 'user-1', [{ currency: 'EUR', balance: 500 }]);

      mockAccountRepository.findByIdWithBalances
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);

      const command = new CreateTransactionCommand(
        'user-1',
        'acc-usd',
        'transfer',
        100,
        'USD',
        'transfer',
        now,
        undefined,
        false,
        'acc-eur',
        92,
        'EUR',
      );

      const result = await handler.execute(command);

      expect(fromAccount.getTotalBalance('USD')).toBe(900);
      expect(toAccount.getTotalBalance('EUR')).toBe(592);
      expect(result.toAmount).toBe(92);
      expect(result.toCurrency).toBe('EUR');
    });

    it('should throw if toAccountId is missing for transfer', async () => {
      const account = createMockAccount('acc-1', 'user-1', [{ currency: 'USD', balance: 1000 }]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      const command = new CreateTransactionCommand(
        'user-1',
        'acc-1',
        'transfer',
        100,
        'USD',
        'transfer',
        now,
      );

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    });

    it('should throw if destination account not found', async () => {
      const account = createMockAccount('acc-1', 'user-1', [{ currency: 'USD', balance: 1000 }]);
      mockAccountRepository.findByIdWithBalances
        .mockResolvedValueOnce(account)
        .mockResolvedValueOnce(null);

      const command = new CreateTransactionCommand(
        'user-1',
        'acc-1',
        'transfer',
        100,
        'USD',
        'transfer',
        now,
        undefined,
        false,
        'acc-nonexistent',
      );

      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should throw if destination account belongs to different user', async () => {
      const fromAccount = createMockAccount('acc-1', 'user-1', [
        { currency: 'USD', balance: 1000 },
      ]);
      const toAccount = createMockAccount('acc-2', 'user-2', [{ currency: 'USD', balance: 500 }]);

      mockAccountRepository.findByIdWithBalances
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);

      const command = new CreateTransactionCommand(
        'user-1',
        'acc-1',
        'transfer',
        100,
        'USD',
        'transfer',
        now,
        undefined,
        false,
        'acc-2',
      );

      await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
    });

    it('should create commission transaction when feeAmount is provided', async () => {
      const fromAccount = createMockAccount('acc-from', 'user-1', [
        { currency: 'USD', balance: 1000 },
      ]);
      const toAccount = createMockAccount('acc-to', 'user-1', [{ currency: 'USD', balance: 500 }]);

      mockAccountRepository.findByIdWithBalances
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);

      const command = new CreateTransactionCommand(
        'user-1',
        'acc-from',
        'transfer',
        300,
        'USD',
        'transfer',
        now,
        undefined,
        false,
        'acc-to',
        300,
        'USD',
        undefined,
        10,
      );

      await handler.execute(command);

      // 300 transfer + 10 fee debited from source
      expect(fromAccount.getTotalBalance('USD')).toBe(690);
      expect(toAccount.getTotalBalance('USD')).toBe(800);
      // Two transactions saved: transfer + commission
      expect(mockTransactionRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should default toAmount/toCurrency to from values if not specified', async () => {
      const fromAccount = createMockAccount('acc-1', 'user-1', [
        { currency: 'USD', balance: 1000 },
      ]);
      const toAccount = createMockAccount('acc-2', 'user-1', [{ currency: 'USD', balance: 500 }]);

      mockAccountRepository.findByIdWithBalances
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);

      // No toAmount or toCurrency provided
      const command = new CreateTransactionCommand(
        'user-1',
        'acc-1',
        'transfer',
        200,
        'USD',
        'transfer',
        now,
        undefined,
        false,
        'acc-2',
      );

      const result = await handler.execute(command);

      expect(result.toAmount).toBe(200);
      expect(result.toCurrency).toBe('USD');
    });
  });

  describe('validation', () => {
    it('should throw NotFoundException if source account not found', async () => {
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(null);

      const command = new CreateTransactionCommand(
        'user-1',
        'acc-nonexistent',
        'cat-1',
        100,
        'USD',
        'expense',
        now,
      );

      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if account belongs to different user', async () => {
      const account = createMockAccount('acc-1', 'user-2', [{ currency: 'USD', balance: 1000 }]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      const command = new CreateTransactionCommand(
        'user-1',
        'acc-1',
        'cat-1',
        100,
        'USD',
        'expense',
        now,
      );

      await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('debt-related transactions', () => {
    it('should create a debt-related income transaction', async () => {
      const account = createMockAccount('acc-1', 'user-1', [{ currency: 'USD', balance: 0 }]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      const command = new CreateTransactionCommand(
        'user-1',
        'acc-1',
        'cat-debt',
        500,
        'USD',
        'income',
        now,
        'Debt repayment',
        true,
        undefined,
        undefined,
        undefined,
        'debt-1',
      );

      const result = await handler.execute(command);

      expect(result.isDebtRelated).toBe(true);
      expect(result.debtId).toBe('debt-1');
    });
  });
});
