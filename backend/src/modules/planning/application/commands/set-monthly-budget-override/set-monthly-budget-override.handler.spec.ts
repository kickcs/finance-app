import { Test, type TestingModule } from '@nestjs/testing';
import { SetMonthlyBudgetOverrideHandler } from './set-monthly-budget-override.handler';
import { SetMonthlyBudgetOverrideCommand } from './set-monthly-budget-override.command';
import { Budget } from '../../../domain/aggregates/budget';
import { BUDGET_REPOSITORY } from '../../../domain/repositories';

describe('SetMonthlyBudgetOverrideHandler', () => {
  let handler: SetMonthlyBudgetOverrideHandler;
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
        SetMonthlyBudgetOverrideHandler,
        { provide: BUDGET_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    handler = module.get<SetMonthlyBudgetOverrideHandler>(SetMonthlyBudgetOverrideHandler);
    jest.clearAllMocks();
  });

  it('should create a new override when none exists for that month', async () => {
    mockRepository.findOverride.mockResolvedValue(null);
    mockRepository.save.mockImplementation((budget) => Promise.resolve(budget));

    const command = new SetMonthlyBudgetOverrideCommand('user-1', 2026, 3, 60000, 'USD');

    const result = await handler.execute(command);

    expect(result).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        year: 2026,
        month: 3,
        amount: 60000,
        currency: 'USD',
        isDefault: false,
      }),
    );
    expect(mockRepository.findOverride).toHaveBeenCalledWith('user-1', 2026, 3);
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should update existing override when one already exists for that month', async () => {
    const existing = Budget.createOverride('b-2', 'user-1', 2026, 3, 40000, 'USD');
    mockRepository.findOverride.mockResolvedValue(existing);
    mockRepository.save.mockImplementation((budget) => Promise.resolve(budget));

    const command = new SetMonthlyBudgetOverrideCommand('user-1', 2026, 3, 80000, 'EUR');

    const result = await handler.execute(command);

    expect(result).toEqual(
      expect.objectContaining({
        id: 'b-2',
        amount: 80000,
        currency: 'EUR',
        isDefault: false,
      }),
    );
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });
});
