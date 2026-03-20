import { ExchangeRate } from './exchange-rate.aggregate';

describe('ExchangeRate Aggregate', () => {
  describe('create', () => {
    it('should create a valid exchange rate', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);

      expect(rate.baseCurrency).toBe('USD');
      expect(rate.targetCurrency).toBe('EUR');
      expect(rate.rate).toBe(0.85);
      expect(rate.updatedAt).toBeInstanceOf(Date);
      expect(rate.id).toBe('USD:EUR');
    });

    it('should throw error for zero rate', () => {
      expect(() => ExchangeRate.create('USD', 'EUR', 0)).toThrow(
        'Exchange rate must be greater than zero',
      );
    });

    it('should throw error for negative rate', () => {
      expect(() => ExchangeRate.create('USD', 'EUR', -1.5)).toThrow(
        'Exchange rate must be greater than zero',
      );
    });

    it('should throw error for same currency pair', () => {
      expect(() => ExchangeRate.create('USD', 'USD', 1)).toThrow(
        'Base and target currencies must be different',
      );
    });

    it('should normalize currency codes to uppercase', () => {
      const rate = ExchangeRate.create('usd', 'eur', 0.85);
      expect(rate.baseCurrency).toBe('USD');
      expect(rate.targetCurrency).toBe('EUR');
    });
  });

  describe('updateRate', () => {
    it('should update the rate', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      const originalUpdatedAt = rate.updatedAt;

      // Small delay to ensure updatedAt changes
      rate.updateRate(0.9);

      expect(rate.rate).toBe(0.9);
      expect(rate.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    it('should throw error for zero rate update', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      expect(() => {
        rate.updateRate(0);
      }).toThrow('Exchange rate must be greater than zero');
    });

    it('should throw error for negative rate update', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      expect(() => {
        rate.updateRate(-0.5);
      }).toThrow('Exchange rate must be greater than zero');
    });
  });

  describe('getInverseRate', () => {
    it('should return inverse rate', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.5);
      expect(rate.getInverseRate()).toBe(2);
    });

    it('should return correct inverse for non-trivial rate', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      expect(rate.getInverseRate()).toBeCloseTo(1 / 0.85, 10);
    });
  });

  describe('convert', () => {
    it('should convert amount from base to target currency', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      expect(rate.convert(100)).toBeCloseTo(85, 2);
    });

    it('should handle zero amount', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      expect(rate.convert(0)).toBe(0);
    });

    it('should handle large amounts', () => {
      const rate = ExchangeRate.create('USD', 'UZS', 12500);
      expect(rate.convert(1000)).toBe(12500000);
    });

    it('should handle small fractional rates', () => {
      const rate = ExchangeRate.create('UZS', 'USD', 0.00008);
      expect(rate.convert(12500000)).toBeCloseTo(1000, 0);
    });
  });

  describe('convertReverse', () => {
    it('should convert amount from target to base currency', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      expect(rate.convertReverse(85)).toBeCloseTo(100, 2);
    });

    it('should handle zero amount', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      expect(rate.convertReverse(0)).toBe(0);
    });
  });

  describe('currencyPair', () => {
    it('should return a CurrencyPair value object', () => {
      const rate = ExchangeRate.create('USD', 'EUR', 0.85);
      const pair = rate.currencyPair;
      expect(pair.baseCurrency).toBe('USD');
      expect(pair.targetCurrency).toBe('EUR');
      expect(pair.toKey()).toBe('USD:EUR');
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from props', () => {
      const now = new Date();
      const rate = ExchangeRate.reconstitute({
        baseCurrency: 'EUR',
        targetCurrency: 'GBP',
        rate: 0.86,
        updatedAt: now,
      });

      expect(rate.baseCurrency).toBe('EUR');
      expect(rate.targetCurrency).toBe('GBP');
      expect(rate.rate).toBe(0.86);
      expect(rate.updatedAt).toBe(now);
      expect(rate.id).toBe('EUR:GBP');
    });
  });
});
