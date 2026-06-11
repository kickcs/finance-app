import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DeleteAccountHandler } from './delete-account.handler';
import { DeleteAccountCommand } from './delete-account.command';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository.interface';
import { TRANSACTION_REPOSITORY } from '../../../domain/repositories/transaction.repository.interface';
import { ACCOUNT_BALANCE_REPOSITORY } from '../../../domain/repositories/account-balance.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import { Account } from '../../../domain/aggregates/account';

describe('DeleteAccountHandler', () => {
  let handler: DeleteAccountHandler;

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

  const mockAccountBalanceRepository = {
    findByAccountId: jest.fn(),
    findByAccountIds: jest.fn(),
    findByAccountIdAndCurrency: jest.fn(),
    upsert: jest.fn(),
    createMany: jest.fn(),
    updateByDelta: jest.fn(),
    delete: jest.fn(),
    deleteByAccountId: jest.fn(),
  };

  const mockEventPublisher = {
    publishEvents: jest.fn(),
    publishEventsFromMultiple: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: () => Promise<void>) => cb()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteAccountHandler,
        { provide: ACCOUNT_REPOSITORY, useValue: mockAccountRepository },
        { provide: TRANSACTION_REPOSITORY, useValue: mockTransactionRepository },
        { provide: ACCOUNT_BALANCE_REPOSITORY, useValue: mockAccountBalanceRepository },
        { provide: DomainEventPublisher, useValue: mockEventPublisher },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    handler = module.get<DeleteAccountHandler>(DeleteAccountHandler);
    jest.clearAllMocks();
    mockDataSource.transaction.mockImplementation((cb: () => Promise<void>) => cb());
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);
    mockTransactionRepository.deleteByAccountId.mockResolvedValue(undefined);
    mockAccountBalanceRepository.deleteByAccountId.mockResolvedValue(undefined);
    mockAccountRepository.delete.mockResolvedValue(undefined);
  });

  it('should delete account with all related data', async () => {
    const account = Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000');
    mockAccountRepository.findById.mockResolvedValue(account);

    await handler.execute(new DeleteAccountCommand('acc-1', 'user-1'));

    expect(mockTransactionRepository.deleteByAccountId).toHaveBeenCalledWith('acc-1', undefined);
    expect(mockAccountBalanceRepository.deleteByAccountId).toHaveBeenCalledWith('acc-1', undefined);
    expect(mockAccountRepository.delete).toHaveBeenCalledWith('acc-1', undefined);
    expect(mockEventPublisher.publishEvents).toHaveBeenCalledTimes(1);
  });

  it('should delete related data in correct order within transaction', async () => {
    const account = Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000');
    mockAccountRepository.findById.mockResolvedValue(account);

    const callOrder: string[] = [];
    mockTransactionRepository.deleteByAccountId.mockImplementation(() => {
      callOrder.push('deleteTransactions');
      return Promise.resolve();
    });
    mockAccountBalanceRepository.deleteByAccountId.mockImplementation(() => {
      callOrder.push('deleteBalances');
      return Promise.resolve();
    });
    mockAccountRepository.delete.mockImplementation(() => {
      callOrder.push('deleteAccount');
      return Promise.resolve();
    });

    await handler.execute(new DeleteAccountCommand('acc-1', 'user-1'));

    expect(callOrder).toEqual(['deleteTransactions', 'deleteBalances', 'deleteAccount']);
  });

  it('should throw NotFoundException if account not found', async () => {
    mockAccountRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new DeleteAccountCommand('acc-nonexistent', 'user-1')),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if account belongs to different user', async () => {
    const account = Account.create('acc-1', 'user-2', 'Test', 'wallet', '#000');
    mockAccountRepository.findById.mockResolvedValue(account);

    await expect(handler.execute(new DeleteAccountCommand('acc-1', 'user-1'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should raise AccountDeletedEvent', async () => {
    const account = Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000');
    mockAccountRepository.findById.mockResolvedValue(account);

    await handler.execute(new DeleteAccountCommand('acc-1', 'user-1'));

    expect(mockEventPublisher.publishEvents).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'acc-1' }),
    );
  });
});
