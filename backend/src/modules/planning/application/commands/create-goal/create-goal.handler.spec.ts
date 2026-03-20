import { Test, type TestingModule } from '@nestjs/testing';
import { CreateGoalHandler } from './create-goal.handler';
import { CreateGoalCommand } from './create-goal.command';
import { GOAL_REPOSITORY } from '../../../domain/repositories';

describe('CreateGoalHandler', () => {
  let handler: CreateGoalHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CreateGoalHandler, { provide: GOAL_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<CreateGoalHandler>(CreateGoalHandler);
    jest.clearAllMocks();
  });

  it('should create a goal and return the response', async () => {
    mockRepository.save.mockImplementation((goal) => Promise.resolve(goal));

    const deadline = new Date('2026-12-31');
    const command = new CreateGoalCommand(
      'user-1',
      'Vacation',
      10000,
      'beach',
      '#FF5733',
      deadline,
      500,
    );

    const result = await handler.execute(command);

    expect(result).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        name: 'Vacation',
        targetAmount: 10000,
        currentAmount: 500,
        deadline,
        icon: 'beach',
        color: '#FF5733',
        progress: 5,
        isCompleted: false,
      }),
    );
    expect(result.id).toBeDefined();
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should create a goal without deadline and with default currentAmount', async () => {
    mockRepository.save.mockImplementation((goal) => Promise.resolve(goal));

    const command = new CreateGoalCommand('user-1', 'Emergency Fund', 5000, 'shield', '#00FF00');

    const result = await handler.execute(command);

    expect(result).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        name: 'Emergency Fund',
        targetAmount: 5000,
        currentAmount: 0,
        deadline: null,
        progress: 0,
        isCompleted: false,
      }),
    );
  });

  it('should create a goal that is already completed', async () => {
    mockRepository.save.mockImplementation((goal) => Promise.resolve(goal));

    const command = new CreateGoalCommand(
      'user-1',
      'Done Goal',
      1000,
      'check',
      '#0F0',
      undefined,
      1000,
    );

    const result = await handler.execute(command);

    expect(result.progress).toBe(100);
    expect(result.isCompleted).toBe(true);
  });
});
