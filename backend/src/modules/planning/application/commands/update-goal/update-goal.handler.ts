import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateGoalCommand } from './update-goal.command';
import { IGoalRepository, GOAL_REPOSITORY } from '../../../domain/repositories';

@CommandHandler(UpdateGoalCommand)
export class UpdateGoalHandler implements ICommandHandler<UpdateGoalCommand> {
  constructor(
    @Inject(GOAL_REPOSITORY)
    private readonly goalRepository: IGoalRepository,
  ) {}

  async execute(command: UpdateGoalCommand) {
    const goal = await this.goalRepository.findById(command.id);
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    goal.update(command.data);
    const savedGoal = await this.goalRepository.save(goal);

    return {
      id: savedGoal.id,
      userId: savedGoal.userId,
      name: savedGoal.name,
      targetAmount: savedGoal.targetAmount,
      currentAmount: savedGoal.currentAmount,
      deadline: savedGoal.deadline,
      icon: savedGoal.icon,
      color: savedGoal.color,
      progress: savedGoal.progress,
      isCompleted: savedGoal.isCompleted,
      createdAt: savedGoal.createdAt,
    };
  }
}
