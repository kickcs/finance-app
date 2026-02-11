import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateGoalCommand } from './create-goal.command';
import { Goal } from '../../../domain/aggregates/goal';
import { IGoalRepository, GOAL_REPOSITORY } from '../../../domain/repositories';

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

    return this.toResponse(savedGoal);
  }

  private toResponse(goal: Goal) {
    return {
      id: goal.id,
      userId: goal.userId,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      deadline: goal.deadline,
      icon: goal.icon,
      color: goal.color,
      progress: goal.progress,
      isCompleted: goal.isCompleted,
      createdAt: goal.createdAt,
    };
  }
}
