import { Test, type TestingModule } from '@nestjs/testing';
import { GetAnalyticsStatsHandler } from './get-analytics-stats.handler';
import { GetAnalyticsStatsQuery } from './get-analytics-stats.query';
import { TRANSACTION_REPOSITORY } from '../../../domain/repositories/transaction.repository.interface';

describe('GetAnalyticsStatsHandler', () => {
  let handler: GetAnalyticsStatsHandler;
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
        GetAnalyticsStatsHandler,
        { provide: TRANSACTION_REPOSITORY, useValue: mockTransactionRepository },
      ],
    }).compile();

    handler = module.get<GetAnalyticsStatsHandler>(GetAnalyticsStatsHandler);
    jest.clearAllMocks();
  });

  it('should return analytics stats for date range', async () => {
    const stats = {
      totalIncome: 10000,
      totalExpense: 7000,
      incomeByCurrency: { USD: 10000 },
      expenseByCurrency: { USD: 5000, EUR: 2000 },
      categoryBreakdown: [
        {
          categoryId: 'cat-food',
          categoryName: 'Food',
          categoryIcon: 'restaurant',
          categoryColor: '#FF0000',
          type: 'expense' as const,
          amount: 3000,
          amountByCurrency: { USD: 3000 },
        },
      ],
    };
    mockTransactionRepository.getAnalyticsStats.mockResolvedValue(stats);

    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-03-31');
    const result = await handler.execute(new GetAnalyticsStatsQuery('user-1', startDate, endDate));

    expect(result.totalIncome).toBe(10000);
    expect(result.totalExpense).toBe(7000);
    expect(result.categoryBreakdown).toHaveLength(1);
    expect(mockTransactionRepository.getAnalyticsStats).toHaveBeenCalledWith('user-1', {
      startDate,
      endDate,
      accountIds: undefined,
    });
  });

  it('should pass accountIds filter to repository', async () => {
    mockTransactionRepository.getAnalyticsStats.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 0,
      incomeByCurrency: {},
      expenseByCurrency: {},
      categoryBreakdown: [],
    });

    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-03-31');
    const query = new GetAnalyticsStatsQuery('user-1', startDate, endDate, ['acc-1', 'acc-2']);

    await handler.execute(query);

    expect(mockTransactionRepository.getAnalyticsStats).toHaveBeenCalledWith('user-1', {
      startDate,
      endDate,
      accountIds: ['acc-1', 'acc-2'],
    });
  });
});
