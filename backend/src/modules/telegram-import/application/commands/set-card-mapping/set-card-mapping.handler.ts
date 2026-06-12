import { ForbiddenException, Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SetCardMappingCommand } from './set-card-mapping.command';
import {
  CARD_MAPPING_REPOSITORY,
  type ICardMappingRepository,
} from '../../../domain/repositories/card-mapping.repository.interface';
import {
  ACCOUNT_REPOSITORY,
  type IAccountRepository,
} from '../../../../accounting/domain/repositories/account.repository.interface';

@CommandHandler(SetCardMappingCommand)
export class SetCardMappingHandler implements ICommandHandler<SetCardMappingCommand> {
  constructor(
    @Inject(CARD_MAPPING_REPOSITORY) private readonly cardRepo: ICardMappingRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accountRepo: IAccountRepository,
  ) {}

  async execute(command: SetCardMappingCommand): Promise<{ success: boolean }> {
    const account = await this.accountRepo.findById(command.accountId);
    if (account?.userId !== command.userId) {
      throw new ForbiddenException('Account does not belong to user');
    }

    await this.cardRepo.upsert({
      userId: command.userId,
      cardMask: command.cardMask,
      accountId: command.accountId,
    });
    return { success: true };
  }
}
