import { Test, type TestingModule } from '@nestjs/testing';
import { GetMonthlyStatsHandler } from './get-monthly-stats.handler';
import { GetMonthlyStatsQuery } from './get-monthly-stats.query';
import { TRANSACTION_REPOSITORY } from '../../../domain/repositories/transaction.repository.interface';

describe('GetMonthlyStatsHandler', () => {
  let handler: GetMonthlyStatsHandler;
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetMonthlyStatsHandler,
        { provide: TRANSACTION_REPOSITORY, useValue: mockTransactionRepository },
      ],
    }).compile();

    handler = module.get<GetMonthlyStatsHandler>(GetMonthlyStatsHandler);
    jest.clearAllMocks();
  });

  it('should return monthly stats from repository', async () => {
    const stats = {
      totalIncome: 5000,
      totalExpense: 3000,
      incomeByCurrency: { USD: 5000 },
      expenseByCurrency: { USD: 3000 },
    };
    mockTransactionRepository.getMonthlyStats.mockResolvedValue(stats);

    const result = await handler.execute(new GetMonthlyStatsQuery('user-1', 2026, 3));

    expect(result).toEqual(stats);
    expect(mockTransactionRepository.getMonthlyStats).toHaveBeenCalledWith('user-1', 2026, 3);
  });

  it('should return zero stats for month with no transactions', async () => {
    const emptyStats = {
      totalIncome: 0,
      totalExpense: 0,
      incomeByCurrency: {},
      expenseByCurrency: {},
    };
    mockTransactionRepository.getMonthlyStats.mockResolvedValue(emptyStats);

    const result = await handler.execute(new GetMonthlyStatsQuery('user-1', 2025, 1));

    expect(result.totalIncome).toBe(0);
    expect(result.totalExpense).toBe(0);
  });
});
