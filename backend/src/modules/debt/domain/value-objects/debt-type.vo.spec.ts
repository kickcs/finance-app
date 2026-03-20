import { DebtType } from './debt-type.vo';

describe('DebtType', () => {
  describe('create', () => {
    it('should create a "given" debt type', () => {
      const debtType = DebtType.create('given');
      expect(debtType.value).toBe('given');
      expect(debtType.isGiven()).toBe(true);
      expect(debtType.isTaken()).toBe(false);
    });

    it('should create a "taken" debt type', () => {
      const debtType = DebtType.create('taken');
      expect(debtType.value).toBe('taken');
      expect(debtType.isTaken()).toBe(true);
      expect(debtType.isGiven()).toBe(false);
    });

    it('should throw error for invalid debt type', () => {
      expect(() => DebtType.create('invalid')).toThrow('Invalid debt type: invalid');
    });

    it('should throw error for empty string', () => {
      expect(() => DebtType.create('')).toThrow('Invalid debt type: ');
    });
  });

  describe('static instances', () => {
    it('should have a GIVEN constant', () => {
      expect(DebtType.GIVEN.value).toBe('given');
      expect(DebtType.GIVEN.isGiven()).toBe(true);
    });

    it('should have a TAKEN constant', () => {
      expect(DebtType.TAKEN.value).toBe('taken');
      expect(DebtType.TAKEN.isTaken()).toBe(true);
    });
  });

  describe('toString', () => {
    it('should return the string value', () => {
      const debtType = DebtType.create('given');
      expect(debtType.toString()).toBe('given');
    });
  });
});
