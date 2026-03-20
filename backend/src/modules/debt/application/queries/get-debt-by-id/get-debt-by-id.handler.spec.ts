import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { GetDebtByIdHandler } from './get-debt-by-id.handler';
import { GetDebtByIdQuery } from './get-debt-by-id.query';
import { DEBT_REPOSITORY } from '../../../domain/repositories';
import { Debt } from '../../../domain/aggregates/debt';

describe('GetDebtByIdHandler', () => {
  let handler: GetDebtByIdHandler;
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
      providers: [GetDebtByIdHandler, { provide: DEBT_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<GetDebtByIdHandler>(GetDebtByIdHandler);
    jest.clearAllMocks();
  });

  it('should return debt response for valid debt owned by user', async () => {
    const debt = Debt.create({
      id: 'debt-1',
      userId: 'user-1',
      name: 'Test Debt',
      totalAmount: 1000,
      currency: 'USD',
      debtType: 'given',
      personName: 'Alice',
    });
    mockRepository.findById.mockResolvedValue(debt);

    const query = new GetDebtByIdQuery('debt-1', 'user-1');
    const result = await handler.execute(query);

    expect(result.id).toBe('debt-1');
    expect(result.name).toBe('Test Debt');
    expect(result.totalAmount).toBe(1000);
    expect(result.personName).toBe('Alice');
    expect(result.debtType).toBe('given');
    expect(mockRepository.findById).toHaveBeenCalledWith('debt-1');
  });

  it('should throw NotFoundException when debt does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    const query = new GetDebtByIdQuery('non-existent', 'user-1');

    await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when user does not own the debt', async () => {
    const debt = Debt.create({
      id: 'debt-1',
      userId: 'other-user',
      name: 'Other Debt',
      totalAmount: 500,
      currency: 'EUR',
      debtType: 'taken',
    });
    mockRepository.findById.mockResolvedValue(debt);

    const query = new GetDebtByIdQuery('debt-1', 'user-1');

    await expect(handler.execute(query)).rejects.toThrow(ForbiddenException);
  });
});
