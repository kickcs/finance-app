import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DeleteCardMappingCommand } from './delete-card-mapping.command';
import {
  CARD_MAPPING_REPOSITORY,
  type ICardMappingRepository,
} from '../../../domain/repositories/card-mapping.repository.interface';

@CommandHandler(DeleteCardMappingCommand)
export class DeleteCardMappingHandler implements ICommandHandler<DeleteCardMappingCommand> {
  constructor(@Inject(CARD_MAPPING_REPOSITORY) private readonly cardRepo: ICardMappingRepository) {}

  async execute(command: DeleteCardMappingCommand): Promise<{ success: boolean }> {
    await this.cardRepo.delete(command.userId, command.cardMask);
    return { success: true };
  }
}
