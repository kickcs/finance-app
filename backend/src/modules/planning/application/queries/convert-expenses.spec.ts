import {
  convertExpensesToCurrency,
  calcBudgetPercentage,
  MAX_PERCENTAGE,
} from './convert-expenses';
import type { IExchangeRateCache } from '../../../exchange/application/services/exchange-rate-cache.service';

describe('convert-expenses utilities', () => {
  describe('calcBudgetPercentage', () => {
    it('should calculate correct percentage', () => {
      expect(calcBudgetPercentage(5000, 10000)).toBe(50);
    });

    it('should return 0 when nothing spent', () => {
      expect(calcBudgetPercentage(0, 10000)).toBe(0);
    });

    it('should return 100 when fully spent', () => {
      expect(calcBudgetPercentage(10000, 10000)).toBe(100);
    });

    it('should cap at MAX_PERCENTAGE for extreme overspending', () => {
      expect(calcBudgetPercentage(100000, 1000)).toBe(MAX_PERCENTAGE);
    });

    it('should allow up to MAX_PERCENTAGE', () => {
      expect(calcBudgetPercentage(9990, 1000)).toBe(MAX_PERCENTAGE);
    });

    it('should round to nearest integer', () => {
      expect(calcBudgetPercentage(3333, 10000)).toBe(33);
    });
  });

  describe('convertExpensesToCurrency', () => {
    const mockCache = {
      get: jest.fn(),
      resolve: jest.fn(),
      getAll: jest.fn(),
      set: jest.fn(),
      reload: jest.fn(),
    } as unknown as jest.Mocked<IExchangeRateCache>;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return amount as-is for same currency', () => {
      const result = convertExpensesToCurrency({ USD: 5000 }, 'USD', mockCache);

      expect(result).toBe(5000);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockCache.resolve).not.toHaveBeenCalled();
    });

    it('should convert foreign currency expenses using exchange rate', () => {
      mockCache.resolve.mockReturnValue({
        rate: 1.1,
        updatedAt: new Date(),
        isInverse: false,
        isCrossRate: false,
      });

      const result = convertExpensesToCurrency({ EUR: 10000 }, 'USD', mockCache);

      expect(result).toBe(11000);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockCache.resolve).toHaveBeenCalledWith('EUR', 'USD');
    });

    it('should sum multiple currencies', () => {
      mockCache.resolve.mockReturnValue({
        rate: 0.5,
        updatedAt: new Date(),
        isInverse: false,
        isCrossRate: false,
      });

      const result = convertExpensesToCurrency({ USD: 5000, EUR: 10000 }, 'USD', mockCache);

      // USD: 5000 (same) + EUR: 10000 * 0.5 = 5000 => total 10000
      expect(result).toBe(10000);
    });

    it('should fall back to raw amount when no exchange rate found', () => {
      mockCache.resolve.mockReturnValue(null);

      const result = convertExpensesToCurrency({ XYZ: 1000 }, 'USD', mockCache);

      expect(result).toBe(1000);
    });

    it('should return 0 for empty expense map', () => {
      const result = convertExpensesToCurrency({}, 'USD', mockCache);

      expect(result).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      mockCache.resolve.mockReturnValue({
        rate: 1.333,
        updatedAt: new Date(),
        isInverse: false,
        isCrossRate: false,
      });

      const result = convertExpensesToCurrency({ EUR: 100 }, 'USD', mockCache);

      // 100 * 1.333 = 133.3 => rounded to 133.3
      expect(result).toBe(133.3);
    });
  });
});
