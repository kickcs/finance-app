import { Test, type TestingModule } from '@nestjs/testing';
import { GetDebtsHandler } from './get-debts.handler';
import { GetDebtsQuery } from './get-debts.query';
import { DEBT_REPOSITORY } from '../../../domain/repositories';
import { Debt } from '../../../domain/aggregates/debt';

describe('GetDebtsHandler', () => {
  let handler: GetDebtsHandler;
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
      providers: [GetDebtsHandler, { provide: DEBT_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<GetDebtsHandler>(GetDebtsHandler);
    jest.clearAllMocks();
  });

  it('should return list of debts for user', async () => {
    const debt1 = Debt.create({
      id: 'debt-1',
      userId: 'user-1',
      name: 'Debt 1',
      totalAmount: 1000,
      currency: 'USD',
      debtType: 'given',
    });
    const debt2 = Debt.create({
      id: 'debt-2',
      userId: 'user-1',
      name: 'Debt 2',
      totalAmount: 500,
      currency: 'EUR',
      debtType: 'taken',
    });

    mockRepository.findByUserId.mockResolvedValue([debt1, debt2]);

    const query = new GetDebtsQuery('user-1');
    const result = await handler.execute(query);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('debt-1');
    expect(result[0].name).toBe('Debt 1');
    expect(result[0].totalAmount).toBe(1000);
    expect(result[1].id).toBe('debt-2');
    expect(result[1].name).toBe('Debt 2');
    expect(result[1].debtType).toBe('taken');
    expect(mockRepository.findByUserId).toHaveBeenCalledWith('user-1');
  });

  it('should return empty array when user has no debts', async () => {
    mockRepository.findByUserId.mockResolvedValue([]);

    const query = new GetDebtsQuery('user-no-debts');
    const result = await handler.execute(query);

    expect(result).toEqual([]);
    expect(mockRepository.findByUserId).toHaveBeenCalledWith('user-no-debts');
  });
});
