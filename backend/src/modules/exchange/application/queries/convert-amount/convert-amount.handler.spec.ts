import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConvertAmountHandler } from './convert-amount.handler';
import { ConvertAmountQuery } from './convert-amount.query';
import { EXCHANGE_RATE_CACHE } from '../../services/exchange-rate-cache.service';

describe('ConvertAmountHandler', () => {
  let handler: ConvertAmountHandler;
  const mockCache = {
    get: jest.fn(),
    resolve: jest.fn(),
    getAll: jest.fn(),
    set: jest.fn(),
    reload: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConvertAmountHandler, { provide: EXCHANGE_RATE_CACHE, useValue: mockCache }],
    }).compile();

    handler = module.get<ConvertAmountHandler>(ConvertAmountHandler);
    jest.clearAllMocks();
  });

  it('should convert amount between currencies', async () => {
    mockCache.resolve.mockReturnValue({
      rate: 0.85,
      updatedAt: new Date(),
      isInverse: false,
      isCrossRate: false,
    });

    const query = new ConvertAmountQuery(100, 'USD', 'EUR');
    const result = await handler.execute(query);

    expect(result.amount).toBe(100);
    expect(result.fromCurrency).toBe('USD');
    expect(result.toCurrency).toBe('EUR');
    expect(result.convertedAmount).toBe(85);
    expect(result.rate).toBe(0.85);
    expect(result.inverseRate).toBeCloseTo(1 / 0.85, 10);
  });

  it('should round converted amount to 2 decimal places', async () => {
    mockCache.resolve.mockReturnValue({
      rate: 0.333,
      updatedAt: new Date(),
      isInverse: false,
      isCrossRate: false,
    });

    const query = new ConvertAmountQuery(100, 'USD', 'EUR');
    const result = await handler.execute(query);

    // 100 * 0.333 = 33.3 -> rounded to 33.30
    expect(result.convertedAmount).toBe(33.3);
  });

  it('should handle zero amount', async () => {
    mockCache.resolve.mockReturnValue({
      rate: 0.85,
      updatedAt: new Date(),
      isInverse: false,
      isCrossRate: false,
    });

    const query = new ConvertAmountQuery(0, 'USD', 'EUR');
    const result = await handler.execute(query);

    expect(result.convertedAmount).toBe(0);
  });

  it('should normalize currency codes to uppercase', async () => {
    mockCache.resolve.mockReturnValue({
      rate: 12500,
      updatedAt: new Date(),
      isInverse: false,
      isCrossRate: false,
    });

    const query = new ConvertAmountQuery(1, 'usd', 'uzs');
    const result = await handler.execute(query);

    expect(result.fromCurrency).toBe('USD');
    expect(result.toCurrency).toBe('UZS');
    expect(mockCache.resolve).toHaveBeenCalledWith('USD', 'UZS');
  });

  it('should throw NotFoundException when rate is not found', async () => {
    mockCache.resolve.mockReturnValue(null);

    const query = new ConvertAmountQuery(100, 'USD', 'XYZ');

    await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
  });

  it('should handle large amount conversion (UZS)', async () => {
    mockCache.resolve.mockReturnValue({
      rate: 12500,
      updatedAt: new Date(),
      isInverse: false,
      isCrossRate: false,
    });

    const query = new ConvertAmountQuery(1000, 'USD', 'UZS');
    const result = await handler.execute(query);

    expect(result.convertedAmount).toBe(12500000);
  });
});
