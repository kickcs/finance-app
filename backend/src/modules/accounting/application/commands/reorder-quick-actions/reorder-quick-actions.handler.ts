import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ReorderQuickActionsCommand } from './reorder-quick-actions.command';
import {
  QUICK_ACTION_REPOSITORY,
  type IQuickActionRepository,
} from '../../../domain/repositories/quick-action.repository.interface';

@CommandHandler(ReorderQuickActionsCommand)
export class ReorderQuickActionsHandler implements ICommandHandler<ReorderQuickActionsCommand> {
  constructor(
    @Inject(QUICK_ACTION_REPOSITORY)
    private readonly quickActionRepository: IQuickActionRepository,
  ) {}

  async execute(command: ReorderQuickActionsCommand) {
    const actions = await this.quickActionRepository.findByUserId(command.userId);
    const toUpdate: typeof actions = [];
    for (const action of actions) {
      const newPosition = command.ids.indexOf(action.id);
      if (newPosition !== -1 && action.position !== newPosition) {
        action.setPosition(newPosition);
        toUpdate.push(action);
      }
    }
    if (toUpdate.length > 0) {
      await this.quickActionRepository.saveMany(toUpdate);
    }
    return { success: true };
  }
}
