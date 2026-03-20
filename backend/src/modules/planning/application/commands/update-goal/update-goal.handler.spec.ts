import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UpdateGoalHandler } from './update-goal.handler';
import { UpdateGoalCommand } from './update-goal.command';
import { Goal } from '../../../domain/aggregates/goal';
import { GOAL_REPOSITORY } from '../../../domain/repositories';

describe('UpdateGoalHandler', () => {
  let handler: UpdateGoalHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UpdateGoalHandler, { provide: GOAL_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<UpdateGoalHandler>(UpdateGoalHandler);
    jest.clearAllMocks();
  });

  it('should update a goal and return the response', async () => {
    const existingGoal = Goal.create('goal-1', 'user-1', 'Old Name', 10000, 'star', '#FFF');
    mockRepository.findById.mockResolvedValue(existingGoal);
    mockRepository.save.mockImplementation((goal) => Promise.resolve(goal));

    const command = new UpdateGoalCommand('goal-1', 'user-1', {
      name: 'New Name',
      targetAmount: 20000,
    });

    const result = await handler.execute(command);

    expect(result).toEqual(
      expect.objectContaining({
        id: 'goal-1',
        name: 'New Name',
        targetAmount: 20000,
      }),
    );
    expect(mockRepository.findById).toHaveBeenCalledWith('goal-1');
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException when goal does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    const command = new UpdateGoalCommand('nonexistent', 'user-1', { name: 'X' });

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when user does not own the goal', async () => {
    const goal = Goal.create('goal-1', 'user-1', 'My Goal', 10000, 'star', '#FFF');
    mockRepository.findById.mockResolvedValue(goal);

    const command = new UpdateGoalCommand('goal-1', 'other-user', { name: 'Steal' });

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
  });

  it('should update currentAmount and reflect new progress', async () => {
    const goal = Goal.create('goal-1', 'user-1', 'Savings', 10000, 'star', '#FFF', undefined, 0);
    mockRepository.findById.mockResolvedValue(goal);
    mockRepository.save.mockImplementation((g) => Promise.resolve(g));

    const command = new UpdateGoalCommand('goal-1', 'user-1', { currentAmount: 5000 });

    const result = await handler.execute(command);

    expect(result.currentAmount).toBe(5000);
    expect(result.progress).toBe(50);
  });
});
