import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { GetGoalByIdHandler } from './get-goal-by-id.handler';
import { GetGoalByIdQuery } from './get-goal-by-id.query';
import { Goal } from '../../../domain/aggregates/goal';
import { GOAL_REPOSITORY } from '../../../domain/repositories';

describe('GetGoalByIdHandler', () => {
  let handler: GetGoalByIdHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetGoalByIdHandler, { provide: GOAL_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<GetGoalByIdHandler>(GetGoalByIdHandler);
    jest.clearAllMocks();
  });

  it('should return a goal by id', async () => {
    const goal = Goal.create('g-1', 'user-1', 'Vacation', 10000, 'beach', '#FF5733');
    mockRepository.findById.mockResolvedValue(goal);

    const query = new GetGoalByIdQuery('g-1', 'user-1');

    const result = await handler.execute(query);

    expect(result).toEqual(
      expect.objectContaining({
        id: 'g-1',
        name: 'Vacation',
        targetAmount: 10000,
      }),
    );
    expect(mockRepository.findById).toHaveBeenCalledWith('g-1');
  });

  it('should throw NotFoundException when goal does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    const query = new GetGoalByIdQuery('nonexistent', 'user-1');

    await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when user does not own the goal', async () => {
    const goal = Goal.create('g-1', 'user-1', 'Private', 10000, 'lock', '#F00');
    mockRepository.findById.mockResolvedValue(goal);

    const query = new GetGoalByIdQuery('g-1', 'other-user');

    await expect(handler.execute(query)).rejects.toThrow(ForbiddenException);
  });
});
