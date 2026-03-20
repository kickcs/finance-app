import { CurrencyConverterService } from './currency-converter.service';
import { ExchangeRate } from '../aggregates';

describe('CurrencyConverterService', () => {
  describe('convert', () => {
    it('should convert amount using direct rate', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      const result = CurrencyConverterService.convert(100, rate);

      expect(result.amount).toBe(100);
      expect(result.fromCurrency).toBe('USD');
      expect(result.toCurrency).toBe('EUR');
      expect(result.convertedAmount).toBeCloseTo(85, 2);
      expect(result.rate).toBe(0.85);
      expect(result.inverseRate).toBeCloseTo(1 / 0.85, 10);
    });

    it('should handle zero amount', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      const result = CurrencyConverterService.convert(0, rate);

      expect(result.convertedAmount).toBe(0);
    });

    it('should handle large amounts (UZS)', () => {
      const rate = ExchangeRate.create('USD', 'UZS', 12500);
      const result = CurrencyConverterService.convert(1000, rate);

      expect(result.convertedAmount).toBe(12500000);
    });
  });

  describe('convertInverse', () => {
    it('should convert amount using inverse rate', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      const result = CurrencyConverterService.convertInverse(85, rate);

      expect(result.amount).toBe(85);
      expect(result.fromCurrency).toBe('EUR');
      expect(result.toCurrency).toBe('USD');
      expect(result.convertedAmount).toBeCloseTo(100, 2);
      expect(result.rate).toBeCloseTo(1 / 0.85, 10);
      expect(result.inverseRate).toBe(0.85);
    });
  });

  describe('convertCrossRate', () => {
    it('should convert through an intermediate currency', () => {
      const eurToUsd = ExchangeRate.create('EUR', 'USD', 1.1);
      const usdToGbp = ExchangeRate.create('USD', 'GBP', 0.79);

      const result = CurrencyConverterService.convertCrossRate(100, eurToUsd, usdToGbp);

      expect(result.amount).toBe(100);
      expect(result.fromCurrency).toBe('EUR');
      expect(result.toCurrency).toBe('GBP');
      // 100 EUR -> 110 USD -> 86.9 GBP
      expect(result.convertedAmount).toBeCloseTo(86.9, 1);
      expect(result.rate).toBeCloseTo(1.1 * 0.79, 10);
      expect(result.inverseRate).toBeCloseTo(1 / (1.1 * 0.79), 10);
    });
  });

  describe('calculateCrossRate', () => {
    it('should calculate cross rate for same base currency', () => {
      const usdToEur = ExchangeRate.create('USD', 'EUR', 0.85);
      const usdToGbp = ExchangeRate.create('USD', 'GBP', 0.79);

      const crossRate = CurrencyConverterService.calculateCrossRate(usdToEur, usdToGbp);

      // EUR/GBP = GBP_rate / EUR_rate = 0.79 / 0.85
      expect(crossRate).toBeCloseTo(0.79 / 0.85, 10);
    });

    it('should throw error when base currencies differ', () => {
      const usdToEur = ExchangeRate.create('USD', 'EUR', 0.85);
      const gbpToJpy = ExchangeRate.create('GBP', 'JPY', 190);

      expect(() => CurrencyConverterService.calculateCrossRate(usdToEur, gbpToJpy)).toThrow(
        'Cross rate calculation requires rates with the same base currency',
      );
    });
  });

  describe('areEquivalent', () => {
    it('should return true for equivalent amounts (direct)', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      const result = CurrencyConverterService.areEquivalent(100, 'USD', 85, 'EUR', rate);
      expect(result).toBe(true);
    });

    it('should return true for amounts within tolerance', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      const result = CurrencyConverterService.areEquivalent(100, 'USD', 85.005, 'EUR', rate, 0.01);
      expect(result).toBe(true);
    });

    it('should return false for amounts outside tolerance', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      const result = CurrencyConverterService.areEquivalent(100, 'USD', 86, 'EUR', rate, 0.01);
      expect(result).toBe(false);
    });

    it('should handle inverse direction (target to base)', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      // currency1=EUR (target), currency2=USD (base)
      const result = CurrencyConverterService.areEquivalent(85, 'EUR', 100, 'USD', rate);
      expect(result).toBe(true);
    });

    it('should throw error when currencies do not match exchange rate', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      expect(() => CurrencyConverterService.areEquivalent(100, 'GBP', 85, 'JPY', rate)).toThrow(
        'Exchange rate currencies do not match provided currencies',
      );
    });
  });
});
