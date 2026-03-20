import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetRateHandler } from './get-rate.handler';
import { GetRateQuery } from './get-rate.query';
import { EXCHANGE_RATE_CACHE } from '../../services/exchange-rate-cache.service';

describe('GetRateHandler', () => {
  let handler: GetRateHandler;
  const mockCache = {
    get: jest.fn(),
    resolve: jest.fn(),
    getAll: jest.fn(),
    set: jest.fn(),
    reload: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetRateHandler, { provide: EXCHANGE_RATE_CACHE, useValue: mockCache }],
    }).compile();

    handler = module.get<GetRateHandler>(GetRateHandler);
    jest.clearAllMocks();
  });

  it('should return rate for valid currency pair', async () => {
    const now = new Date();
    mockCache.resolve.mockReturnValue({
      rate: 0.85,
      updatedAt: now,
      isInverse: false,
      isCrossRate: false,
    });

    const query = new GetRateQuery('USD', 'EUR');
    const result = await handler.execute(query);

    expect(result.baseCurrency).toBe('USD');
    expect(result.targetCurrency).toBe('EUR');
    expect(result.rate).toBe(0.85);
    expect(result.updatedAt).toBe(now);
    expect(mockCache.resolve).toHaveBeenCalledWith('USD', 'EUR');
  });

  it('should return inverse rate from cache', async () => {
    const now = new Date();
    mockCache.resolve.mockReturnValue({
      rate: 1.1765,
      updatedAt: now,
      isInverse: true,
      isCrossRate: false,
    });

    const query = new GetRateQuery('EUR', 'USD');
    const result = await handler.execute(query);

    expect(result.baseCurrency).toBe('EUR');
    expect(result.targetCurrency).toBe('USD');
    expect(result.rate).toBeCloseTo(1.1765, 4);
    expect(result.isInverse).toBe(true);
  });

  it('should throw NotFoundException when rate is not found', async () => {
    mockCache.resolve.mockReturnValue(null);

    const query = new GetRateQuery('USD', 'XYZ');

    await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
  });
});
