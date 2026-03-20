import { Budget } from './budget.aggregate';

describe('Budget Aggregate', () => {
  describe('createDefault', () => {
    it('should create a default budget', () => {
      const budget = Budget.createDefault('b-1', 'user-1', 50000, 'USD');

      expect(budget.id).toBe('b-1');
      expect(budget.userId).toBe('user-1');
      expect(budget.amount).toBe(50000);
      expect(budget.currency).toBe('USD');
      expect(budget.isDefault).toBe(true);
      expect(budget.year).toBeNull();
      expect(budget.month).toBeNull();
      expect(budget.createdAt).toBeInstanceOf(Date);
      expect(budget.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw if amount is 0', () => {
      expect(() => Budget.createDefault('b-1', 'user-1', 0, 'USD')).toThrow(
        'Budget amount must be greater than 0',
      );
    });

    it('should throw if amount is negative', () => {
      expect(() => Budget.createDefault('b-1', 'user-1', -100, 'USD')).toThrow(
        'Budget amount must be greater than 0',
      );
    });
  });

  describe('createOverride', () => {
    it('should create a monthly override budget', () => {
      const budget = Budget.createOverride('b-2', 'user-1', 2026, 3, 60000, 'EUR');

      expect(budget.id).toBe('b-2');
      expect(budget.userId).toBe('user-1');
      expect(budget.year).toBe(2026);
      expect(budget.month).toBe(3);
      expect(budget.amount).toBe(60000);
      expect(budget.currency).toBe('EUR');
      expect(budget.isDefault).toBe(false);
    });

    it('should throw if month is less than 1', () => {
      expect(() => Budget.createOverride('b-2', 'user-1', 2026, 0, 5000, 'USD')).toThrow(
        'Month must be between 1 and 12',
      );
    });

    it('should throw if month is greater than 12', () => {
      expect(() => Budget.createOverride('b-2', 'user-1', 2026, 13, 5000, 'USD')).toThrow(
        'Month must be between 1 and 12',
      );
    });

    it('should throw if amount is 0', () => {
      expect(() => Budget.createOverride('b-2', 'user-1', 2026, 6, 0, 'USD')).toThrow(
        'Budget amount must be greater than 0',
      );
    });

    it('should throw if amount is negative', () => {
      expect(() => Budget.createOverride('b-2', 'user-1', 2026, 6, -500, 'USD')).toThrow(
        'Budget amount must be greater than 0',
      );
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a budget from props', () => {
      const createdAt = new Date('2024-01-01');
      const updatedAt = new Date('2024-06-01');
      const budget = Budget.reconstitute({
        id: 'b-1',
        userId: 'user-1',
        year: 2024,
        month: 6,
        amount: 30000,
        currency: 'UZS',
        isDefault: false,
        createdAt,
        updatedAt,
      });

      expect(budget.id).toBe('b-1');
      expect(budget.year).toBe(2024);
      expect(budget.month).toBe(6);
      expect(budget.amount).toBe(30000);
      expect(budget.currency).toBe('UZS');
      expect(budget.isDefault).toBe(false);
      expect(budget.createdAt).toEqual(createdAt);
      expect(budget.updatedAt).toEqual(updatedAt);
    });
  });

  describe('updateAmount', () => {
    it('should update amount and currency', () => {
      const budget = Budget.createDefault('b-1', 'user-1', 50000, 'USD');
      const beforeUpdate = budget.updatedAt;

      budget.updateAmount(70000, 'EUR');

      expect(budget.amount).toBe(70000);
      expect(budget.currency).toBe('EUR');
      expect(budget.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should throw if new amount is 0', () => {
      const budget = Budget.createDefault('b-1', 'user-1', 50000, 'USD');

      expect(() => {
        budget.updateAmount(0, 'USD');
      }).toThrow('Budget amount must be greater than 0');
    });

    it('should throw if new amount is negative', () => {
      const budget = Budget.createDefault('b-1', 'user-1', 50000, 'USD');

      expect(() => {
        budget.updateAmount(-1, 'USD');
      }).toThrow('Budget amount must be greater than 0');
    });
  });
});
