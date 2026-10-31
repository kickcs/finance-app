import { Test, type TestingModule } from '@nestjs/testing';
import { GetTransactionsSummaryHandler } from './get-transactions-summary.handler';
import { GetTransactionsSummaryQuery } from './get-transactions-summary.query';
import { TRANSACTION_REPOSITORY } from '../../../domain/repositories/transaction.repository.interface';

describe('GetTransactionsSummaryHandler', () => {
  let handler: GetTransactionsSummaryHandler;
  const repository = { getSummary: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTransactionsSummaryHandler,
        { provide: TRANSACTION_REPOSITORY, useValue: repository },
      ],
    }).compile();
    handler = module.get(GetTransactionsSummaryHandler);
    jest.clearAllMocks();
  });

  it('считает eligibleCount как count − lockedCount и отдаёт суммы по валютам как есть', async () => {
    repository.getSummary.mockResolvedValue({
      count: 10,
      lockedCount: 3,
      totals: [
        { currency: 'USD', amount: -50 },
        { currency: 'UZS', amount: 200 },
      ],
    });

    const result = await handler.execute(new GetTransactionsSummaryQuery('user-1', {}));

    expect(result).toMatchObject({
      count: 10,
      lockedCount: 3,
      eligibleCount: 7,
      totals: [
        { currency: 'USD', amount: -50 },
        { currency: 'UZS', amount: 200 },
      ],
    });
  });

  it('asOf — момент сервера в ISO, и именно он ограничивает выборку итога', async () => {
    repository.getSummary.mockResolvedValue({ count: 0, lockedCount: 0, totals: [] });
    const before = Date.now();

    const result = await handler.execute(
      new GetTransactionsSummaryQuery('user-1', { categoryIds: ['taxi'] }),
    );

    const [userId, filter] = repository.getSummary.mock.calls[0] as [
      string,
      { categoryIds: string[]; asOf: Date },
    ];
    expect(userId).toBe('user-1');
    expect(filter.categoryIds).toEqual(['taxi']);
    expect(result.asOf).toBe(filter.asOf.toISOString());
    expect(filter.asOf.getTime()).toBeGreaterThanOrEqual(before);
    expect(filter.asOf.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
