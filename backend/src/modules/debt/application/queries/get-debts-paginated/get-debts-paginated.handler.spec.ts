import { Test, type TestingModule } from '@nestjs/testing';
import { GetDebtsPaginatedHandler } from './get-debts-paginated.handler';
import { GetDebtsPaginatedQuery } from './get-debts-paginated.query';
import { DEBT_REPOSITORY } from '../../../domain/repositories';
import { DebtResponseMapper } from '../../mappers/debt-response.mapper';
import type { PaginatedDebtGroups } from '../../../domain/repositories';
import type { Debt } from '../../../domain/aggregates/debt';

describe('GetDebtsPaginatedHandler', () => {
  let handler: GetDebtsPaginatedHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByTransactionId: jest.fn(),
    hasOpenDebtsForTransaction: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    getPaginated: jest.fn(),
  };

  const mappedDebt = {
    id: 'debt-1',
    userId: 'user-1',
    name: 'Test Debt',
    totalAmount: 1000,
    remainingAmount: 800,
    monthlyPayment: null,
    nextPaymentDate: null,
    debtType: 'given' as const,
    personName: 'John',
    accountId: null,
    transactionId: null,
    closeTransactionId: null,
    isClosed: false,
    currency: 'USD',
    sourceTransactionId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    description: null,
    closedAt: null,
    forgivenAmount: 0,
    isPrivate: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetDebtsPaginatedHandler, { provide: DEBT_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<GetDebtsPaginatedHandler>(GetDebtsPaginatedHandler);
    jest.clearAllMocks();
  });

  it('should return paginated groups with mapped debts', async () => {
    const fakeDebts = [{} as unknown as Debt, {} as unknown as Debt];
    const repositoryResult: PaginatedDebtGroups = {
      groups: [
        {
          personName: 'John',
          debtType: 'given',
          lastDebtDate: new Date('2026-01-15'),
          debts: fakeDebts,
        },
      ],
      totalSummary: {
        totalGiven: { USD: 1000 },
        totalTaken: {},
      },
      nextCursor: { personName: 'John', debtType: 'given', createdAt: '2026-01-15T00:00:00.000Z' },
      hasMore: true,
      totalDebtsCount: 5,
    };

    mockRepository.getPaginated.mockResolvedValue(repositoryResult);
    jest.spyOn(DebtResponseMapper, 'toResponseList').mockReturnValue([mappedDebt]);

    const query = new GetDebtsPaginatedQuery('user-1', 10);
    const result = await handler.execute(query);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].personName).toBe('John');
    expect(result.groups[0].debtType).toBe('given');
    expect(result.groups[0].debts).toEqual([mappedDebt]);
    expect(result.totalSummary).toEqual({
      totalGiven: { USD: 1000 },
      totalTaken: {},
    });
    expect(result.nextCursor).toEqual({
      personName: 'John',
      debtType: 'given',
      createdAt: '2026-01-15T00:00:00.000Z',
    });
    expect(result.hasMore).toBe(true);
    expect(result.totalDebtsCount).toBe(5);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(DebtResponseMapper.toResponseList).toHaveBeenCalledWith(fakeDebts);
  });

  it('should return empty result when no groups', async () => {
    const repositoryResult: PaginatedDebtGroups = {
      groups: [],
      totalSummary: {
        totalGiven: {},
        totalTaken: {},
      },
      nextCursor: null,
      hasMore: false,
      totalDebtsCount: 0,
    };

    mockRepository.getPaginated.mockResolvedValue(repositoryResult);

    const query = new GetDebtsPaginatedQuery('user-1', 10);
    const result = await handler.execute(query);

    expect(result.groups).toEqual([]);
    expect(result.totalSummary).toEqual({ totalGiven: {}, totalTaken: {} });
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
    expect(result.totalDebtsCount).toBe(0);
    expect(mockRepository.getPaginated).toHaveBeenCalledWith('user-1', {
      pageSize: 10,
      cursorPersonName: undefined,
      cursorDebtType: undefined,
      cursorCreatedAt: undefined,
      status: undefined,
      currency: undefined,
      personName: undefined,
    });
  });

  it('should pass all filters to repository', async () => {
    const repositoryResult: PaginatedDebtGroups = {
      groups: [],
      totalSummary: { totalGiven: {}, totalTaken: {} },
      nextCursor: null,
      hasMore: false,
      totalDebtsCount: 0,
    };

    mockRepository.getPaginated.mockResolvedValue(repositoryResult);

    const query = new GetDebtsPaginatedQuery(
      'user-1',
      5,
      'Alice',
      'taken',
      '2026-01-10T00:00:00.000Z',
      'active',
      'EUR',
      'Alice',
    );
    await handler.execute(query);

    expect(mockRepository.getPaginated).toHaveBeenCalledWith('user-1', {
      pageSize: 5,
      cursorPersonName: 'Alice',
      cursorDebtType: 'taken',
      cursorCreatedAt: '2026-01-10T00:00:00.000Z',
      status: 'active',
      currency: 'EUR',
      personName: 'Alice',
    });
  });

  it('should use default pageSize', async () => {
    const repositoryResult: PaginatedDebtGroups = {
      groups: [],
      totalSummary: { totalGiven: {}, totalTaken: {} },
      nextCursor: null,
      hasMore: false,
      totalDebtsCount: 0,
    };

    mockRepository.getPaginated.mockResolvedValue(repositoryResult);

    const query = new GetDebtsPaginatedQuery('user-1');
    await handler.execute(query);

    expect(mockRepository.getPaginated).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        pageSize: 10,
      }),
    );
  });
});
