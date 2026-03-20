import { Test, type TestingModule } from '@nestjs/testing';
import { GetGoalsHandler } from './get-goals.handler';
import { GetGoalsQuery } from './get-goals.query';
import { Goal } from '../../../domain/aggregates/goal';
import { GOAL_REPOSITORY } from '../../../domain/repositories';

describe('GetGoalsHandler', () => {
  let handler: GetGoalsHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetGoalsHandler, { provide: GOAL_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<GetGoalsHandler>(GetGoalsHandler);
    jest.clearAllMocks();
  });

  it('should return a list of goals for the user', async () => {
    const goals = [
      Goal.create('g-1', 'user-1', 'Vacation', 10000, 'beach', '#FF5733'),
      Goal.create('g-2', 'user-1', 'Car', 50000, 'car', '#00FF00'),
    ];
    mockRepository.findByUserId.mockResolvedValue(goals);

    const query = new GetGoalsQuery('user-1');

    const result = await handler.execute(query);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({ name: 'Vacation', targetAmount: 10000 }));
    expect(result[1]).toEqual(expect.objectContaining({ name: 'Car', targetAmount: 50000 }));
    expect(mockRepository.findByUserId).toHaveBeenCalledWith('user-1');
  });

  it('should return empty array when user has no goals', async () => {
    mockRepository.findByUserId.mockResolvedValue([]);

    const query = new GetGoalsQuery('user-1');

    const result = await handler.execute(query);

    expect(result).toEqual([]);
  });
});
