import { Test, type TestingModule } from '@nestjs/testing';
import { CreateAccountHandler } from './create-account.handler';
import { CreateAccountCommand } from './create-account.command';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';

describe('CreateAccountHandler', () => {
  let handler: CreateAccountHandler;
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateAccountHandler,
        { provide: ACCOUNT_REPOSITORY, useValue: mockAccountRepository },
        { provide: DomainEventPublisher, useValue: mockEventPublisher },
      ],
    }).compile();

    handler = module.get<CreateAccountHandler>(CreateAccountHandler);
    jest.clearAllMocks();
  });

  it('should create a basic account and return response', async () => {
    mockAccountRepository.save.mockImplementation((account) => Promise.resolve(account));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new CreateAccountCommand(
      'user-1',
      'My Wallet',
      'wallet',
      '#FF0000',
      'basic',
      0,
      [{ currency: 'USD', balance: 1000 }],
    );

    const result = await handler.execute(command);

    expect(result.userId).toBe('user-1');
    expect(result.name).toBe('My Wallet');
    expect(result.icon).toBe('wallet');
    expect(result.color).toBe('#FF0000');
    expect(result.type).toBe('basic');
    expect(result.balances).toHaveLength(1);
    expect(result.balances[0].currency).toBe('USD');
    expect(result.balances[0].balance).toBe(1000);
    expect(mockAccountRepository.save).toHaveBeenCalledTimes(1);
    expect(mockEventPublisher.publishEvents).toHaveBeenCalledTimes(1);
  });

  it('should create account with multiple balances', async () => {
    mockAccountRepository.save.mockImplementation((account) => Promise.resolve(account));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new CreateAccountCommand('user-1', 'Multi', 'bank', '#000', 'basic', 0, [
      { currency: 'USD', balance: 1000 },
      { currency: 'EUR', balance: 500 },
    ]);

    const result = await handler.execute(command);

    expect(result.balances).toHaveLength(2);
    expect(result.balances.map((b) => b.currency)).toContain('USD');
    expect(result.balances.map((b) => b.currency)).toContain('EUR');
  });

  it('should create account with no initial balances', async () => {
    mockAccountRepository.save.mockImplementation((account) => Promise.resolve(account));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new CreateAccountCommand('user-1', 'Empty', 'wallet', '#000');

    const result = await handler.execute(command);

    expect(result.balances).toHaveLength(0);
  });

  it('should create account with type-specific fields', async () => {
    mockAccountRepository.save.mockImplementation((account) => Promise.resolve(account));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new CreateAccountCommand(
      'user-1',
      'Credit Card',
      'card',
      '#000',
      'credit_card',
      0,
      [],
      { creditLimit: 5000, gracePeriodDays: 30, billingDay: 15 },
    );

    const result = await handler.execute(command);

    expect(result.type).toBe('credit_card');
    expect(result.creditLimit).toBe(5000);
    expect(result.gracePeriodDays).toBe(30);
    expect(result.billingDay).toBe(15);
  });

  it('should publish domain events after save', async () => {
    mockAccountRepository.save.mockImplementation((account) => Promise.resolve(account));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new CreateAccountCommand('user-1', 'Test', 'wallet', '#000');

    await handler.execute(command);

    expect(mockEventPublisher.publishEvents).toHaveBeenCalledTimes(1);
    // Verify save was called before publishEvents
    const saveOrder = mockAccountRepository.save.mock.invocationCallOrder[0];
    const publishOrder = mockEventPublisher.publishEvents.mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(publishOrder);
  });
});
