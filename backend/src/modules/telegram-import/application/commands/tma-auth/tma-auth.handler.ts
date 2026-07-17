import { Inject, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { TmaAuthCommand } from './tma-auth.command';
import { validateTmaInitData } from '../../../domain/tma/init-data.validator';
import {
  type ITelegramLinkRepository,
  TELEGRAM_LINK_REPOSITORY,
} from '../../../domain/repositories/telegram-link.repository.interface';
import {
  type IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../../../identity/domain/repositories/profile.repository.interface';
import {
  type AuthResponse,
  TokenService,
} from '../../../../identity/application/services/token.service';

export type TmaAuthResult = { linked: false } | { linked: true; auth: AuthResponse };

@CommandHandler(TmaAuthCommand)
export class TmaAuthHandler implements ICommandHandler<TmaAuthCommand> {
  constructor(
    private readonly configService: ConfigService,
    @Inject(TELEGRAM_LINK_REPOSITORY) private readonly linkRepo: ITelegramLinkRepository,
    @Inject(PROFILE_REPOSITORY) private readonly profileRepo: IProfileRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(command: TmaAuthCommand): Promise<TmaAuthResult> {
    const botToken = this.configService.get<string>('TELEGRAM_IMPORT_BOT_TOKEN');
    if (!botToken) throw new ServiceUnavailableException('Telegram import disabled');

    const initData = validateTmaInitData(command.initData, botToken);
    if (!initData) throw new UnauthorizedException('Invalid initData');

    const link = await this.linkRepo.findByTelegramUserId(initData.telegramUserId);
    if (!link) return { linked: false };

    const profile = await this.profileRepo.findById(link.userId);
    if (!profile) return { linked: false };

    // Зеркало LoginHandler: те же payload, refresh-bookkeeping и форма ответа
    const tokens = await this.tokenService.generateTokens({
      sub: profile.id,
      email: profile.emailValue || undefined,
      isAnonymous: false,
      isDemo: profile.isDemo,
    });
    profile.setRefreshToken(this.tokenService.hashToken(tokens.refreshToken));
    await this.profileRepo.save(profile);

    return {
      linked: true,
      auth: {
        user: {
          id: profile.id,
          email: profile.emailValue,
          name: profile.name,
          isAnonymous: false,
          isDemo: profile.isDemo,
        },
        tokens,
      },
    };
  }
}
