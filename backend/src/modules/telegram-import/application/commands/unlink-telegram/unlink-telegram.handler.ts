import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { UnlinkTelegramCommand } from './unlink-telegram.command';
import {
  type ITelegramLinkRepository,
  TELEGRAM_LINK_REPOSITORY,
} from '../../../domain/repositories/telegram-link.repository.interface';

@CommandHandler(UnlinkTelegramCommand)
export class UnlinkTelegramHandler implements ICommandHandler<UnlinkTelegramCommand> {
  constructor(
    @Inject(TELEGRAM_LINK_REPOSITORY) private readonly linkRepo: ITelegramLinkRepository,
  ) {}

  async execute(command: UnlinkTelegramCommand): Promise<{ success: boolean }> {
    await this.linkRepo.deleteByUserId(command.userId);
    return { success: true };
  }
}
