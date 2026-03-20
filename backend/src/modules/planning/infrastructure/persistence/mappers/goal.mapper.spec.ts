import { GoalMapper } from './goal.mapper';
import { Goal } from '../../../domain/aggregates/goal';
import { GoalOrmEntity } from '../typeorm/goal.orm-entity';

describe('GoalMapper', () => {
  describe('toDomain', () => {
    it('should convert ORM entity to domain aggregate', () => {
      const ormEntity = new GoalOrmEntity();
      ormEntity.id = 'goal-1';
      ormEntity.userId = 'user-1';
      ormEntity.name = 'Vacation';
      ormEntity.targetAmount = 10000 as unknown as number; // decimal comes as string from DB
      ormEntity.currentAmount = 2500 as unknown as number;
      ormEntity.deadline = new Date('2026-12-31');
      ormEntity.icon = 'beach';
      ormEntity.color = '#FF5733';
      ormEntity.createdAt = new Date('2024-01-01');

      const goal = GoalMapper.toDomain(ormEntity);

      expect(goal).toBeInstanceOf(Goal);
      expect(goal.id).toBe('goal-1');
      expect(goal.userId).toBe('user-1');
      expect(goal.name).toBe('Vacation');
      expect(goal.targetAmount).toBe(10000);
      expect(goal.currentAmount).toBe(2500);
      expect(goal.deadline).toEqual(new Date('2026-12-31'));
      expect(goal.icon).toBe('beach');
      expect(goal.color).toBe('#FF5733');
      expect(goal.createdAt).toEqual(new Date('2024-01-01'));
    });

    it('should handle string decimal values from database', () => {
      const ormEntity = new GoalOrmEntity();
      ormEntity.id = 'goal-1';
      ormEntity.userId = 'user-1';
      ormEntity.name = 'Test';
      ormEntity.targetAmount = '15000.50' as unknown as number;
      ormEntity.currentAmount = '3000.25' as unknown as number;
      ormEntity.deadline = null;
      ormEntity.icon = 'star';
      ormEntity.color = '#000';
      ormEntity.createdAt = new Date();

      const goal = GoalMapper.toDomain(ormEntity);

      expect(goal.targetAmount).toBe(15000.5);
      expect(goal.currentAmount).toBe(3000.25);
    });

    it('should handle null deadline', () => {
      const ormEntity = new GoalOrmEntity();
      ormEntity.id = 'goal-1';
      ormEntity.userId = 'user-1';
      ormEntity.name = 'No Deadline';
      ormEntity.targetAmount = 5000 as unknown as number;
      ormEntity.currentAmount = 0 as unknown as number;
      ormEntity.deadline = null;
      ormEntity.icon = 'star';
      ormEntity.color = '#FFF';
      ormEntity.createdAt = new Date();

      const goal = GoalMapper.toDomain(ormEntity);

      expect(goal.deadline).toBeNull();
    });
  });

  describe('toOrm', () => {
    it('should convert domain aggregate to ORM entity', () => {
      const deadline = new Date('2026-12-31');
      const goal = Goal.create(
        'goal-1',
        'user-1',
        'Vacation',
        10000,
        'beach',
        '#FF5733',
        deadline,
        2500,
      );

      const ormEntity = GoalMapper.toOrm(goal);

      expect(ormEntity).toBeInstanceOf(GoalOrmEntity);
      expect(ormEntity.id).toBe('goal-1');
      expect(ormEntity.userId).toBe('user-1');
      expect(ormEntity.name).toBe('Vacation');
      expect(ormEntity.targetAmount).toBe(10000);
      expect(ormEntity.currentAmount).toBe(2500);
      expect(ormEntity.deadline).toEqual(deadline);
      expect(ormEntity.icon).toBe('beach');
      expect(ormEntity.color).toBe('#FF5733');
    });

    it('should handle goal without deadline', () => {
      const goal = Goal.create('goal-1', 'user-1', 'Fund', 5000, 'piggy', '#00FF00');

      const ormEntity = GoalMapper.toOrm(goal);

      expect(ormEntity.deadline).toBeNull();
    });
  });

  describe('roundtrip', () => {
    it('should preserve data through toDomain -> toOrm cycle', () => {
      const original = new GoalOrmEntity();
      original.id = 'goal-1';
      original.userId = 'user-1';
      original.name = 'Roundtrip';
      original.targetAmount = 99999;
      original.currentAmount = 12345;
      original.deadline = new Date('2027-06-15');
      original.icon = 'trophy';
      original.color = '#ABCDEF';
      original.createdAt = new Date('2025-01-01');

      const domain = GoalMapper.toDomain(original);
      const result = GoalMapper.toOrm(domain);

      expect(result.id).toBe(original.id);
      expect(result.userId).toBe(original.userId);
      expect(result.name).toBe(original.name);
      expect(result.targetAmount).toBe(Number(original.targetAmount));
      expect(result.currentAmount).toBe(Number(original.currentAmount));
      expect(result.deadline).toEqual(original.deadline);
      expect(result.icon).toBe(original.icon);
      expect(result.color).toBe(original.color);
    });
  });
});
