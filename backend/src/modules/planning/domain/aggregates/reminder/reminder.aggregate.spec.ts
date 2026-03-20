import { Reminder } from './reminder.aggregate';

describe('Reminder Aggregate', () => {
  const createTestReminder = () => {
    return Reminder.create(
      'reminder-1',
      'user-1',
      'Rent Payment',
      1500,
      'monthly',
      new Date('2026-04-01'),
      'home',
      '#FF0000',
    );
  };

  describe('create', () => {
    it('should create a reminder with all properties', () => {
      const nextDate = new Date('2026-04-01');
      const reminder = Reminder.create(
        'reminder-1',
        'user-1',
        'Rent',
        1500,
        'monthly',
        nextDate,
        'home',
        '#FF0000',
      );

      expect(reminder.id).toBe('reminder-1');
      expect(reminder.userId).toBe('user-1');
      expect(reminder.name).toBe('Rent');
      expect(reminder.amount).toBe(1500);
      expect(reminder.frequency).toBe('monthly');
      expect(reminder.nextDate).toEqual(nextDate);
      expect(reminder.icon).toBe('home');
      expect(reminder.color).toBe('#FF0000');
      expect(reminder.isActive).toBe(true);
      expect(reminder.createdAt).toBeInstanceOf(Date);
    });

    it('should create reminder with weekly frequency', () => {
      const reminder = Reminder.create(
        'r-1',
        'user-1',
        'Grocery',
        200,
        'weekly',
        new Date(),
        'cart',
        '#00FF00',
      );

      expect(reminder.frequency).toBe('weekly');
    });

    it('should create reminder with yearly frequency', () => {
      const reminder = Reminder.create(
        'r-1',
        'user-1',
        'Insurance',
        5000,
        'yearly',
        new Date(),
        'shield',
        '#0000FF',
      );

      expect(reminder.frequency).toBe('yearly');
    });

    it('should create reminder with once frequency', () => {
      const reminder = Reminder.create(
        'r-1',
        'user-1',
        'One-time',
        100,
        'once',
        new Date(),
        'star',
        '#FFF',
      );

      expect(reminder.frequency).toBe('once');
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a reminder from props', () => {
      const createdAt = new Date('2024-01-01');
      const nextDate = new Date('2026-05-01');
      const reminder = Reminder.reconstitute({
        id: 'reminder-1',
        userId: 'user-1',
        name: 'Sub',
        amount: 10,
        frequency: 'monthly',
        nextDate,
        icon: 'tv',
        color: '#123456',
        isActive: false,
        createdAt,
      });

      expect(reminder.id).toBe('reminder-1');
      expect(reminder.isActive).toBe(false);
      expect(reminder.createdAt).toEqual(createdAt);
    });
  });

  describe('isDue', () => {
    it('should return true when nextDate is in the past', () => {
      const reminder = Reminder.reconstitute({
        id: 'r-1',
        userId: 'user-1',
        name: 'Past',
        amount: 100,
        frequency: 'monthly',
        nextDate: new Date('2020-01-01'),
        icon: 'clock',
        color: '#FFF',
        isActive: true,
        createdAt: new Date('2019-01-01'),
      });

      expect(reminder.isDue).toBe(true);
    });

    it('should return false when nextDate is in the future', () => {
      const reminder = Reminder.reconstitute({
        id: 'r-1',
        userId: 'user-1',
        name: 'Future',
        amount: 100,
        frequency: 'monthly',
        nextDate: new Date('2099-01-01'),
        icon: 'clock',
        color: '#FFF',
        isActive: true,
        createdAt: new Date(),
      });

      expect(reminder.isDue).toBe(false);
    });
  });

  describe('update', () => {
    it('should update name', () => {
      const reminder = createTestReminder();
      reminder.update({ name: 'Updated Rent' });

      expect(reminder.name).toBe('Updated Rent');
    });

    it('should update amount', () => {
      const reminder = createTestReminder();
      reminder.update({ amount: 2000 });

      expect(reminder.amount).toBe(2000);
    });

    it('should update frequency', () => {
      const reminder = createTestReminder();
      reminder.update({ frequency: 'weekly' });

      expect(reminder.frequency).toBe('weekly');
    });

    it('should update nextDate', () => {
      const reminder = createTestReminder();
      const newDate = new Date('2026-05-01');
      reminder.update({ nextDate: newDate });

      expect(reminder.nextDate).toEqual(newDate);
    });

    it('should update isActive', () => {
      const reminder = createTestReminder();
      reminder.update({ isActive: false });

      expect(reminder.isActive).toBe(false);
    });

    it('should update icon and color', () => {
      const reminder = createTestReminder();
      reminder.update({ icon: 'bell', color: '#000' });

      expect(reminder.icon).toBe('bell');
      expect(reminder.color).toBe('#000');
    });

    it('should not change fields that are not provided', () => {
      const reminder = createTestReminder();
      const originalName = reminder.name;
      reminder.update({ amount: 999 });

      expect(reminder.name).toBe(originalName);
      expect(reminder.amount).toBe(999);
    });
  });

  describe('activate / deactivate', () => {
    it('should activate a reminder', () => {
      const reminder = Reminder.reconstitute({
        id: 'r-1',
        userId: 'user-1',
        name: 'Test',
        amount: 100,
        frequency: 'monthly',
        nextDate: new Date(),
        icon: 'star',
        color: '#FFF',
        isActive: false,
        createdAt: new Date(),
      });

      reminder.activate();
      expect(reminder.isActive).toBe(true);
    });

    it('should deactivate a reminder', () => {
      const reminder = createTestReminder();

      reminder.deactivate();
      expect(reminder.isActive).toBe(false);
    });
  });

  describe('advanceNextDate', () => {
    it('should deactivate a one-time reminder', () => {
      const reminder = Reminder.create(
        'r-1',
        'user-1',
        'One-time',
        100,
        'once',
        new Date('2026-04-01'),
        'star',
        '#FFF',
      );

      reminder.advanceNextDate();

      expect(reminder.isActive).toBe(false);
    });

    it('should advance weekly reminder by 7 days', () => {
      const reminder = Reminder.create(
        'r-1',
        'user-1',
        'Weekly',
        100,
        'weekly',
        new Date('2026-04-01'),
        'star',
        '#FFF',
      );

      reminder.advanceNextDate();

      expect(reminder.nextDate).toEqual(new Date('2026-04-08'));
      expect(reminder.isActive).toBe(true);
    });

    it('should advance monthly reminder by 1 month', () => {
      const reminder = Reminder.create(
        'r-1',
        'user-1',
        'Monthly',
        100,
        'monthly',
        new Date('2026-04-01'),
        'star',
        '#FFF',
      );

      reminder.advanceNextDate();

      expect(reminder.nextDate).toEqual(new Date('2026-05-01'));
    });

    it('should advance yearly reminder by 1 year', () => {
      const reminder = Reminder.create(
        'r-1',
        'user-1',
        'Yearly',
        100,
        'yearly',
        new Date('2026-04-01'),
        'star',
        '#FFF',
      );

      reminder.advanceNextDate();

      expect(reminder.nextDate).toEqual(new Date('2027-04-01'));
    });
  });
});
