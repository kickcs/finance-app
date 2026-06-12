import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Update } from 'grammy/types';
import * as crypto from 'crypto';
import { Public } from '../../../../common/decorators/public.decorator';
import { TelegramBotService } from '../../infrastructure/telegram/telegram-bot.service';

interface TelegramWebhookRequest extends Request {
  body: Update;
}

@Controller('telegram-import')
export class TelegramWebhookController {
  constructor(
    private readonly botService: TelegramBotService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: TelegramWebhookRequest): Promise<{ ok: boolean }> {
    if (!this.botService.enabled) throw new ServiceUnavailableException('Telegram import disabled');

    const secret = this.configService.getOrThrow<string>('TELEGRAM_IMPORT_WEBHOOK_SECRET');
    const header = req.headers['x-telegram-bot-api-secret-token'];
    const provided = typeof header === 'string' ? header : '';
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid telegram secret token');
    }

    await this.botService.handleUpdate(req.body);
    return { ok: true };
  }
}
