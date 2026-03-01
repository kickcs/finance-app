import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { UpdateQuickActionCommand } from './update-quick-action.command';
import {
  QUICK_ACTION_REPOSITORY,
  type IQuickActionRepository,
} from '../../../domain/repositories/quick-action.repository.interface';
import { toQuickActionResponse } from '../quick-action-response';

@CommandHandler(UpdateQuickActionCommand)
export class UpdateQuickActionHandler implements ICommandHandler<UpdateQuickActionCommand> {
  constructor(
    @Inject(QUICK_ACTION_REPOSITORY)
    private readonly quickActionRepository: IQuickActionRepository,
  ) {}

  async execute(command: UpdateQuickActionCommand) {
    const quickAction = await this.quickActionRepository.findById(command.id);
    if (quickAction?.userId !== command.userId) {
      throw new NotFoundException('Quick action not found');
    }

    quickAction.update(command.data);
    const saved = await this.quickActionRepository.save(quickAction);

    return toQuickActionResponse(saved);
  }
}
