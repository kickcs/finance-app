import { Test, type TestingModule } from '@nestjs/testing';
import { GetAccountsHandler } from './get-accounts.handler';
import { GetAccountsQuery } from './get-accounts.query';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository.interface';
import { Account } from '../../../domain/aggregates/account';

describe('GetAccountsHandler', () => {
  let handler: GetAccountsHandler;
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
        GetAccountsHandler,
        { provide: ACCOUNT_REPOSITORY, useValue: mockAccountRepository },
      ],
    }).compile();

    handler = module.get<GetAccountsHandler>(GetAccountsHandler);
    jest.clearAllMocks();
  });

  it('should return all accounts with balances for user', async () => {
    const accounts = [
      Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#FF0000', 'basic', 0, [
        { currency: 'USD', balance: 1000 },
      ]),
      Account.create('acc-2', 'user-1', 'Savings', 'bank', '#00FF00', 'savings', 1, [
        { currency: 'USD', balance: 5000 },
        { currency: 'EUR', balance: 2000 },
      ]),
    ];
    mockAccountRepository.findAllWithBalances.mockResolvedValue(accounts);

    const result = await handler.execute(new GetAccountsQuery('user-1'));

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Wallet');
    expect(result[0].balances).toHaveLength(1);
    expect(result[0].balances[0].currency).toBe('USD');
    expect(result[0].balances[0].balance).toBe(1000);
    expect(result[1].name).toBe('Savings');
    expect(result[1].balances).toHaveLength(2);
    expect(mockAccountRepository.findAllWithBalances).toHaveBeenCalledWith('user-1');
  });

  it('should return empty array if user has no accounts', async () => {
    mockAccountRepository.findAllWithBalances.mockResolvedValue([]);

    const result = await handler.execute(new GetAccountsQuery('user-1'));

    expect(result).toEqual([]);
  });

  it('should include type-specific fields in response', async () => {
    const account = Account.create(
      'acc-1',
      'user-1',
      'Credit',
      'card',
      '#000',
      'credit_card',
      0,
      [],
      { creditLimit: 5000, gracePeriodDays: 30, billingDay: 15 },
    );
    mockAccountRepository.findAllWithBalances.mockResolvedValue([account]);

    const result = await handler.execute(new GetAccountsQuery('user-1'));

    expect(result[0].creditLimit).toBe(5000);
    expect(result[0].gracePeriodDays).toBe(30);
    expect(result[0].billingDay).toBe(15);
  });
});
