import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { DeleteQuickActionCommand } from './delete-quick-action.command';
import {
  QUICK_ACTION_REPOSITORY,
  type IQuickActionRepository,
} from '../../../domain/repositories/quick-action.repository.interface';

@CommandHandler(DeleteQuickActionCommand)
export class DeleteQuickActionHandler implements ICommandHandler<DeleteQuickActionCommand> {
  constructor(
    @Inject(QUICK_ACTION_REPOSITORY)
    private readonly quickActionRepository: IQuickActionRepository,
  ) {}

  async execute(command: DeleteQuickActionCommand): Promise<void> {
    const quickAction = await this.quickActionRepository.findById(command.id);
    if (quickAction?.userId !== command.userId) {
      throw new NotFoundException('Quick action not found');
    }

    await this.quickActionRepository.delete(command.id);

    // Reposition remaining actions
    const remaining = await this.quickActionRepository.findByUserId(command.userId);
    const toUpdate: typeof remaining = [];
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].position !== i) {
        remaining[i].setPosition(i);
        toUpdate.push(remaining[i]);
      }
    }
    if (toUpdate.length > 0) {
      await this.quickActionRepository.saveMany(toUpdate);
    }
  }
}
