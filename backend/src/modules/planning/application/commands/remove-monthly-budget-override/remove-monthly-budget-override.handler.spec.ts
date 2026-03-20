import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RemoveMonthlyBudgetOverrideHandler } from './remove-monthly-budget-override.handler';
import { RemoveMonthlyBudgetOverrideCommand } from './remove-monthly-budget-override.command';
import { Budget } from '../../../domain/aggregates/budget';
import { BUDGET_REPOSITORY } from '../../../domain/repositories';

describe('RemoveMonthlyBudgetOverrideHandler', () => {
  let handler: RemoveMonthlyBudgetOverrideHandler;
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
        RemoveMonthlyBudgetOverrideHandler,
        { provide: BUDGET_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    handler = module.get<RemoveMonthlyBudgetOverrideHandler>(RemoveMonthlyBudgetOverrideHandler);
    jest.clearAllMocks();
  });

  it('should remove an existing budget override', async () => {
    const override = Budget.createOverride('b-2', 'user-1', 2026, 3, 60000, 'USD');
    mockRepository.findOverride.mockResolvedValue(override);
    mockRepository.delete.mockResolvedValue(undefined);

    const command = new RemoveMonthlyBudgetOverrideCommand('user-1', 2026, 3);

    await handler.execute(command);

    expect(mockRepository.findOverride).toHaveBeenCalledWith('user-1', 2026, 3);
    expect(mockRepository.delete).toHaveBeenCalledWith('b-2');
  });

  it('should throw NotFoundException when override does not exist', async () => {
    mockRepository.findOverride.mockResolvedValue(null);

    const command = new RemoveMonthlyBudgetOverrideCommand('user-1', 2026, 3);

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });
});
