import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { UpdateDebtHandler } from './update-debt.handler';
import { UpdateDebtCommand } from './update-debt.command';
import { DEBT_REPOSITORY } from '../../../domain/repositories';
import { Debt } from '../../../domain/aggregates/debt';

describe('UpdateDebtHandler', () => {
  let handler: UpdateDebtHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByTransactionId: jest.fn(),
    hasOpenDebtsForTransaction: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UpdateDebtHandler, { provide: DEBT_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<UpdateDebtHandler>(UpdateDebtHandler);
    jest.clearAllMocks();
  });

  function createTestDebt(overrides: Partial<{ userId: string; isClosed: boolean }> = {}) {
    const debt = Debt.create({
      id: 'debt-1',
      userId: overrides.userId ?? 'user-1',
      name: 'Test Debt',
      totalAmount: 1000,
      currency: 'USD',
      debtType: 'given',
      personName: 'John',
    });
    if (overrides.isClosed) {
      debt.close();
    }
    debt.clearDomainEvents();
    return debt;
  }

  it('should update debt name successfully', async () => {
    const debt = createTestDebt();
    mockRepository.findById.mockResolvedValue(debt);
    mockRepository.save.mockImplementation((d) => Promise.resolve(d));

    const command = new UpdateDebtCommand('debt-1', 'user-1', { name: 'Updated Name' });

    const result = await handler.execute(command);

    expect(result.name).toBe('Updated Name');
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should update debt remaining amount', async () => {
    const debt = createTestDebt();
    mockRepository.findById.mockResolvedValue(debt);
    mockRepository.save.mockImplementation((d) => Promise.resolve(d));

    const command = new UpdateDebtCommand('debt-1', 'user-1', { remainingAmount: 500 });

    const result = await handler.execute(command);

    expect(result.remainingAmount).toBe(500);
  });

  it('should close debt via update', async () => {
    const debt = createTestDebt();
    mockRepository.findById.mockResolvedValue(debt);
    mockRepository.save.mockImplementation((d) => Promise.resolve(d));

    const command = new UpdateDebtCommand('debt-1', 'user-1', { isClosed: true });

    const result = await handler.execute(command);

    expect(result.isClosed).toBe(true);
    expect(result.remainingAmount).toBe(0);
    expect(result.closedAt).toBeDefined();
  });

  it('should throw NotFoundException when debt does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    const command = new UpdateDebtCommand('non-existent', 'user-1', { name: 'New' });

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when user does not own the debt', async () => {
    const debt = createTestDebt({ userId: 'other-user' });
    mockRepository.findById.mockResolvedValue(debt);

    const command = new UpdateDebtCommand('debt-1', 'user-1', { name: 'Stolen' });

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ConflictException when trying to close an already closed debt', async () => {
    const debt = createTestDebt({ isClosed: true });
    mockRepository.findById.mockResolvedValue(debt);

    const command = new UpdateDebtCommand('debt-1', 'user-1', { isClosed: true });

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
  });

  it('should update description and isPrivate together', async () => {
    const debt = createTestDebt();
    mockRepository.findById.mockResolvedValue(debt);
    mockRepository.save.mockImplementation((d) => Promise.resolve(d));

    const command = new UpdateDebtCommand('debt-1', 'user-1', {
      description: 'Updated description',
      isPrivate: true,
    });

    const result = await handler.execute(command);

    expect(result.description).toBe('Updated description');
    expect(result.isPrivate).toBe(true);
  });

  it('should update forgivenAmount', async () => {
    const debt = createTestDebt();
    mockRepository.findById.mockResolvedValue(debt);
    mockRepository.save.mockImplementation((d) => Promise.resolve(d));

    const command = new UpdateDebtCommand('debt-1', 'user-1', { forgivenAmount: 200 });

    const result = await handler.execute(command);

    expect(result.forgivenAmount).toBe(200);
  });

  it('should reopen a closed debt', async () => {
    const debt = createTestDebt({ isClosed: true });
    mockRepository.findById.mockResolvedValue(debt);
    mockRepository.save.mockImplementation((d) => Promise.resolve(d));

    const command = new UpdateDebtCommand('debt-1', 'user-1', { isClosed: false });

    const result = await handler.execute(command);

    expect(result.isClosed).toBe(false);
    expect(result.closedAt).toBeNull();
  });
});
