import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DeleteTransactionHandler } from './delete-transaction.handler';
import { DeleteTransactionCommand } from './delete-transaction.command';
import { TRANSACTION_REPOSITORY } from '../../../domain/repositories/transaction.repository.interface';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository.interface';
import { DEBT_REPOSITORY } from '../../../../debt/domain/repositories';
import { DomainEventPublisher } from '../../../../../shared';
import { Account } from '../../../domain/aggregates/account';
import { Transaction } from '../../../domain/aggregates/transaction';

describe('DeleteTransactionHandler', () => {
  let handler: DeleteTransactionHandler;

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

  const mockDebtRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByTransactionId: jest.fn(),
    hasOpenDebtsForTransaction: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };

  const mockEventPublisher = {
    publishEvents: jest.fn(),
    publishEventsFromMultiple: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: () => Promise<void>) => cb()),
    query: jest.fn(),
  };

  const now = new Date('2026-03-20T12:00:00Z');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteTransactionHandler,
        { provide: TRANSACTION_REPOSITORY, useValue: mockTransactionRepository },
        { provide: ACCOUNT_REPOSITORY, useValue: mockAccountRepository },
        { provide: DEBT_REPOSITORY, useValue: mockDebtRepository },
        { provide: DomainEventPublisher, useValue: mockEventPublisher },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    handler = module.get<DeleteTransactionHandler>(DeleteTransactionHandler);
    jest.clearAllMocks();
    mockDataSource.transaction.mockImplementation((cb: () => Promise<void>) => cb());
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);
    mockAccountRepository.save.mockImplementation((a) => Promise.resolve(a));
    mockTransactionRepository.delete.mockResolvedValue(undefined);
    mockDebtRepository.hasOpenDebtsForTransaction.mockResolvedValue(false);
    mockDataSource.query.mockResolvedValue([]);
  });

  // Отработка с категорией — пара записей на ноль по балансу: трата по
  // категории и возврат долга. В одиночку любая её нога оставит на счёте дыру.
  describe('отработка парой', () => {
    it('трату по категории, привязанную к долгу, по отдельности не удалить', async () => {
      const tx = Transaction.createExpense(
        'tx-work',
        'user-1',
        'acc-1',
        'repair',
        300,
        'USD',
        now,
        'Отработка долга: Тимур',
        false,
        'debt-1',
      );
      mockTransactionRepository.findById.mockResolvedValue(tx);

      await expect(
        handler.execute(new DeleteTransactionCommand('tx-work', 'user-1')),
      ).rejects.toThrow(BadRequestException);
      expect(mockTransactionRepository.delete).not.toHaveBeenCalled();
    });

    it('возврат с парной ногой тоже не удалить', async () => {
      const tx = Transaction.createIncome(
        'tx-return',
        'user-1',
        'acc-1',
        'debt_return_to_me',
        300,
        'USD',
        now,
        'Закрытие долга: Тимур',
        true,
        'debt-1',
      );
      mockTransactionRepository.findById.mockResolvedValue(tx);
      mockDataSource.query.mockResolvedValue([{ id: 'tx-work' }]);

      await expect(
        handler.execute(new DeleteTransactionCommand('tx-return', 'user-1')),
      ).rejects.toThrow(BadRequestException);
    });

    it('обычный возврат без пары удаляется как раньше', async () => {
      const tx = Transaction.createIncome(
        'tx-return',
        'user-1',
        'acc-1',
        'debt_return_to_me',
        300,
        'USD',
        now,
        'Закрытие долга: Тимур',
        true,
        'debt-1',
      );
      mockTransactionRepository.findById.mockResolvedValue(tx);
      const account = Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 1000 },
      ]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      await handler.execute(new DeleteTransactionCommand('tx-return', 'user-1'));

      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-return', undefined);
    });

    // Отмена закрытия снимает пару целиком — там проверка не мешает
    it('со стороны долга (skipDebtCheck) нога отработки удаляется', async () => {
      const tx = Transaction.createExpense(
        'tx-work',
        'user-1',
        'acc-1',
        'repair',
        300,
        'USD',
        now,
        'Отработка долга: Тимур',
        false,
        'debt-1',
      );
      mockTransactionRepository.findById.mockResolvedValue(tx);
      const account = Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 700 },
      ]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      await handler.execute(new DeleteTransactionCommand('tx-work', 'user-1', true));

      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-work', undefined);
      expect(account.getTotalBalance('USD')).toBe(1000);
    });
  });

  describe('delete expense', () => {
    it('should reverse expense (credit back) and delete', async () => {
      const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 300, 'USD', now);
      mockTransactionRepository.findById.mockResolvedValue(tx);

      const account = Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 700 },
      ]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'));

      // Balance should be reversed: 700 + 300 = 1000
      expect(account.getTotalBalance('USD')).toBe(1000);
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-1', undefined);
      expect(mockEventPublisher.publishEvents).toHaveBeenCalledTimes(2);
    });
  });

  describe('delete income', () => {
    it('should reverse income (debit) and delete', async () => {
      const tx = Transaction.createIncome('tx-1', 'user-1', 'acc-1', 'cat-1', 500, 'USD', now);
      mockTransactionRepository.findById.mockResolvedValue(tx);

      const account = Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 1500 },
      ]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'));

      // Balance should be reversed: 1500 - 500 = 1000
      expect(account.getTotalBalance('USD')).toBe(1000);
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-1', undefined);
    });
  });

  describe('delete transfer', () => {
    it('should reverse both accounts for transfer deletion', async () => {
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-from',
        'acc-to',
        'cat-t',
        300,
        'USD',
        300,
        'USD',
        now,
      );
      mockTransactionRepository.findById.mockResolvedValue(tx);

      const fromAccount = Account.create(
        'acc-from',
        'user-1',
        'From',
        'wallet',
        '#000',
        'basic',
        0,
        [{ currency: 'USD', balance: 700 }],
      );
      const toAccount = Account.create('acc-to', 'user-1', 'To', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 800 },
      ]);

      mockAccountRepository.findByIdWithBalances
        .mockResolvedValueOnce(fromAccount) // source account lookup
        .mockResolvedValueOnce(toAccount); // destination account lookup

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'));

      // From account: 700 + 300 = 1000 (credit back)
      expect(fromAccount.getTotalBalance('USD')).toBe(1000);
      // To account: 800 - 300 = 500 (debit)
      expect(toAccount.getTotalBalance('USD')).toBe(500);
      expect(mockAccountRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should throw if destination account not found for transfer deletion', async () => {
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-from',
        'acc-to',
        'cat-t',
        300,
        'USD',
        300,
        'USD',
        now,
      );
      mockTransactionRepository.findById.mockResolvedValue(tx);

      const fromAccount = Account.create(
        'acc-from',
        'user-1',
        'From',
        'wallet',
        '#000',
        'basic',
        0,
        [{ currency: 'USD', balance: 700 }],
      );
      mockAccountRepository.findByIdWithBalances
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(null);

      await expect(handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'))).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validation', () => {
    it('should throw NotFoundException if transaction not found', async () => {
      mockTransactionRepository.findById.mockResolvedValue(null);

      await expect(
        handler.execute(new DeleteTransactionCommand('tx-nonexistent', 'user-1')),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if transaction belongs to different user', async () => {
      const tx = Transaction.createExpense('tx-1', 'user-2', 'acc-1', 'cat-1', 100, 'USD', now);
      mockTransactionRepository.findById.mockResolvedValue(tx);

      await expect(handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if transaction has open debts', async () => {
      const tx = Transaction.createIncome('tx-1', 'user-1', 'acc-1', 'cat-1', 100, 'USD', now);
      mockTransactionRepository.findById.mockResolvedValue(tx);
      mockDebtRepository.hasOpenDebtsForTransaction.mockResolvedValue(true);

      await expect(handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should skip debt check if skipDebtCheck is true', async () => {
      const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 100, 'USD', now);
      mockTransactionRepository.findById.mockResolvedValue(tx);
      mockDebtRepository.hasOpenDebtsForTransaction.mockResolvedValue(true);

      const account = Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 0 },
      ]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1', true));

      // Should not throw, debt check was skipped
      expect(mockDebtRepository.hasOpenDebtsForTransaction).not.toHaveBeenCalled();
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-1', undefined);
    });
  });

  describe('edge cases', () => {
    it('should handle deletion when account no longer exists', async () => {
      const tx = Transaction.createExpense(
        'tx-1',
        'user-1',
        'acc-deleted',
        'cat-1',
        100,
        'USD',
        now,
      );
      mockTransactionRepository.findById.mockResolvedValue(tx);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(null);

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'));

      // Should still delete the transaction
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-1', undefined);
      // Should not try to save a null account
      expect(mockAccountRepository.save).not.toHaveBeenCalled();
    });
  });
});
