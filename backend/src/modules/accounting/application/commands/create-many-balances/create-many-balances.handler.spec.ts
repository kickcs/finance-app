import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateManyBalancesHandler } from './create-many-balances.handler';
import { CreateManyBalancesCommand } from './create-many-balances.command';
import { ACCOUNT_BALANCE_REPOSITORY } from '../../../domain/repositories/account-balance.repository.interface';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository.interface';

describe('CreateManyBalancesHandler', () => {
  let handler: CreateManyBalancesHandler;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateManyBalancesHandler,
        { provide: ACCOUNT_BALANCE_REPOSITORY, useValue: mockAccountBalanceRepository },
        { provide: ACCOUNT_REPOSITORY, useValue: mockAccountRepository },
      ],
    }).compile();

    handler = module.get<CreateManyBalancesHandler>(CreateManyBalancesHandler);
    jest.clearAllMocks();
  });

  it('should create multiple balances and return response', async () => {
    mockAccountRepository.existsForUser.mockResolvedValue(true);

    const now = new Date();
    mockAccountBalanceRepository.createMany.mockResolvedValue([
      { id: 'bal-1', accountId: 'acc-1', currency: 'EUR', balance: 500, createdAt: now },
      { id: 'bal-2', accountId: 'acc-1', currency: 'GBP', balance: 300, createdAt: now },
    ]);

    const command = new CreateManyBalancesCommand(
      'acc-1',
      [
        { currency: 'EUR', balance: 500 },
        { currency: 'GBP', balance: 300 },
      ],
      'user-1',
    );

    const result = await handler.execute(command);

    expect(result).toHaveLength(2);
    expect(result[0].currency).toBe('EUR');
    expect(result[0].balance).toBe(500);
    expect(result[1].currency).toBe('GBP');
    expect(mockAccountBalanceRepository.createMany).toHaveBeenCalledWith('acc-1', [
      { currency: 'EUR', balance: 500 },
      { currency: 'GBP', balance: 300 },
    ]);
  });

  it('should throw NotFoundException if account does not exist', async () => {
    mockAccountRepository.existsForUser.mockResolvedValue(false);
    mockAccountRepository.exists.mockResolvedValue(false);

    const command = new CreateManyBalancesCommand(
      'acc-nonexistent',
      [{ currency: 'EUR', balance: 100 }],
      'user-1',
    );

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if account belongs to different user', async () => {
    mockAccountRepository.existsForUser.mockResolvedValue(false);
    mockAccountRepository.exists.mockResolvedValue(true);

    const command = new CreateManyBalancesCommand(
      'acc-1',
      [{ currency: 'EUR', balance: 100 }],
      'user-wrong',
    );

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
  });
});
