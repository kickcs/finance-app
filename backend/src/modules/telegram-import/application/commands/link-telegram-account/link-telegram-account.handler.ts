import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { LinkTelegramAccountCommand } from './link-telegram-account.command';
import {
  type ILinkTokenRepository,
  LINK_TOKEN_REPOSITORY,
} from '../../../domain/repositories/link-token.repository.interface';
import {
  type ITelegramLinkRepository,
  TELEGRAM_LINK_REPOSITORY,
} from '../../../domain/repositories/telegram-link.repository.interface';

export type LinkResult = 'linked' | 'invalid_token' | 'already_linked_other';

@CommandHandler(LinkTelegramAccountCommand)
export class LinkTelegramAccountHandler implements ICommandHandler<LinkTelegramAccountCommand> {
  constructor(
    @Inject(LINK_TOKEN_REPOSITORY) private readonly tokenRepo: ILinkTokenRepository,
    @Inject(TELEGRAM_LINK_REPOSITORY) private readonly linkRepo: ITelegramLinkRepository,
  ) {}

  async execute(command: LinkTelegramAccountCommand): Promise<LinkResult> {
    const userId = await this.tokenRepo.consume(command.token);
    if (!userId) return 'invalid_token';

    const existingByTg = await this.linkRepo.findByTelegramUserId(command.telegramUserId);
    if (existingByTg && existingByTg.userId !== userId) return 'already_linked_other';

    // перелинковка: убираем старые связи (и по user, и по tg — это может быть одна и та же строка)
    await this.linkRepo.deleteByUserId(userId);
    if (existingByTg) await this.linkRepo.deleteByUserId(existingByTg.userId);

    await this.linkRepo.save({
      userId,
      telegramUserId: command.telegramUserId,
      telegramUsername: command.telegramUsername,
    });
    return 'linked';
  }
}
