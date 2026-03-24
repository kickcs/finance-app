import { Test, type TestingModule } from '@nestjs/testing';
import { GetBudgetForMonthHandler } from './get-budget-for-month.handler';
import { GetBudgetForMonthQuery } from './get-budget-for-month.query';
import { Budget } from '../../../domain/aggregates/budget';
import { BUDGET_REPOSITORY } from '../../../domain/repositories';
import { TRANSACTION_REPOSITORY } from '../../../../accounting/domain/repositories';
import { EXCHANGE_RATE_CACHE } from '../../../../exchange/application/services/exchange-rate-cache.service';

describe('GetBudgetForMonthHandler', () => {
  let handler: GetBudgetForMonthHandler;
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
        GetBudgetForMonthHandler,
        { provide: BUDGET_REPOSITORY, useValue: mockBudgetRepository },
        { provide: TRANSACTION_REPOSITORY, useValue: mockTransactionRepository },
        { provide: EXCHANGE_RATE_CACHE, useValue: mockExchangeRateCache },
      ],
    }).compile();

    handler = module.get<GetBudgetForMonthHandler>(GetBudgetForMonthHandler);
    jest.clearAllMocks();
  });

  it('should return null when no budget exists', async () => {
    mockBudgetRepository.findOverride.mockResolvedValue(null);
    mockBudgetRepository.findDefault.mockResolvedValue(null);

    const query = new GetBudgetForMonthQuery('user-1', 2026, 3);

    const result = await handler.execute(query);

    expect(result).toBeNull();
  });

  it('should use override budget when it exists', async () => {
    const override = Budget.createOverride('b-2', 'user-1', 2026, 3, 60000, 'USD');
    const defaultBudget = Budget.createDefault('b-1', 'user-1', 50000, 'USD');

    mockBudgetRepository.findOverride.mockResolvedValue(override);
    mockBudgetRepository.findDefault.mockResolvedValue(defaultBudget);
    mockTransactionRepository.getMonthlyStats.mockResolvedValue({
      totalIncome: 100000,
      totalExpense: 30000,
      incomeByCurrency: { USD: 100000 },
      expenseByCurrency: { USD: 30000 },
    });

    const query = new GetBudgetForMonthQuery('user-1', 2026, 3);

    const result = await handler.execute(query);

    expect(result).not.toBeNull();
    expect(result!.budget.amount).toBe(60000);
    expect(result!.budget.isDefault).toBe(false);
    expect(result!.spent).toBe(30000);
    expect(result!.remaining).toBe(30000);
    expect(result!.percentage).toBe(50);
  });

  it('should fall back to default budget when no override exists', async () => {
    const defaultBudget = Budget.createDefault('b-1', 'user-1', 50000, 'USD');

    mockBudgetRepository.findOverride.mockResolvedValue(null);
    mockBudgetRepository.findDefault.mockResolvedValue(defaultBudget);
    mockTransactionRepository.getMonthlyStats.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 25000,
      incomeByCurrency: {},
      expenseByCurrency: { USD: 25000 },
    });

    const query = new GetBudgetForMonthQuery('user-1', 2026, 3);

    const result = await handler.execute(query);

    expect(result).not.toBeNull();
    expect(result!.budget.amount).toBe(50000);
    expect(result!.budget.isDefault).toBe(true);
    expect(result!.spent).toBe(25000);
    expect(result!.remaining).toBe(25000);
    expect(result!.percentage).toBe(50);
  });

  it('should convert multi-currency expenses to budget currency', async () => {
    const defaultBudget = Budget.createDefault('b-1', 'user-1', 100000, 'USD');

    mockBudgetRepository.findOverride.mockResolvedValue(null);
    mockBudgetRepository.findDefault.mockResolvedValue(defaultBudget);
    mockTransactionRepository.getMonthlyStats.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 50000,
      incomeByCurrency: {},
      expenseByCurrency: { USD: 20000, EUR: 10000 },
    });
    mockExchangeRateCache.resolve.mockReturnValue({
      rate: 1.1,
      updatedAt: new Date(),
      isInverse: false,
      isCrossRate: false,
    });

    const query = new GetBudgetForMonthQuery('user-1', 2026, 3);

    const result = await handler.execute(query);

    // USD: 20000 (same currency) + EUR: 10000 * 1.1 = 11000 => total 31000
    expect(result!.spent).toBe(31000);
    expect(result!.remaining).toBe(69000);
  });

  it('should pass startDay to getMonthlyStats', async () => {
    const defaultBudget = Budget.createDefault('b-1', 'user-1', 50000, 'USD');
    mockBudgetRepository.findOverride.mockResolvedValue(null);
    mockBudgetRepository.findDefault.mockResolvedValue(defaultBudget);
    mockTransactionRepository.getMonthlyStats.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 0,
      incomeByCurrency: {},
      expenseByCurrency: {},
    });

    await handler.execute(new GetBudgetForMonthQuery('user-1', 2026, 3, 15));

    expect(mockTransactionRepository.getMonthlyStats).toHaveBeenCalledWith('user-1', 2026, 3, 15);
  });

  it('should handle overspending (negative remaining)', async () => {
    const defaultBudget = Budget.createDefault('b-1', 'user-1', 10000, 'USD');

    mockBudgetRepository.findOverride.mockResolvedValue(null);
    mockBudgetRepository.findDefault.mockResolvedValue(defaultBudget);
    mockTransactionRepository.getMonthlyStats.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 15000,
      incomeByCurrency: {},
      expenseByCurrency: { USD: 15000 },
    });

    const query = new GetBudgetForMonthQuery('user-1', 2026, 3);

    const result = await handler.execute(query);

    expect(result!.spent).toBe(15000);
    expect(result!.remaining).toBe(-5000);
    expect(result!.percentage).toBe(150);
  });
});
