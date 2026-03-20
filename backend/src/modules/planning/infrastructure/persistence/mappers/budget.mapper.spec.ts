import { BudgetMapper } from './budget.mapper';
import { Budget } from '../../../domain/aggregates/budget';
import { BudgetOrmEntity } from '../typeorm/budget.orm-entity';

describe('BudgetMapper', () => {
  describe('toDomain', () => {
    it('should convert default budget ORM entity to domain aggregate', () => {
      const ormEntity = new BudgetOrmEntity();
      ormEntity.id = 'b-1';
      ormEntity.userId = 'user-1';
      ormEntity.year = null;
      ormEntity.month = null;
      ormEntity.amount = 50000 as unknown as number;
      ormEntity.currency = 'USD';
      ormEntity.isDefault = true;
      ormEntity.createdAt = new Date('2024-01-01');
      ormEntity.updatedAt = new Date('2024-06-01');

      const budget = BudgetMapper.toDomain(ormEntity);

      expect(budget).toBeInstanceOf(Budget);
      expect(budget.id).toBe('b-1');
      expect(budget.userId).toBe('user-1');
      expect(budget.year).toBeNull();
      expect(budget.month).toBeNull();
      expect(budget.amount).toBe(50000);
      expect(budget.currency).toBe('USD');
      expect(budget.isDefault).toBe(true);
      expect(budget.createdAt).toEqual(new Date('2024-01-01'));
      expect(budget.updatedAt).toEqual(new Date('2024-06-01'));
    });

    it('should convert override budget ORM entity to domain aggregate', () => {
      const ormEntity = new BudgetOrmEntity();
      ormEntity.id = 'b-2';
      ormEntity.userId = 'user-1';
      ormEntity.year = 2026;
      ormEntity.month = 3;
      ormEntity.amount = 60000 as unknown as number;
      ormEntity.currency = 'EUR';
      ormEntity.isDefault = false;
      ormEntity.createdAt = new Date('2024-01-01');
      ormEntity.updatedAt = new Date('2024-06-01');

      const budget = BudgetMapper.toDomain(ormEntity);

      expect(budget.year).toBe(2026);
      expect(budget.month).toBe(3);
      expect(budget.isDefault).toBe(false);
    });

    it('should handle string decimal amount from database', () => {
      const ormEntity = new BudgetOrmEntity();
      ormEntity.id = 'b-1';
      ormEntity.userId = 'user-1';
      ormEntity.year = null;
      ormEntity.month = null;
      ormEntity.amount = '75000.50' as unknown as number;
      ormEntity.currency = 'USD';
      ormEntity.isDefault = true;
      ormEntity.createdAt = new Date();
      ormEntity.updatedAt = new Date();

      const budget = BudgetMapper.toDomain(ormEntity);

      expect(budget.amount).toBe(75000.5);
    });
  });

  describe('toOrm', () => {
    it('should convert default budget domain aggregate to ORM entity', () => {
      const budget = Budget.createDefault('b-1', 'user-1', 50000, 'USD');

      const ormEntity = BudgetMapper.toOrm(budget);

      expect(ormEntity).toBeInstanceOf(BudgetOrmEntity);
      expect(ormEntity.id).toBe('b-1');
      expect(ormEntity.userId).toBe('user-1');
      expect(ormEntity.year).toBeNull();
      expect(ormEntity.month).toBeNull();
      expect(ormEntity.amount).toBe(50000);
      expect(ormEntity.currency).toBe('USD');
      expect(ormEntity.isDefault).toBe(true);
    });

    it('should convert override budget domain aggregate to ORM entity', () => {
      const budget = Budget.createOverride('b-2', 'user-1', 2026, 3, 60000, 'EUR');

      const ormEntity = BudgetMapper.toOrm(budget);

      expect(ormEntity.year).toBe(2026);
      expect(ormEntity.month).toBe(3);
      expect(ormEntity.amount).toBe(60000);
      expect(ormEntity.currency).toBe('EUR');
      expect(ormEntity.isDefault).toBe(false);
    });
  });

  describe('roundtrip', () => {
    it('should preserve data through toDomain -> toOrm cycle for default budget', () => {
      const original = new BudgetOrmEntity();
      original.id = 'b-1';
      original.userId = 'user-1';
      original.year = null;
      original.month = null;
      original.amount = 50000;
      original.currency = 'USD';
      original.isDefault = true;
      original.createdAt = new Date('2025-01-01');
      original.updatedAt = new Date('2025-06-01');

      const domain = BudgetMapper.toDomain(original);
      const result = BudgetMapper.toOrm(domain);

      expect(result.id).toBe(original.id);
      expect(result.userId).toBe(original.userId);
      expect(result.year).toBe(original.year);
      expect(result.month).toBe(original.month);
      expect(result.amount).toBe(Number(original.amount));
      expect(result.currency).toBe(original.currency);
      expect(result.isDefault).toBe(original.isDefault);
    });

    it('should preserve data through toDomain -> toOrm cycle for override budget', () => {
      const original = new BudgetOrmEntity();
      original.id = 'b-2';
      original.userId = 'user-1';
      original.year = 2026;
      original.month = 6;
      original.amount = 80000;
      original.currency = 'EUR';
      original.isDefault = false;
      original.createdAt = new Date('2025-01-01');
      original.updatedAt = new Date('2025-06-01');

      const domain = BudgetMapper.toDomain(original);
      const result = BudgetMapper.toOrm(domain);

      expect(result.id).toBe(original.id);
      expect(result.year).toBe(original.year);
      expect(result.month).toBe(original.month);
      expect(result.amount).toBe(Number(original.amount));
      expect(result.isDefault).toBe(original.isDefault);
    });
  });
});
