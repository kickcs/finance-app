import { Test, type TestingModule } from '@nestjs/testing';
import { GetBudgetHistoryHandler } from './get-budget-history.handler';
import { GetBudgetHistoryQuery } from './get-budget-history.query';
import { Budget } from '../../../domain/aggregates/budget';
import { BUDGET_REPOSITORY } from '../../../domain/repositories';
import { TRANSACTION_REPOSITORY } from '../../../../accounting/domain/repositories';
import { EXCHANGE_RATE_CACHE } from '../../../../exchange/application/services/exchange-rate-cache.service';

describe('GetBudgetHistoryHandler', () => {
  let handler: GetBudgetHistoryHandler;
  const mockBudgetRepository = {
    findDefault: jest.fn(),
    findOverride: jest.fn(),
    findByUserId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const mockTransactionRepository = {
    getMonthlyStats: jest.fn(),
  };
  const mockExchangeRateCache = {
    resolve: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetBudgetHistoryHandler,
        { provide: BUDGET_REPOSITORY, useValue: mockBudgetRepository },
        { provide: TRANSACTION_REPOSITORY, useValue: mockTransactionRepository },
        { provide: EXCHANGE_RATE_CACHE, useValue: mockExchangeRateCache },
      ],
    }).compile();

    handler = module.get<GetBudgetHistoryHandler>(GetBudgetHistoryHandler);
    jest.clearAllMocks();
  });

  it('should return empty items when user has no budgets', async () => {
    mockBudgetRepository.findByUserId.mockResolvedValue([]);

    const query = new GetBudgetHistoryQuery('user-1', 3);

    const result = await handler.execute(query);

    expect(result.items).toEqual([]);
    expect(mockTransactionRepository.getMonthlyStats).not.toHaveBeenCalled();
  });

  it('should return budget history with stats for months that have a budget', async () => {
    const defaultBudget = Budget.createDefault('b-1', 'user-1', 50000, 'USD');
    mockBudgetRepository.findByUserId.mockResolvedValue([defaultBudget]);
    mockTransactionRepository.getMonthlyStats.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 25000,
      incomeByCurrency: {},
      expenseByCurrency: { USD: 25000 },
    });

    const query = new GetBudgetHistoryQuery('user-1', 2);

    const result = await handler.execute(query);

    expect(result.items.length).toBe(2);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        amount: 50000,
        currency: 'USD',
        spent: 25000,
        percentage: 50,
      }),
    );
    expect(mockTransactionRepository.getMonthlyStats).toHaveBeenCalledTimes(2);
  });

  it('should use override budget for a specific month', async () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const defaultBudget = Budget.createDefault('b-1', 'user-1', 50000, 'USD');
    const override = Budget.reconstitute({
      id: 'b-2',
      userId: 'user-1',
      year: currentYear,
      month: currentMonth,
      amount: 80000,
      currency: 'USD',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockBudgetRepository.findByUserId.mockResolvedValue([defaultBudget, override]);
    mockTransactionRepository.getMonthlyStats.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 40000,
      incomeByCurrency: {},
      expenseByCurrency: { USD: 40000 },
    });

    const query = new GetBudgetHistoryQuery('user-1', 1);

    const result = await handler.execute(query);

    // Current month should use override (80000) not default (50000)
    expect(result.items).toHaveLength(1);
    expect(result.items[0].amount).toBe(80000);
    expect(result.items[0].spent).toBe(40000);
    expect(result.items[0].percentage).toBe(50);
  });
});
