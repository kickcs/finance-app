import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { Bot } from 'grammy';
import type { Update } from 'grammy/types';
import { ReplyAggregator, type IngestCounts } from './reply-aggregator';
import { LinkTelegramAccountCommand } from '../../application/commands/link-telegram-account/link-telegram-account.command';
import { IngestBankMessageCommand } from '../../application/commands/ingest-bank-message/ingest-bank-message.command';
import type { LinkResult } from '../../application/commands/link-telegram-account/link-telegram-account.handler';
import type { IngestResult } from '../../application/commands/ingest-bank-message/ingest-bank-message.handler';

function summaryText(c: IngestCounts): string {
  const parts: string[] = [];
  if (c.imported) parts.push(`✅ Импортировано: ${c.imported}`);
  if (c.duplicates) parts.push(`⏭ Пропущено дублей: ${c.duplicates}`);
  if (c.unparsed) parts.push(`⚠️ Не распознано: ${c.unparsed}`);
  if (c.imported) parts.push('\nПодтверди транзакции в приложении — раздел «На подтверждение».');
  return parts.join('\n') || 'Ничего не обработано.';
}

@Injectable()
export class TelegramBotService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;
  private readonly aggregator = new ReplyAggregator();
  readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly commandBus: CommandBus,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.enabled = Boolean(token);
    if (token) this.bot = new Bot(token);
  }

  async onModuleInit(): Promise<void> {
    if (!this.bot) {
      this.logger.warn('TELEGRAM_BOT_TOKEN не задан — telegram-import отключён');
      return;
    }
    this.registerHandlers(this.bot);
    await this.bot.init();
  }

  async onApplicationBootstrap(): Promise<void> {
    const url = this.configService.get<string>('TELEGRAM_WEBHOOK_URL');
    const secret = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (this.bot && url && secret) {
      await this.bot.api.setWebhook(url, { secret_token: secret });
      this.logger.log(`Telegram webhook установлен: ${url}`);
    }
  }

  async handleUpdate(update: Update): Promise<void> {
    if (this.bot) await this.bot.handleUpdate(update);
  }

  private registerHandlers(bot: Bot): void {
    const pm = bot.chatType('private');

    pm.command('start', async (ctx) => {
      const token = ctx.match?.trim();
      if (!token) {
        await ctx.reply(
          'Привет! Я импортирую банковские уведомления в твоё финансовое приложение.\n\n' +
            'Привяжи аккаунт: открой приложение → Профиль → Telegram-импорт → «Подключить».',
        );
        return;
      }
      const result = await this.commandBus.execute<LinkTelegramAccountCommand, LinkResult>(
        new LinkTelegramAccountCommand(token, String(ctx.from.id), ctx.from.username ?? null),
      );
      const replies: Record<LinkResult, string> = {
        linked:
          '✅ Аккаунт привязан! Теперь форвардни мне уведомление от банка — я превращу его в транзакцию.',
        invalid_token: '⚠️ Ссылка устарела или уже использована. Сгенерируй новую в приложении.',
        already_linked_other:
          '⚠️ Этот Telegram уже привязан к другому аккаунту. Сначала отвяжи его там.',
      };
      await ctx.reply(replies[result]);
    });

    pm.on('message:text', async (ctx) => {
      const result = await this.commandBus.execute<IngestBankMessageCommand, IngestResult>(
        new IngestBankMessageCommand(String(ctx.from.id), ctx.message.text),
      );
      if (result === 'not_linked') {
        await ctx.reply(
          'Сначала привяжи аккаунт: приложение → Профиль → Telegram-импорт → «Подключить».',
        );
        return;
      }
      const key =
        result === 'imported' ? 'imported' : result === 'duplicate' ? 'duplicates' : 'unparsed';
      this.aggregator.add(ctx.chat.id, key, async (counts) => {
        await ctx.reply(summaryText(counts));
      });
    });
  }
}
