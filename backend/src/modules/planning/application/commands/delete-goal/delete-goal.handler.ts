import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { DeleteGoalCommand } from './delete-goal.command';
import { IGoalRepository, GOAL_REPOSITORY } from '../../../domain/repositories';

@CommandHandler(DeleteGoalCommand)
export class DeleteGoalHandler implements ICommandHandler<DeleteGoalCommand> {
  constructor(
    @Inject(GOAL_REPOSITORY)
    private readonly goalRepository: IGoalRepository,
  ) {}

  async execute(command: DeleteGoalCommand): Promise<void> {
    const exists = await this.goalRepository.exists(command.id);
    if (!exists) {
      throw new NotFoundException('Goal not found');
    }
    await this.goalRepository.delete(command.id);
  }
}
