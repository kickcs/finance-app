import { QuickActionMapper } from './quick-action.mapper';
import { QuickAction } from '../../../domain/aggregates/quick-action';
import { QuickActionOrmEntity } from '../typeorm/quick-action.orm-entity';

describe('QuickActionMapper', () => {
  const now = new Date('2026-03-20T12:00:00Z');

  describe('toDomain', () => {
    it('should map ORM entity to domain aggregate', () => {
      const orm = new QuickActionOrmEntity();
      orm.id = 'qa-1';
      orm.userId = 'user-1';
      orm.categoryId = 'cat-food';
      orm.accountId = 'acc-1';
      orm.label = 'Quick Lunch';
      orm.position = 2;
      orm.createdAt = now;
      orm.updatedAt = now;

      const domain = QuickActionMapper.toDomain(orm);

      expect(domain.id).toBe('qa-1');
      expect(domain.userId).toBe('user-1');
      expect(domain.categoryId).toBe('cat-food');
      expect(domain.accountId).toBe('acc-1');
      expect(domain.label).toBe('Quick Lunch');
      expect(domain.position).toBe(2);
    });
  });

  describe('toOrm', () => {
    it('should map domain aggregate to ORM entity', () => {
      const qa = QuickAction.create('qa-1', 'user-1', 'cat-food', 'acc-1', 'Quick Lunch', 2);

      const orm = QuickActionMapper.toOrm(qa);

      expect(orm.id).toBe('qa-1');
      expect(orm.userId).toBe('user-1');
      expect(orm.categoryId).toBe('cat-food');
      expect(orm.accountId).toBe('acc-1');
      expect(orm.label).toBe('Quick Lunch');
      expect(orm.position).toBe(2);
    });
  });

  describe('round-trip', () => {
    it('should preserve data through toDomain -> toOrm', () => {
      const originalOrm = new QuickActionOrmEntity();
      originalOrm.id = 'qa-1';
      originalOrm.userId = 'user-1';
      originalOrm.categoryId = 'cat-transport';
      originalOrm.accountId = 'acc-2';
      originalOrm.label = 'Bus fare';
      originalOrm.position = 0;
      originalOrm.createdAt = now;
      originalOrm.updatedAt = now;

      const domain = QuickActionMapper.toDomain(originalOrm);
      const resultOrm = QuickActionMapper.toOrm(domain);

      expect(resultOrm.id).toBe(originalOrm.id);
      expect(resultOrm.userId).toBe(originalOrm.userId);
      expect(resultOrm.categoryId).toBe(originalOrm.categoryId);
      expect(resultOrm.accountId).toBe(originalOrm.accountId);
      expect(resultOrm.label).toBe(originalOrm.label);
      expect(resultOrm.position).toBe(originalOrm.position);
    });
  });
});
