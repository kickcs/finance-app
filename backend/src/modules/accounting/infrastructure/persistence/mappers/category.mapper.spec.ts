import { CategoryMapper } from './category.mapper';
import { Category } from '../../../domain/aggregates/category';
import { CategoryOrmEntity } from '../typeorm/category.orm-entity';

describe('CategoryMapper', () => {
  describe('toDomain', () => {
    it('should map ORM entity to domain aggregate', () => {
      const orm = new CategoryOrmEntity();
      orm.id = 'cat-1';
      orm.userId = 'user-1';
      orm.name = 'Food';
      orm.icon = 'restaurant';
      orm.color = '#FF5733';
      orm.type = 'expense';
      orm.sortOrder = 3;
      orm.isFrequent = true;
      orm.createdAt = new Date('2026-01-01');

      const domain = CategoryMapper.toDomain(orm);

      expect(domain.id).toBe('cat-1');
      expect(domain.userId).toBe('user-1');
      expect(domain.name).toBe('Food');
      expect(domain.icon).toBe('restaurant');
      expect(domain.color).toBe('#FF5733');
      expect(domain.typeValue).toBe('expense');
      expect(domain.sortOrder).toBe(3);
      expect(domain.isFrequent).toBe(true);
    });

    it('should map income category', () => {
      const orm = new CategoryOrmEntity();
      orm.id = 'cat-2';
      orm.userId = 'user-1';
      orm.name = 'Salary';
      orm.icon = 'work';
      orm.color = '#00FF00';
      orm.type = 'income';
      orm.sortOrder = 0;
      orm.isFrequent = false;
      orm.createdAt = new Date();

      const domain = CategoryMapper.toDomain(orm);
      expect(domain.typeValue).toBe('income');
      expect(domain.isFrequent).toBe(false);
    });
  });

  describe('toOrm', () => {
    it('should map domain aggregate to ORM entity', () => {
      const category = Category.create(
        'cat-1',
        'user-1',
        'Food',
        'restaurant',
        '#FF5733',
        'expense',
        3,
        true,
      );

      const orm = CategoryMapper.toOrm(category);

      expect(orm.id).toBe('cat-1');
      expect(orm.userId).toBe('user-1');
      expect(orm.name).toBe('Food');
      expect(orm.icon).toBe('restaurant');
      expect(orm.color).toBe('#FF5733');
      expect(orm.type).toBe('expense');
      expect(orm.sortOrder).toBe(3);
      expect(orm.isFrequent).toBe(true);
    });
  });

  describe('round-trip', () => {
    it('should preserve data through toDomain -> toOrm', () => {
      const originalOrm = new CategoryOrmEntity();
      originalOrm.id = 'cat-1';
      originalOrm.userId = 'user-1';
      originalOrm.name = 'Transport';
      originalOrm.icon = 'bus';
      originalOrm.color = '#123456';
      originalOrm.type = 'expense';
      originalOrm.sortOrder = 5;
      originalOrm.isFrequent = false;
      originalOrm.createdAt = new Date('2026-02-15');

      const domain = CategoryMapper.toDomain(originalOrm);
      const resultOrm = CategoryMapper.toOrm(domain);

      expect(resultOrm.id).toBe(originalOrm.id);
      expect(resultOrm.userId).toBe(originalOrm.userId);
      expect(resultOrm.name).toBe(originalOrm.name);
      expect(resultOrm.icon).toBe(originalOrm.icon);
      expect(resultOrm.color).toBe(originalOrm.color);
      expect(resultOrm.type).toBe(originalOrm.type);
      expect(resultOrm.sortOrder).toBe(originalOrm.sortOrder);
      expect(resultOrm.isFrequent).toBe(originalOrm.isFrequent);
    });
  });
});
