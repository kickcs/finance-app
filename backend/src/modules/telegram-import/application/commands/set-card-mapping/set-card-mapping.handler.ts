import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SetCardMappingCommand } from './set-card-mapping.command';
import {
  CARD_MAPPING_REPOSITORY,
  type ICardMappingRepository,
} from '../../../domain/repositories/card-mapping.repository.interface';

@CommandHandler(SetCardMappingCommand)
export class SetCardMappingHandler implements ICommandHandler<SetCardMappingCommand> {
  constructor(@Inject(CARD_MAPPING_REPOSITORY) private readonly cardRepo: ICardMappingRepository) {}

  async execute(command: SetCardMappingCommand): Promise<{ success: boolean }> {
    await this.cardRepo.upsert({
      userId: command.userId,
      cardMask: command.cardMask,
      accountId: command.accountId,
    });
    return { success: true };
  }
}
