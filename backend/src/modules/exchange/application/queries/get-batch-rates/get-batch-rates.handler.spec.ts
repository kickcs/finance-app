import { Test, type TestingModule } from '@nestjs/testing';
import { GetBatchRatesHandler } from './get-batch-rates.handler';
import { GetBatchRatesQuery } from './get-batch-rates.query';
import { EXCHANGE_RATE_CACHE } from '../../services/exchange-rate-cache.service';
import { ExchangeRate } from '../../../domain/aggregates';

describe('GetBatchRatesHandler', () => {
  let handler: GetBatchRatesHandler;
  const mockCache = {
    get: jest.fn(),
    resolve: jest.fn(),
    getAll: jest.fn(),
    set: jest.fn(),
    reload: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetBatchRatesHandler, { provide: EXCHANGE_RATE_CACHE, useValue: mockCache }],
    }).compile();

    handler = module.get<GetBatchRatesHandler>(GetBatchRatesHandler);
    jest.clearAllMocks();
  });

  it('should return rates for all available target currencies', async () => {
    const now = new Date();
    const allRates = [
      ExchangeRate.create('USD', 'EUR', 0.85),
      ExchangeRate.create('USD', 'GBP', 0.79),
      ExchangeRate.create('USD', 'RUB', 91.5),
    ];

    mockCache.getAll.mockReturnValue(allRates);
    mockCache.resolve.mockImplementation((base: string, target: string) => {
      if (base === 'USD' && target === 'EUR') return { rate: 0.85, updatedAt: now };
      if (base === 'USD' && target === 'GBP') return { rate: 0.79, updatedAt: now };
      if (base === 'USD' && target === 'RUB') return { rate: 91.5, updatedAt: now };
      return null;
    });

    const query = new GetBatchRatesQuery('USD');
    const result = await handler.execute(query);

    expect(result.baseCurrency).toBe('USD');
    expect(result.rates['EUR']).toEqual({ rate: 0.85, updatedAt: now });
    expect(result.rates['GBP']).toEqual({ rate: 0.79, updatedAt: now });
    expect(result.rates['RUB']).toEqual({ rate: 91.5, updatedAt: now });
  });

  it('should return empty rates when cache is empty', async () => {
    mockCache.getAll.mockReturnValue([]);

    const query = new GetBatchRatesQuery('USD');
    const result = await handler.execute(query);

    expect(result.baseCurrency).toBe('USD');
    expect(Object.keys(result.rates)).toHaveLength(0);
  });

  it('should normalize base currency to uppercase', async () => {
    mockCache.getAll.mockReturnValue([]);

    const query = new GetBatchRatesQuery('usd');
    const result = await handler.execute(query);

    expect(result.baseCurrency).toBe('USD');
  });

  it('should exclude base currency from targets', async () => {
    const allRates = [ExchangeRate.create('USD', 'EUR', 0.85)];

    mockCache.getAll.mockReturnValue(allRates);
    mockCache.resolve.mockImplementation((base: string, target: string) => {
      if (base === 'USD' && target === 'EUR') return { rate: 0.85, updatedAt: new Date() };
      return null;
    });

    const query = new GetBatchRatesQuery('USD');
    const result = await handler.execute(query);

    // Should not have USD in rates (it's the base currency)
    expect(result.rates['USD']).toBeUndefined();
    expect(result.rates['EUR']).toBeDefined();
  });

  it('should skip targets where resolve returns null', async () => {
    const allRates = [
      ExchangeRate.create('USD', 'EUR', 0.85),
      ExchangeRate.create('GBP', 'JPY', 190),
    ];

    mockCache.getAll.mockReturnValue(allRates);
    mockCache.resolve.mockImplementation((base: string, target: string) => {
      // Only EUR resolves from USD
      if (base === 'USD' && target === 'EUR') return { rate: 0.85, updatedAt: new Date() };
      return null;
    });

    const query = new GetBatchRatesQuery('USD');
    const result = await handler.execute(query);

    expect(result.rates['EUR']).toBeDefined();
    // GBP and JPY might not resolve from USD base
    expect(result.rates['GBP']).toBeUndefined();
    expect(result.rates['JPY']).toBeUndefined();
  });
});
