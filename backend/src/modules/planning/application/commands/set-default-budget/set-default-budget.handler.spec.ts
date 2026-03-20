import { Test, type TestingModule } from '@nestjs/testing';
import { SetDefaultBudgetHandler } from './set-default-budget.handler';
import { SetDefaultBudgetCommand } from './set-default-budget.command';
import { Budget } from '../../../domain/aggregates/budget';
import { BUDGET_REPOSITORY } from '../../../domain/repositories';

describe('SetDefaultBudgetHandler', () => {
  let handler: SetDefaultBudgetHandler;
  const mockRepository = {
    findDefault: jest.fn(),
    findOverride: jest.fn(),
    findByUserId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetDefaultBudgetHandler,
        { provide: BUDGET_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    handler = module.get<SetDefaultBudgetHandler>(SetDefaultBudgetHandler);
    jest.clearAllMocks();
  });

  it('should create a new default budget when none exists', async () => {
    mockRepository.findDefault.mockResolvedValue(null);
    mockRepository.save.mockImplementation((budget) => Promise.resolve(budget));

    const command = new SetDefaultBudgetCommand('user-1', 50000, 'USD');

    const result = await handler.execute(command);

    expect(result).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        amount: 50000,
        currency: 'USD',
        isDefault: true,
        year: null,
        month: null,
      }),
    );
    expect(mockRepository.findDefault).toHaveBeenCalledWith('user-1');
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should update existing default budget when one already exists', async () => {
    const existing = Budget.createDefault('b-1', 'user-1', 30000, 'USD');
    mockRepository.findDefault.mockResolvedValue(existing);
    mockRepository.save.mockImplementation((budget) => Promise.resolve(budget));

    const command = new SetDefaultBudgetCommand('user-1', 70000, 'EUR');

    const result = await handler.execute(command);

    expect(result).toEqual(
      expect.objectContaining({
        id: 'b-1',
        amount: 70000,
        currency: 'EUR',
        isDefault: true,
      }),
    );
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });
});
