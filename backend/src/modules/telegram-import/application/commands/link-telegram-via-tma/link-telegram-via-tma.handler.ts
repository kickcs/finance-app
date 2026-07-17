import { Inject, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { LinkTelegramViaTmaCommand } from './link-telegram-via-tma.command';
import { validateTmaInitData } from '../../../domain/tma/init-data.validator';
import {
  type ITelegramLinkRepository,
  TELEGRAM_LINK_REPOSITORY,
} from '../../../domain/repositories/telegram-link.repository.interface';

export type TmaLinkResult = 'linked' | 'already_linked_other';

@CommandHandler(LinkTelegramViaTmaCommand)
export class LinkTelegramViaTmaHandler implements ICommandHandler<LinkTelegramViaTmaCommand> {
  constructor(
    private readonly configService: ConfigService,
    @Inject(TELEGRAM_LINK_REPOSITORY) private readonly linkRepo: ITelegramLinkRepository,
  ) {}

  async execute(command: LinkTelegramViaTmaCommand): Promise<TmaLinkResult> {
    const botToken = this.configService.get<string>('TELEGRAM_IMPORT_BOT_TOKEN');
    if (!botToken) throw new ServiceUnavailableException('Telegram import disabled');

    const initData = validateTmaInitData(command.initData, botToken);
    if (!initData) throw new UnauthorizedException('Invalid initData');

    const existingByTg = await this.linkRepo.findByTelegramUserId(initData.telegramUserId);
    if (existingByTg && existingByTg.userId !== command.userId) return 'already_linked_other';

    // перелинковка своего Telegram: старая связь userId уходит (может совпадать с existingByTg)
    await this.linkRepo.deleteByUserId(command.userId);
    await this.linkRepo.save({
      userId: command.userId,
      telegramUserId: initData.telegramUserId,
      telegramUsername: initData.telegramUsername,
    });
    return 'linked';
  }
}
