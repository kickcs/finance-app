import * as crypto from 'crypto';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { CreateQuickActionCommand } from './create-quick-action.command';
import {
  QUICK_ACTION_REPOSITORY,
  type IQuickActionRepository,
} from '../../../domain/repositories/quick-action.repository.interface';
import { QuickAction } from '../../../domain/aggregates/quick-action';
import { toQuickActionResponse } from '../quick-action-response';

const MAX_QUICK_ACTIONS = 6;

@CommandHandler(CreateQuickActionCommand)
export class CreateQuickActionHandler implements ICommandHandler<CreateQuickActionCommand> {
  constructor(
    @Inject(QUICK_ACTION_REPOSITORY)
    private readonly quickActionRepository: IQuickActionRepository,
  ) {}

  async execute(command: CreateQuickActionCommand) {
    const count = await this.quickActionRepository.countByUserId(command.userId);
    if (count >= MAX_QUICK_ACTIONS) {
      throw new BadRequestException('Maximum of 6 quick actions allowed');
    }

    const quickAction = QuickAction.create(
      crypto.randomUUID(),
      command.userId,
      command.categoryId,
      command.accountId,
      command.label,
      count,
      command.amount ?? null,
    );

    const saved = await this.quickActionRepository.save(quickAction);

    return toQuickActionResponse(saved);
  }
}
