import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { DeleteGoalHandler } from './delete-goal.handler';
import { DeleteGoalCommand } from './delete-goal.command';
import { Goal } from '../../../domain/aggregates/goal';
import { GOAL_REPOSITORY } from '../../../domain/repositories';

describe('DeleteGoalHandler', () => {
  let handler: DeleteGoalHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeleteGoalHandler, { provide: GOAL_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<DeleteGoalHandler>(DeleteGoalHandler);
    jest.clearAllMocks();
  });

  it('should delete a goal successfully', async () => {
    const goal = Goal.create('goal-1', 'user-1', 'To Delete', 10000, 'trash', '#F00');
    mockRepository.findById.mockResolvedValue(goal);
    mockRepository.delete.mockResolvedValue(undefined);

    const command = new DeleteGoalCommand('goal-1', 'user-1');

    await handler.execute(command);

    expect(mockRepository.findById).toHaveBeenCalledWith('goal-1');
    expect(mockRepository.delete).toHaveBeenCalledWith('goal-1');
  });

  it('should throw NotFoundException when goal does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    const command = new DeleteGoalCommand('nonexistent', 'user-1');

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when user does not own the goal', async () => {
    const goal = Goal.create('goal-1', 'user-1', 'Not Yours', 5000, 'lock', '#F00');
    mockRepository.findById.mockResolvedValue(goal);

    const command = new DeleteGoalCommand('goal-1', 'other-user');

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });
});
