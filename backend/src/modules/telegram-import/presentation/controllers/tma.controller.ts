import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  ConflictException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public, CurrentUser } from '../../../../common';
import { TmaAuthDto } from '../dto/tma-auth.dto';
import { TmaAuthCommand } from '../../application/commands/tma-auth/tma-auth.command';
import type { TmaAuthResult } from '../../application/commands/tma-auth/tma-auth.handler';
import { LinkTelegramViaTmaCommand } from '../../application/commands/link-telegram-via-tma/link-telegram-via-tma.command';
import type { TmaLinkResult } from '../../application/commands/link-telegram-via-tma/link-telegram-via-tma.handler';
import {
  REFRESH_TOKEN_COOKIE,
  COOKIE_OPTIONS,
  DEMO_COOKIE_OPTIONS,
} from '../../../identity/presentation/cookie.constants';

// В iframe web.telegram.org кука с sameSite=lax не отправляется (cross-site) — для TMA нужен None
// (валиден только вместе с secure; без secure оставляем базовые опции)
const withTmaSameSite = (opts: typeof COOKIE_OPTIONS) =>
  opts.secure ? { ...opts, sameSite: 'none' as const } : opts;
const TMA_COOKIE_OPTIONS = withTmaSameSite(COOKIE_OPTIONS);
const TMA_DEMO_COOKIE_OPTIONS = withTmaSameSite(DEMO_COOKIE_OPTIONS);

@Controller('telegram-import')
export class TmaController {
  constructor(private readonly commandBus: CommandBus) {}

  /** Авторизация Mini App по initData: выдаёт штатную сессию (access + refresh-cookie) */
  @Public()
  @Post('tma-auth')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async tmaAuth(@Body() dto: TmaAuthDto, @Res({ passthrough: true }) response: Response) {
    const result: TmaAuthResult = await this.commandBus.execute(new TmaAuthCommand(dto.initData));
    if (!result.linked) return { linked: false };

    const cookieOpts = result.auth.user.isDemo ? TMA_DEMO_COOKIE_OPTIONS : TMA_COOKIE_OPTIONS;
    response.cookie(REFRESH_TOKEN_COOKIE, result.auth.tokens.refreshToken, cookieOpts);
    return {
      linked: true,
      accessToken: result.auth.tokens.accessToken,
      user: result.auth.user,
    };
  }

  /** Привязка Telegram к текущему аккаунту из Mini App (initData доказывает tg-идентичность) */
  @Post('tma-link')
  @HttpCode(HttpStatus.OK)
  async tmaLink(@CurrentUser('sub') userId: string, @Body() dto: TmaAuthDto) {
    const result: TmaLinkResult = await this.commandBus.execute(
      new LinkTelegramViaTmaCommand(userId, dto.initData),
    );
    if (result === 'already_linked_other') {
      throw new ConflictException('telegram_already_linked_other');
    }
    return { success: true };
  }
}
