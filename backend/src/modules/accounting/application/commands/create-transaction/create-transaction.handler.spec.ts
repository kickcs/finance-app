import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { CreateTransactionHandler } from './create-transaction.handler';
import { CreateTransactionCommand } from './create-transaction.command';
import { TRANSACTION_REPOSITORY } from '../../../domain/repositories/transaction.repository.interface';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import { Account } from '../../../domain/aggregates/account';
import { type Transaction } from '../../../domain/aggregates/transaction';

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
    findPaymentSiblings: jest.fn(),
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

    it('should create a commission transaction when feeAmount is provided', async () => {
      const account = createMockAccount('acc-1', 'user-1', [
        { currency: 'UZS', balance: 2_000_000 },
      ]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      const command = new CreateTransactionCommand(
        'user-1',
        'acc-1',
        'debt_given',
        1_000_000,
        'UZS',
        'expense',
        now,
        'Дал в долг: Азиз',
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        5_000,
      );

      await handler.execute(command);

      // Two transactions saved: the expense itself + commission
      expect(mockTransactionRepository.save).toHaveBeenCalledTimes(2);
      const savedCalls = mockTransactionRepository.save.mock.calls as [Transaction][];
      const savedFee = savedCalls[1][0];
      expect(savedFee.categoryId).toBe('commission');
      expect(savedFee.amountValue).toBe(5_000);
      expect(savedFee.typeValue).toBe('expense');
      expect(savedFee.isDebtRelated).toBe(false);

      // 2 000 000 − 1 000 000 expense − 5 000 fee
      expect(account.getTotalBalance('UZS')).toBe(995_000);
    });

    it('should reject a fee on income transactions', async () => {
      const account = createMockAccount('acc-1', 'user-1', [{ currency: 'UZS', balance: 1_000 }]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      const command = new CreateTransactionCommand(
        'user-1',
        'acc-1',
        'salary',
        1_000,
        'UZS',
        'income',
        now,
        undefined,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        500,
      );

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
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

  // Две записи, созданные одним вызовом на один счёт (нога отработки и возврат
  // долга, платёж и переплата), живут в одной транзакции БД. Прочитав счёт
  // мимо неё, вторая увидела бы баланс до первой и затёрла бы её сохранение.
  describe('чужая транзакция', () => {
    it('читает счёт менеджером переданной транзакции', async () => {
      const account = createMockAccount('acc-1', 'user-1', [{ currency: 'USD', balance: 1000 }]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);
      const manager = { getRepository: jest.fn() } as unknown as EntityManager;

      const command = new CreateTransactionCommand(
        'user-1',
        'acc-1',
        'cat-1',
        100,
        'USD',
        'expense',
        now,
        'Test',
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        manager,
      );

      await handler.execute(command);

      expect(mockAccountRepository.findByIdWithBalances).toHaveBeenCalledWith('acc-1', manager);
    });
  });

  // Одна операция, оплаченная с двух счетов: две обычные записи с общим
  // paymentGroupId, каждая двигает баланс своего счёта.
  describe('оплата с двух счетов', () => {
    let card: Account;
    let cash: Account;

    const splitCommand = (
      overrides: {
        type?: 'income' | 'expense' | 'transfer';
        categoryId?: string;
        isDebtRelated?: boolean;
        debtId?: string;
        feeAmount?: number;
        isInformational?: boolean;
        secondAccountId?: string;
      } = {},
    ) =>
      new CreateTransactionCommand(
        'user-1',
        'acc-card',
        overrides.categoryId ?? 'food',
        60_000,
        'UZS',
        overrides.type ?? 'expense',
        now,
        'Ужин',
        overrides.isDebtRelated ?? false,
        overrides.type === 'transfer' ? 'acc-cash' : undefined,
        undefined,
        undefined,
        overrides.debtId,
        overrides.feeAmount,
        undefined,
        overrides.isInformational ?? false,
        { accountId: overrides.secondAccountId ?? 'acc-cash', amount: 40_000 },
      );

    beforeEach(() => {
      card = createMockAccount('acc-card', 'user-1', [{ currency: 'UZS', balance: 500_000 }]);
      cash = createMockAccount('acc-cash', 'user-1', [{ currency: 'UZS', balance: 100_000 }]);
      const accounts: Record<string, Account> = { 'acc-card': card, 'acc-cash': cash };
      mockAccountRepository.findByIdWithBalances.mockImplementation((id: string) =>
        Promise.resolve(accounts[id] ?? null),
      );
    });

    it('расход: две записи с общей группой списывают оба счёта', async () => {
      const result = await handler.execute(splitCommand());

      expect(mockTransactionRepository.save).toHaveBeenCalledTimes(2);
      const [first, second] = (mockTransactionRepository.save.mock.calls as [Transaction][]).map(
        ([t]) => t,
      );
      expect(first.accountId).toBe('acc-card');
      expect(first.amountValue).toBe(60_000);
      expect(second.accountId).toBe('acc-cash');
      expect(second.amountValue).toBe(40_000);
      expect(second.typeValue).toBe('expense');
      expect(second.categoryId).toBe('food');
      expect(second.description).toBe('Ужин');
      expect(second.date).toBe(now);
      expect(second.currency).toBe('UZS');
      expect(first.paymentGroupId).toBeTruthy();
      expect(second.paymentGroupId).toBe(first.paymentGroupId);
      expect(second.id).not.toBe(first.id);

      expect(card.getTotalBalance('UZS')).toBe(440_000);
      expect(cash.getTotalBalance('UZS')).toBe(60_000);
      expect(mockAccountRepository.save).toHaveBeenCalledTimes(2);

      expect(result.id).toBe(first.id);
      expect(result.paymentGroupId).toBe(first.paymentGroupId);
      expect(result.paymentSibling).toEqual({
        id: second.id,
        accountId: 'acc-cash',
        amount: 40_000,
      });
    });

    it('доход: обе части зачисляются', async () => {
      await handler.execute(splitCommand({ type: 'income', categoryId: 'salary' }));

      expect(card.getTotalBalance('UZS')).toBe(560_000);
      expect(cash.getTotalBalance('UZS')).toBe(140_000);
    });

    it('обычная операция отдаётся без пары', async () => {
      const result = await handler.execute(
        new CreateTransactionCommand('user-1', 'acc-card', 'food', 100, 'UZS', 'expense', now),
      );

      expect(result.paymentGroupId).toBeNull();
      expect(result.paymentSibling).toBeNull();
    });

    it.each([
      ['перевод', { type: 'transfer' as const, categoryId: 'transfer' }],
      ['долговая запись', { isDebtRelated: true, categoryId: 'debt_given' }],
      ['запись с долгом', { debtId: 'debt-1' }],
      ['с комиссией', { feeAmount: 1_000 }],
      ['информационная', { isInformational: true, categoryId: 'debt_forgiven' }],
      ['тот же счёт', { secondAccountId: 'acc-card' }],
    ])('отклоняет: %s', async (_name, overrides) => {
      await expect(handler.execute(splitCommand(overrides))).rejects.toThrow(BadRequestException);
      expect(mockTransactionRepository.save).not.toHaveBeenCalled();
      expect(mockAccountRepository.save).not.toHaveBeenCalled();
    });

    it('второй счёт не найден — 404', async () => {
      await expect(
        handler.execute(splitCommand({ secondAccountId: 'acc-missing' })),
      ).rejects.toThrow(NotFoundException);
      expect(mockTransactionRepository.save).not.toHaveBeenCalled();
    });

    it('второй счёт чужой — 403', async () => {
      const foreign = createMockAccount('acc-foreign', 'user-2', [{ currency: 'UZS', balance: 0 }]);
      mockAccountRepository.findByIdWithBalances.mockImplementation((id: string) =>
        Promise.resolve(id === 'acc-card' ? card : foreign),
      );

      await expect(
        handler.execute(splitCommand({ secondAccountId: 'acc-foreign' })),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTransactionRepository.save).not.toHaveBeenCalled();
    });

    it('второй счёт читается менеджером чужой транзакции', async () => {
      const manager = { getRepository: jest.fn() } as unknown as EntityManager;
      const command = splitCommand();
      await handler.execute(
        new CreateTransactionCommand(
          command.userId,
          command.accountId,
          command.categoryId,
          command.amount,
          command.currency,
          command.type,
          command.date,
          command.description,
          false,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          manager,
          false,
          command.secondPart,
        ),
      );

      expect(mockAccountRepository.findByIdWithBalances).toHaveBeenCalledWith('acc-cash', manager);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });
  });

  // Записи одного расчёта по долгу несут общий settlementId; он пишется только при создании.
  describe('расчёт по долгу', () => {
    const buildCommand = (settlementId?: string) =>
      new CreateTransactionCommand(
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
        undefined,
        undefined,
        false,
        undefined,
        settlementId,
      );

    beforeEach(() => {
      const account = createMockAccount('acc-1', 'user-1', [{ currency: 'USD', balance: 0 }]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);
    });

    it('передаёт settlementId в созданную запись', async () => {
      const result = await handler.execute(buildCommand('set-1'));

      const [[saved]] = mockTransactionRepository.save.mock.calls as [Transaction][];
      expect(saved.settlementId).toBe('set-1');
      expect(result.settlementId).toBe('set-1');
    });

    it('без settlementId запись создаётся с null', async () => {
      const result = await handler.execute(buildCommand());

      const [[saved]] = mockTransactionRepository.save.mock.calls as [Transaction][];
      expect(saved.settlementId).toBeNull();
      expect(result.settlementId).toBeNull();
    });

    it('расход тоже получает settlementId', async () => {
      const command = new CreateTransactionCommand(
        'user-1',
        'acc-1',
        'cat-debt',
        500,
        'USD',
        'expense',
        now,
        undefined,
        true,
        undefined,
        undefined,
        undefined,
        'debt-1',
        undefined,
        undefined,
        false,
        undefined,
        'set-2',
      );

      await handler.execute(command);

      const [[saved]] = mockTransactionRepository.save.mock.calls as [Transaction][];
      expect(saved.settlementId).toBe('set-2');
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
