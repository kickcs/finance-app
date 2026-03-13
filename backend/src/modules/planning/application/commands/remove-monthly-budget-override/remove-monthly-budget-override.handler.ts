import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { RemoveMonthlyBudgetOverrideCommand } from './remove-monthly-budget-override.command';
import { IBudgetRepository, BUDGET_REPOSITORY } from '../../../domain/repositories';

@CommandHandler(RemoveMonthlyBudgetOverrideCommand)
export class RemoveMonthlyBudgetOverrideHandler implements ICommandHandler<RemoveMonthlyBudgetOverrideCommand> {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly budgetRepository: IBudgetRepository,
  ) {}

  async execute(command: RemoveMonthlyBudgetOverrideCommand): Promise<void> {
    const override = await this.budgetRepository.findOverride(
      command.userId,
      command.year,
      command.month,
    );

    if (!override) {
      throw new NotFoundException('Budget override not found');
    }

    await this.budgetRepository.delete(override.id);
  }
}
