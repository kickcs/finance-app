import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UpdateGoalCommand } from './update-goal.command';
import { IGoalRepository, GOAL_REPOSITORY } from '../../../domain/repositories';
import { GoalResponseMapper } from '../../mappers';

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

    if (goal.userId !== command.userId) {
      throw new ForbiddenException('Access denied');
    }

    goal.update(command.data);
    const savedGoal = await this.goalRepository.save(goal);

    return GoalResponseMapper.toResponse(savedGoal);
  }
}
