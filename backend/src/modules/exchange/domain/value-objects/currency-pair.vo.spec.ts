import { CurrencyPair } from './currency-pair.vo';

describe('CurrencyPair', () => {
  describe('create', () => {
    it('should create a valid currency pair', () => {
      const pair = CurrencyPair.create('USD', 'EUR');
      expect(pair.baseCurrency).toBe('USD');
      expect(pair.targetCurrency).toBe('EUR');
    });

    it('should normalize currency codes to uppercase', () => {
      const pair = CurrencyPair.create('usd', 'eur');
      expect(pair.baseCurrency).toBe('USD');
      expect(pair.targetCurrency).toBe('EUR');
    });

    it('should trim currency codes', () => {
      const pair = CurrencyPair.create(' USD ', ' EUR ');
      expect(pair.baseCurrency).toBe('USD');
      expect(pair.targetCurrency).toBe('EUR');
    });

    it('should throw error for empty base currency', () => {
      expect(() => CurrencyPair.create('', 'EUR')).toThrow(
        'Currency codes cannot be null or empty',
      );
    });

    it('should throw error for empty target currency', () => {
      expect(() => CurrencyPair.create('USD', '')).toThrow(
        'Currency codes cannot be null or empty',
      );
    });

    it('should throw error for invalid base currency code length', () => {
      expect(() => CurrencyPair.create('US', 'EUR')).toThrow('Invalid base currency code: US');
    });

    it('should throw error for invalid target currency code length', () => {
      expect(() => CurrencyPair.create('USD', 'EU')).toThrow('Invalid target currency code: EU');
    });

    it('should throw error for too long currency code', () => {
      expect(() => CurrencyPair.create('USDD', 'EUR')).toThrow('Invalid base currency code: USDD');
    });

    it('should throw error when base and target are the same', () => {
      expect(() => CurrencyPair.create('USD', 'USD')).toThrow(
        'Base and target currencies must be different',
      );
    });

    it('should throw error for same currencies case-insensitive', () => {
      expect(() => CurrencyPair.create('usd', 'USD')).toThrow(
        'Base and target currencies must be different',
      );
    });
  });

  describe('toKey', () => {
    it('should return composite key string', () => {
      const pair = CurrencyPair.create('USD', 'EUR');
      expect(pair.toKey()).toBe('USD:EUR');
    });
  });

  describe('inverse', () => {
    it('should return the inverse pair', () => {
      const pair = CurrencyPair.create('USD', 'EUR');
      const inverse = pair.inverse();
      expect(inverse.baseCurrency).toBe('EUR');
      expect(inverse.targetCurrency).toBe('USD');
    });
  });

  describe('toString', () => {
    it('should return formatted string', () => {
      const pair = CurrencyPair.create('USD', 'EUR');
      expect(pair.toString()).toBe('USD/EUR');
    });
  });

  describe('equals', () => {
    it('should be equal for same currencies', () => {
      const pair1 = CurrencyPair.create('USD', 'EUR');
      const pair2 = CurrencyPair.create('USD', 'EUR');
      expect(pair1.equals(pair2)).toBe(true);
    });

    it('should not be equal for different currencies', () => {
      const pair1 = CurrencyPair.create('USD', 'EUR');
      const pair2 = CurrencyPair.create('USD', 'GBP');
      expect(pair1.equals(pair2)).toBe(false);
    });
  });
});
