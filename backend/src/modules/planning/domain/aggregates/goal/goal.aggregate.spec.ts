import { Goal } from './goal.aggregate';

describe('Goal Aggregate', () => {
  const createTestGoal = () => {
    return Goal.create(
      'goal-1',
      'user-1',
      'Vacation Fund',
      10000,
      'beach',
      '#FF5733',
      new Date('2026-12-31'),
      0,
    );
  };

  describe('create', () => {
    it('should create a goal with all properties', () => {
      const deadline = new Date('2026-12-31');
      const goal = Goal.create(
        'goal-1',
        'user-1',
        'Vacation',
        10000,
        'beach',
        '#FF5733',
        deadline,
        500,
      );

      expect(goal.id).toBe('goal-1');
      expect(goal.userId).toBe('user-1');
      expect(goal.name).toBe('Vacation');
      expect(goal.targetAmount).toBe(10000);
      expect(goal.currentAmount).toBe(500);
      expect(goal.deadline).toEqual(deadline);
      expect(goal.icon).toBe('beach');
      expect(goal.color).toBe('#FF5733');
      expect(goal.createdAt).toBeInstanceOf(Date);
    });

    it('should create a goal with default currentAmount of 0', () => {
      const goal = Goal.create('goal-1', 'user-1', 'Savings', 5000, 'piggy', '#00FF00');

      expect(goal.currentAmount).toBe(0);
    });

    it('should create a goal without a deadline', () => {
      const goal = Goal.create('goal-1', 'user-1', 'Savings', 5000, 'piggy', '#00FF00');

      expect(goal.deadline).toBeNull();
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a goal from props', () => {
      const createdAt = new Date('2024-01-01');
      const deadline = new Date('2026-06-15');
      const goal = Goal.reconstitute({
        id: 'goal-1',
        userId: 'user-1',
        name: 'House',
        targetAmount: 100000,
        currentAmount: 25000,
        deadline,
        icon: 'house',
        color: '#0000FF',
        createdAt,
      });

      expect(goal.id).toBe('goal-1');
      expect(goal.userId).toBe('user-1');
      expect(goal.name).toBe('House');
      expect(goal.targetAmount).toBe(100000);
      expect(goal.currentAmount).toBe(25000);
      expect(goal.deadline).toEqual(deadline);
      expect(goal.createdAt).toEqual(createdAt);
    });
  });

  describe('progress', () => {
    it('should return 0 when targetAmount is 0', () => {
      const goal = Goal.create('goal-1', 'user-1', 'Empty', 0, 'star', '#FFF');

      expect(goal.progress).toBe(0);
    });

    it('should calculate correct progress percentage', () => {
      const goal = Goal.create(
        'goal-1',
        'user-1',
        'Savings',
        10000,
        'star',
        '#FFF',
        undefined,
        2500,
      );

      expect(goal.progress).toBe(25);
    });

    it('should cap progress at 100% for over-contributions', () => {
      const goal = Goal.create(
        'goal-1',
        'user-1',
        'Savings',
        1000,
        'star',
        '#FFF',
        undefined,
        1500,
      );

      expect(goal.progress).toBe(100);
    });

    it('should return 100% when target equals current', () => {
      const goal = Goal.create('goal-1', 'user-1', 'Done', 5000, 'star', '#FFF', undefined, 5000);

      expect(goal.progress).toBe(100);
    });
  });

  describe('isCompleted', () => {
    it('should return false when currentAmount < targetAmount', () => {
      const goal = Goal.create(
        'goal-1',
        'user-1',
        'Savings',
        10000,
        'star',
        '#FFF',
        undefined,
        5000,
      );

      expect(goal.isCompleted).toBe(false);
    });

    it('should return true when currentAmount >= targetAmount', () => {
      const goal = Goal.create('goal-1', 'user-1', 'Done', 1000, 'star', '#FFF', undefined, 1000);

      expect(goal.isCompleted).toBe(true);
    });

    it('should return true when currentAmount exceeds targetAmount', () => {
      const goal = Goal.create('goal-1', 'user-1', 'Over', 1000, 'star', '#FFF', undefined, 2000);

      expect(goal.isCompleted).toBe(true);
    });
  });

  describe('update', () => {
    it('should update name', () => {
      const goal = createTestGoal();
      goal.update({ name: 'New Name' });

      expect(goal.name).toBe('New Name');
    });

    it('should update targetAmount', () => {
      const goal = createTestGoal();
      goal.update({ targetAmount: 20000 });

      expect(goal.targetAmount).toBe(20000);
    });

    it('should update currentAmount', () => {
      const goal = createTestGoal();
      goal.update({ currentAmount: 5000 });

      expect(goal.currentAmount).toBe(5000);
    });

    it('should update deadline to a new date', () => {
      const goal = createTestGoal();
      const newDeadline = new Date('2027-06-01');
      goal.update({ deadline: newDeadline });

      expect(goal.deadline).toEqual(newDeadline);
    });

    it('should update deadline to null', () => {
      const goal = createTestGoal();
      goal.update({ deadline: null });

      expect(goal.deadline).toBeNull();
    });

    it('should update icon and color', () => {
      const goal = createTestGoal();
      goal.update({ icon: 'car', color: '#000000' });

      expect(goal.icon).toBe('car');
      expect(goal.color).toBe('#000000');
    });

    it('should not change fields that are not provided', () => {
      const goal = createTestGoal();
      const originalName = goal.name;
      const originalTarget = goal.targetAmount;

      goal.update({ icon: 'plane' });

      expect(goal.name).toBe(originalName);
      expect(goal.targetAmount).toBe(originalTarget);
      expect(goal.icon).toBe('plane');
    });
  });

  describe('addAmount', () => {
    it('should add amount to currentAmount', () => {
      const goal = Goal.create(
        'goal-1',
        'user-1',
        'Savings',
        10000,
        'star',
        '#FFF',
        undefined,
        1000,
      );
      goal.addAmount(500);

      expect(goal.currentAmount).toBe(1500);
    });

    it('should allow currentAmount to exceed targetAmount', () => {
      const goal = Goal.create('goal-1', 'user-1', 'Savings', 1000, 'star', '#FFF', undefined, 900);
      goal.addAmount(500);

      expect(goal.currentAmount).toBe(1400);
    });
  });

  describe('withdrawAmount', () => {
    it('should subtract amount from currentAmount', () => {
      const goal = Goal.create(
        'goal-1',
        'user-1',
        'Savings',
        10000,
        'star',
        '#FFF',
        undefined,
        5000,
      );
      goal.withdrawAmount(2000);

      expect(goal.currentAmount).toBe(3000);
    });

    it('should not go below 0', () => {
      const goal = Goal.create(
        'goal-1',
        'user-1',
        'Savings',
        10000,
        'star',
        '#FFF',
        undefined,
        500,
      );
      goal.withdrawAmount(1000);

      expect(goal.currentAmount).toBe(0);
    });
  });
});
