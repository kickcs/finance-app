import { Test, type TestingModule } from '@nestjs/testing';
import { GetTransactionsPaginatedHandler } from './get-transactions-paginated.handler';
import { GetTransactionsPaginatedQuery } from './get-transactions-paginated.query';
import { TRANSACTION_REPOSITORY } from '../../../domain/repositories/transaction.repository.interface';
import { Transaction } from '../../../domain/aggregates/transaction';

describe('GetTransactionsPaginatedHandler', () => {
  let handler: GetTransactionsPaginatedHandler;
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
        GetTransactionsPaginatedHandler,
        { provide: TRANSACTION_REPOSITORY, useValue: mockTransactionRepository },
      ],
    }).compile();

    handler = module.get<GetTransactionsPaginatedHandler>(GetTransactionsPaginatedHandler);
    jest.clearAllMocks();
  });

  it('should return paginated transactions with calculated fields', async () => {
    const now = new Date('2026-03-20T12:00:00Z');
    const tx = Transaction.createExpense(
      'tx-1',
      'user-1',
      'acc-1',
      'cat-1',
      100,
      'USD',
      now,
      'Test',
    );

    // The repository returns TransactionWithReturns (extends Transaction with returnedAmount)
    const txWithReturns = Object.assign(tx, { returnedAmount: 0 });

    mockTransactionRepository.getPaginated.mockResolvedValue({
      data: [txWithReturns],
      nextCursor: null,
      hasMore: false,
    });

    const query = new GetTransactionsPaginatedQuery('user-1', 20);
    const result = await handler.execute(query);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('tx-1');
    expect(result.data[0].amount).toBe(100);
    expect(result.data[0].type).toBe('expense');
    expect(result.data[0].netAmount).toBe(100);
    expect(result.data[0].hasDebtReturns).toBe(false);
    expect(result.data[0].returnedAmount).toBe(0);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('should calculate netAmount correctly when returnedAmount > 0', async () => {
    const now = new Date();
    const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 500, 'USD', now);
    const txWithReturns = Object.assign(tx, { returnedAmount: 200 });

    mockTransactionRepository.getPaginated.mockResolvedValue({
      data: [txWithReturns],
      nextCursor: null,
      hasMore: false,
    });

    const result = await handler.execute(new GetTransactionsPaginatedQuery('user-1'));

    expect(result.data[0].netAmount).toBe(300);
    expect(result.data[0].hasDebtReturns).toBe(true);
  });

  it('should pass all filter options to repository', async () => {
    mockTransactionRepository.getPaginated.mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
    });

    const query = new GetTransactionsPaginatedQuery(
      'user-1',
      10,
      '2026-03-01',
      '2026-03-01T00:00:00Z',
      'tx-cursor-1',
      'expense',
      'acc-1',
      'cat-food',
      'groceries',
      'debt-1',
    );

    await handler.execute(query);

    expect(mockTransactionRepository.getPaginated).toHaveBeenCalledWith('user-1', {
      pageSize: 10,
      cursorDate: '2026-03-01',
      cursorCreatedAt: '2026-03-01T00:00:00Z',
      cursorId: 'tx-cursor-1',
      type: 'expense',
      accountId: 'acc-1',
      categoryId: 'cat-food',
      search: 'groceries',
      debtId: 'debt-1',
    });
  });

  it('should handle pagination with cursor', async () => {
    mockTransactionRepository.getPaginated.mockResolvedValue({
      data: [],
      nextCursor: { date: '2026-03-15', createdAt: '2026-03-15T10:00:00Z' },
      hasMore: true,
    });

    const result = await handler.execute(new GetTransactionsPaginatedQuery('user-1', 20));

    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual({
      date: '2026-03-15',
      createdAt: '2026-03-15T10:00:00Z',
    });
  });

  it('should include transfer fields in response', async () => {
    const now = new Date();
    const tx = Transaction.createTransfer(
      'tx-1',
      'user-1',
      'acc-1',
      'acc-2',
      'cat-t',
      100,
      'USD',
      92,
      'EUR',
      now,
    );
    const txWithReturns = Object.assign(tx, { returnedAmount: 0 });

    mockTransactionRepository.getPaginated.mockResolvedValue({
      data: [txWithReturns],
      nextCursor: null,
      hasMore: false,
    });

    const result = await handler.execute(new GetTransactionsPaginatedQuery('user-1'));

    expect(result.data[0].toAccountId).toBe('acc-2');
    expect(result.data[0].toAmount).toBe(92);
    expect(result.data[0].toCurrency).toBe('EUR');
  });
});
