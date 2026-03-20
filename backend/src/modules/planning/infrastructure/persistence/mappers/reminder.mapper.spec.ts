import { ReminderMapper } from './reminder.mapper';
import { Reminder } from '../../../domain/aggregates/reminder';
import { ReminderOrmEntity } from '../typeorm/reminder.orm-entity';

describe('ReminderMapper', () => {
  describe('toDomain', () => {
    it('should convert ORM entity to domain aggregate', () => {
      const ormEntity = new ReminderOrmEntity();
      ormEntity.id = 'r-1';
      ormEntity.userId = 'user-1';
      ormEntity.name = 'Rent';
      ormEntity.amount = 1500 as unknown as number;
      ormEntity.frequency = 'monthly';
      ormEntity.nextDate = new Date('2026-04-01');
      ormEntity.icon = 'home';
      ormEntity.color = '#FF0000';
      ormEntity.isActive = true;
      ormEntity.createdAt = new Date('2024-01-01');

      const reminder = ReminderMapper.toDomain(ormEntity);

      expect(reminder).toBeInstanceOf(Reminder);
      expect(reminder.id).toBe('r-1');
      expect(reminder.userId).toBe('user-1');
      expect(reminder.name).toBe('Rent');
      expect(reminder.amount).toBe(1500);
      expect(reminder.frequency).toBe('monthly');
      expect(reminder.nextDate).toEqual(new Date('2026-04-01'));
      expect(reminder.icon).toBe('home');
      expect(reminder.color).toBe('#FF0000');
      expect(reminder.isActive).toBe(true);
    });

    it('should handle string decimal amount from database', () => {
      const ormEntity = new ReminderOrmEntity();
      ormEntity.id = 'r-1';
      ormEntity.userId = 'user-1';
      ormEntity.name = 'Test';
      ormEntity.amount = '250.75' as unknown as number;
      ormEntity.frequency = 'weekly';
      ormEntity.nextDate = new Date();
      ormEntity.icon = 'star';
      ormEntity.color = '#000';
      ormEntity.isActive = true;
      ormEntity.createdAt = new Date();

      const reminder = ReminderMapper.toDomain(ormEntity);

      expect(reminder.amount).toBe(250.75);
    });

    it('should handle inactive reminder', () => {
      const ormEntity = new ReminderOrmEntity();
      ormEntity.id = 'r-1';
      ormEntity.userId = 'user-1';
      ormEntity.name = 'Inactive';
      ormEntity.amount = 100 as unknown as number;
      ormEntity.frequency = 'once';
      ormEntity.nextDate = new Date();
      ormEntity.icon = 'star';
      ormEntity.color = '#FFF';
      ormEntity.isActive = false;
      ormEntity.createdAt = new Date();

      const reminder = ReminderMapper.toDomain(ormEntity);

      expect(reminder.isActive).toBe(false);
    });
  });

  describe('toOrm', () => {
    it('should convert domain aggregate to ORM entity', () => {
      const nextDate = new Date('2026-04-01');
      const reminder = Reminder.create(
        'r-1',
        'user-1',
        'Rent',
        1500,
        'monthly',
        nextDate,
        'home',
        '#FF0000',
      );

      const ormEntity = ReminderMapper.toOrm(reminder);

      expect(ormEntity).toBeInstanceOf(ReminderOrmEntity);
      expect(ormEntity.id).toBe('r-1');
      expect(ormEntity.userId).toBe('user-1');
      expect(ormEntity.name).toBe('Rent');
      expect(ormEntity.amount).toBe(1500);
      expect(ormEntity.frequency).toBe('monthly');
      expect(ormEntity.nextDate).toEqual(nextDate);
      expect(ormEntity.icon).toBe('home');
      expect(ormEntity.color).toBe('#FF0000');
      expect(ormEntity.isActive).toBe(true);
    });
  });

  describe('roundtrip', () => {
    it('should preserve data through toDomain -> toOrm cycle', () => {
      const original = new ReminderOrmEntity();
      original.id = 'r-1';
      original.userId = 'user-1';
      original.name = 'Roundtrip';
      original.amount = 999;
      original.frequency = 'yearly';
      original.nextDate = new Date('2027-01-01');
      original.icon = 'gift';
      original.color = '#123ABC';
      original.isActive = true;
      original.createdAt = new Date('2025-01-01');

      const domain = ReminderMapper.toDomain(original);
      const result = ReminderMapper.toOrm(domain);

      expect(result.id).toBe(original.id);
      expect(result.userId).toBe(original.userId);
      expect(result.name).toBe(original.name);
      expect(result.amount).toBe(Number(original.amount));
      expect(result.frequency).toBe(original.frequency);
      expect(result.nextDate).toEqual(original.nextDate);
      expect(result.icon).toBe(original.icon);
      expect(result.color).toBe(original.color);
      expect(result.isActive).toBe(original.isActive);
    });
  });
});
