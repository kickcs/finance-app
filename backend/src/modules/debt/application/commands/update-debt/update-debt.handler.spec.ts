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

  function createTestDebt(overrides: Partial<{ userId: string }> = {}) {
    const debt = Debt.create({
      id: 'debt-1',
      userId: overrides.userId ?? 'user-1',
      name: 'Test Debt',
      totalAmount: 1000,
      currency: 'USD',
      debtType: 'given',
      personName: 'John',
    });
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

  it('should move the remainder along with the total amount', async () => {
    const debt = createTestDebt();
    debt.makePayment(400);
    debt.clearDomainEvents();
    mockRepository.findById.mockResolvedValue(debt);
    mockRepository.save.mockImplementation((d) => Promise.resolve(d));

    const command = new UpdateDebtCommand('debt-1', 'user-1', { totalAmount: 1500 });

    const result = await handler.execute(command);

    expect(result.totalAmount).toBe(1500);
    // Возвращённые 400 остаются возвращёнными: 1500 − 400
    expect(result.remainingAmount).toBe(1100);
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

  it('should flip the direction of an untouched debt', async () => {
    const debt = createTestDebt();
    mockRepository.findById.mockResolvedValue(debt);
    mockRepository.save.mockImplementation((d) => Promise.resolve(d));

    const command = new UpdateDebtCommand('debt-1', 'user-1', { debtType: 'taken' });

    const result = await handler.execute(command);

    expect(result.debtType).toBe('taken');
  });

  it('should refuse to flip the direction once a payment landed', async () => {
    const debt = createTestDebt();
    debt.makePayment(400);
    debt.clearDomainEvents();
    mockRepository.findById.mockResolvedValue(debt);

    const command = new UpdateDebtCommand('debt-1', 'user-1', { debtType: 'taken' });

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should allow re-sending the same direction on a partly repaid debt', async () => {
    const debt = createTestDebt();
    debt.makePayment(400);
    debt.clearDomainEvents();
    mockRepository.findById.mockResolvedValue(debt);
    mockRepository.save.mockImplementation((d) => Promise.resolve(d));

    const command = new UpdateDebtCommand('debt-1', 'user-1', {
      debtType: 'given',
      description: 'Правим только описание',
    });

    const result = await handler.execute(command);

    expect(result.description).toBe('Правим только описание');
  });

  it('should backdate the debt creation date', async () => {
    const debt = createTestDebt();
    mockRepository.findById.mockResolvedValue(debt);
    mockRepository.save.mockImplementation((d) => Promise.resolve(d));

    const backdated = new Date('2026-08-01T10:30:00.000Z');
    const command = new UpdateDebtCommand('debt-1', 'user-1', { createdAt: backdated });

    const result = await handler.execute(command);

    expect(result.createdAt).toBe(backdated.toISOString());
  });

  it('should leave the creation date alone when it is not in the payload', async () => {
    const debt = createTestDebt();
    const before = debt.createdAt.toISOString();
    mockRepository.findById.mockResolvedValue(debt);
    mockRepository.save.mockImplementation((d) => Promise.resolve(d));

    const result = await handler.execute(new UpdateDebtCommand('debt-1', 'user-1', { name: 'X' }));

    expect(result.createdAt).toBe(before);
  });
});
