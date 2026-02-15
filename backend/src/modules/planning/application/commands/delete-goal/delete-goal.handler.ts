import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DeleteGoalCommand } from './delete-goal.command';
import { IGoalRepository, GOAL_REPOSITORY } from '../../../domain/repositories';

@CommandHandler(DeleteGoalCommand)
export class DeleteGoalHandler implements ICommandHandler<DeleteGoalCommand> {
  constructor(
    @Inject(GOAL_REPOSITORY)
    private readonly goalRepository: IGoalRepository,
  ) {}

  async execute(command: DeleteGoalCommand): Promise<void> {
    const goal = await this.goalRepository.findById(command.id);
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }
    if (goal.userId !== command.userId) {
      throw new ForbiddenException('Access denied');
    }
    await this.goalRepository.delete(command.id);
  }
}
