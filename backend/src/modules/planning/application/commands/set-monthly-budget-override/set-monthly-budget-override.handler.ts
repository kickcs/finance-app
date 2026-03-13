import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SetMonthlyBudgetOverrideCommand } from './set-monthly-budget-override.command';
import { Budget } from '../../../domain/aggregates/budget';
import { IBudgetRepository, BUDGET_REPOSITORY } from '../../../domain/repositories';
import { BudgetResponseMapper } from '../../mappers';

@CommandHandler(SetMonthlyBudgetOverrideCommand)
export class SetMonthlyBudgetOverrideHandler implements ICommandHandler<SetMonthlyBudgetOverrideCommand> {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly budgetRepository: IBudgetRepository,
  ) {}

  async execute(command: SetMonthlyBudgetOverrideCommand) {
    const existing = await this.budgetRepository.findOverride(
      command.userId,
      command.year,
      command.month,
    );

    if (existing) {
      existing.updateAmount(command.amount, command.currency);
      const saved = await this.budgetRepository.save(existing);
      return BudgetResponseMapper.toResponse(saved);
    }

    const budget = Budget.createOverride(
      crypto.randomUUID(),
      command.userId,
      command.year,
      command.month,
      command.amount,
      command.currency,
    );

    const saved = await this.budgetRepository.save(budget);
    return BudgetResponseMapper.toResponse(saved);
  }
}
