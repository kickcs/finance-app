import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SetDefaultBudgetCommand } from './set-default-budget.command';
import { Budget } from '../../../domain/aggregates/budget';
import { IBudgetRepository, BUDGET_REPOSITORY } from '../../../domain/repositories';
import { BudgetResponseMapper } from '../../mappers';

@CommandHandler(SetDefaultBudgetCommand)
export class SetDefaultBudgetHandler implements ICommandHandler<SetDefaultBudgetCommand> {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly budgetRepository: IBudgetRepository,
  ) {}

  async execute(command: SetDefaultBudgetCommand) {
    const existing = await this.budgetRepository.findDefault(command.userId);

    if (existing) {
      existing.updateAmount(command.amount, command.currency);
      const saved = await this.budgetRepository.save(existing);
      return BudgetResponseMapper.toResponse(saved);
    }

    const budget = Budget.createDefault(
      crypto.randomUUID(),
      command.userId,
      command.amount,
      command.currency,
    );

    const saved = await this.budgetRepository.save(budget);
    return BudgetResponseMapper.toResponse(saved);
  }
}
