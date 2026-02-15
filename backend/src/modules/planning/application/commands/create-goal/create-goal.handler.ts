import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateGoalCommand } from './create-goal.command';
import { Goal } from '../../../domain/aggregates/goal';
import { IGoalRepository, GOAL_REPOSITORY } from '../../../domain/repositories';
import { GoalResponseMapper } from '../../mappers';

@CommandHandler(CreateGoalCommand)
export class CreateGoalHandler implements ICommandHandler<CreateGoalCommand> {
  constructor(
    @Inject(GOAL_REPOSITORY)
    private readonly goalRepository: IGoalRepository,
  ) {}

  async execute(command: CreateGoalCommand) {
    const goal = Goal.create(
      crypto.randomUUID(),
      command.userId,
      command.name,
      command.targetAmount,
      command.icon,
      command.color,
      command.deadline,
      command.currentAmount,
    );

    const savedGoal = await this.goalRepository.save(goal);

    return GoalResponseMapper.toResponse(savedGoal);
  }
}
