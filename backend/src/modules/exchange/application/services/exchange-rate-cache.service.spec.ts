import { Test, type TestingModule } from '@nestjs/testing';
import { ExchangeRateCacheService } from './exchange-rate-cache.service';
import { EXCHANGE_RATE_REPOSITORY } from '../../domain/repositories';
import { ExchangeRate } from '../../domain/aggregates';

describe('ExchangeRateCacheService', () => {
  let cache: ExchangeRateCacheService;
  const mockRepository = {
    findByPair: jest.fn(),
    findAll: jest.fn(),
    findByBaseCurrency: jest.fn(),
    findByTargetCurrency: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    saveMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeRateCacheService,
        { provide: EXCHANGE_RATE_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    cache = module.get<ExchangeRateCacheService>(ExchangeRateCacheService);
    jest.clearAllMocks();
  });

  describe('set and get', () => {
    it('should store and retrieve a rate', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      cache.set(rate);

      const retrieved = cache.get('USD', 'EUR');
      expect(retrieved).toBeDefined();
      expect(retrieved!.rate).toBe(0.85);
    });

    it('should return null for non-existent rate', () => {
      const result = cache.get('USD', 'XYZ');
      expect(result).toBeNull();
    });

    it('should handle case-insensitive lookup', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      cache.set(rate);

      const retrieved = cache.get('usd', 'eur');
      expect(retrieved).toBeDefined();
      expect(retrieved!.rate).toBe(0.85);
    });
  });

  describe('resolve', () => {
    it('should return rate 1 for same currency', () => {
      const result = cache.resolve('USD', 'USD');

      expect(result).toBeDefined();
      expect(result!.rate).toBe(1);
      expect(result!.isInverse).toBe(false);
      expect(result!.isCrossRate).toBe(false);
    });

    it('should return direct rate when available', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      cache.set(rate);

      const result = cache.resolve('USD', 'EUR');

      expect(result).toBeDefined();
      expect(result!.rate).toBe(0.85);
      expect(result!.isInverse).toBe(false);
      expect(result!.isCrossRate).toBe(false);
    });

    it('should return inverse rate when direct rate is not available', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      cache.set(rate);

      const result = cache.resolve('EUR', 'USD');

      expect(result).toBeDefined();
      expect(result!.rate).toBeCloseTo(1 / 0.85, 10);
      expect(result!.isInverse).toBe(true);
      expect(result!.isCrossRate).toBe(false);
    });

    it('should return cross-rate through USD', () => {
      const usdToEur = ExchangeRate.create('USD', 'EUR', 0.85);
      const usdToGbp = ExchangeRate.create('USD', 'GBP', 0.79);
      cache.set(usdToEur);
      cache.set(usdToGbp);

      const result = cache.resolve('EUR', 'GBP');

      expect(result).toBeDefined();
      // EUR -> USD -> GBP: (1 / 0.85) * 0.79
      expect(result!.rate).toBeCloseTo((1 / 0.85) * 0.79, 8);
      expect(result!.isCrossRate).toBe(true);
    });

    it('should return null when no rate can be resolved', () => {
      const result = cache.resolve('XYZ', 'ABC');
      expect(result).toBeNull();
    });

    it('should handle case-insensitive resolve', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      cache.set(rate);

      const result = cache.resolve('usd', 'eur');

      expect(result).toBeDefined();
      expect(result!.rate).toBe(0.85);
    });
  });

  describe('getAll', () => {
    it('should return all cached rates', () => {
      cache.set(ExchangeRate.create('USD', 'EUR', 0.85));
      cache.set(ExchangeRate.create('USD', 'GBP', 0.79));

      const all = cache.getAll();
      expect(all).toHaveLength(2);
    });

    it('should return empty array when cache is empty', () => {
      const all = cache.getAll();
      expect(all).toEqual([]);
    });
  });

  describe('reload', () => {
    it('should load all rates from repository', async () => {
      const rates = [
        ExchangeRate.create('USD', 'EUR', 0.85),
        ExchangeRate.create('USD', 'GBP', 0.79),
      ];
      mockRepository.findAll.mockResolvedValue(rates);

      await cache.reload();

      const all = cache.getAll();
      expect(all).toHaveLength(2);
      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should replace existing cache on reload', async () => {
      // Set initial data
      cache.set(ExchangeRate.create('USD', 'EUR', 0.8));

      // Reload with new data
      const rates = [ExchangeRate.create('USD', 'EUR', 0.85)];
      mockRepository.findAll.mockResolvedValue(rates);

      await cache.reload();

      const result = cache.get('USD', 'EUR');
      expect(result!.rate).toBe(0.85);
      expect(cache.getAll()).toHaveLength(1);
    });

    it('should handle repository error gracefully (no throw)', async () => {
      mockRepository.findAll.mockRejectedValue(new Error('DB connection failed'));

      // Should not throw
      await cache.reload();

      // Cache should still be functional (empty)
      expect(cache.getAll()).toEqual([]);
    });
  });
});
