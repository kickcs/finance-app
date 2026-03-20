import { Test, type TestingModule } from '@nestjs/testing';
import { CreateDebtHandler } from './create-debt.handler';
import { CreateDebtCommand } from './create-debt.command';
import { DEBT_REPOSITORY } from '../../../domain/repositories';
import { DomainEventPublisher } from '../../../../../shared';

describe('CreateDebtHandler', () => {
  let handler: CreateDebtHandler;
  const mockRepository = {
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateDebtHandler,
        { provide: DEBT_REPOSITORY, useValue: mockRepository },
        { provide: DomainEventPublisher, useValue: mockEventPublisher },
      ],
    }).compile();

    handler = module.get<CreateDebtHandler>(CreateDebtHandler);
    jest.clearAllMocks();
  });

  it('should create a basic debt and return response', async () => {
    mockRepository.save.mockImplementation((debt) => Promise.resolve(debt));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new CreateDebtCommand(
      'user-1',
      'Car Loan',
      5000,
      5000,
      'given',
      'USD',
      'John',
      'acc-1',
    );

    const result = await handler.execute(command);

    expect(result).toBeDefined();
    expect(result.userId).toBe('user-1');
    expect(result.name).toBe('Car Loan');
    expect(result.totalAmount).toBe(5000);
    expect(result.remainingAmount).toBe(5000);
    expect(result.debtType).toBe('given');
    expect(result.currency).toBe('USD');
    expect(result.personName).toBe('John');
    expect(result.accountId).toBe('acc-1');
    expect(result.isClosed).toBe(false);
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    expect(mockEventPublisher.publishEvents).toHaveBeenCalledTimes(1);
  });

  it('should create a debt with different remaining amount', async () => {
    mockRepository.save.mockImplementation((debt) => Promise.resolve(debt));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new CreateDebtCommand('user-1', 'Partial Debt', 1000, 600, 'taken', 'EUR');

    const result = await handler.execute(command);

    expect(result.totalAmount).toBe(1000);
    expect(result.remainingAmount).toBe(600);
    expect(result.debtType).toBe('taken');
    expect(result.currency).toBe('EUR');
  });

  it('should set transactionId when provided', async () => {
    mockRepository.save.mockImplementation((debt) => Promise.resolve(debt));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new CreateDebtCommand(
      'user-1',
      'Debt With Tx',
      500,
      500,
      'given',
      'USD',
      undefined,
      undefined,
      undefined,
      undefined,
      'tx-123',
    );

    const result = await handler.execute(command);

    expect(result.transactionId).toBe('tx-123');
  });

  it('should set sourceTransactionId when provided', async () => {
    mockRepository.save.mockImplementation((debt) => Promise.resolve(debt));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new CreateDebtCommand(
      'user-1',
      'Debt With Source',
      500,
      500,
      'given',
      'USD',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'source-tx-1',
    );

    const result = await handler.execute(command);

    expect(result.sourceTransactionId).toBe('source-tx-1');
  });

  it('should set isPrivate when provided', async () => {
    mockRepository.save.mockImplementation((debt) => Promise.resolve(debt));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new CreateDebtCommand(
      'user-1',
      'Private Debt',
      500,
      500,
      'given',
      'USD',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    );

    const result = await handler.execute(command);

    expect(result.isPrivate).toBe(true);
  });

  it('should default currency to USD when not provided', async () => {
    mockRepository.save.mockImplementation((debt) => Promise.resolve(debt));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const command = new CreateDebtCommand('user-1', 'Default Currency', 100, 100, 'taken');

    const result = await handler.execute(command);

    expect(result.currency).toBe('USD');
  });

  it('should create debt with monthly payment and next payment date', async () => {
    mockRepository.save.mockImplementation((debt) => Promise.resolve(debt));
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);

    const nextPaymentDate = new Date('2025-03-01');
    const command = new CreateDebtCommand(
      'user-1',
      'Monthly Debt',
      10000,
      10000,
      'taken',
      'USD',
      'Bank',
      'acc-1',
      500,
      nextPaymentDate,
    );

    const result = await handler.execute(command);

    expect(result.monthlyPayment).toBe(500);
    expect(result.nextPaymentDate).toBe(nextPaymentDate.toISOString());
  });
});
