import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { I18nService } from 'nestjs-i18n';
import { Bot, InlineKeyboard } from 'grammy';
import type { Update } from 'grammy/types';
import { ReplyAggregator, type IngestCounts } from './reply-aggregator';
import { LinkTelegramAccountCommand } from '../../application/commands/link-telegram-account/link-telegram-account.command';
import { IngestBankMessageCommand } from '../../application/commands/ingest-bank-message/ingest-bank-message.command';
import type { LinkResult } from '../../application/commands/link-telegram-account/link-telegram-account.handler';
import type { IngestResult } from '../../application/commands/ingest-bank-message/ingest-bank-message.handler';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;
  private readonly aggregator = new ReplyAggregator();
  private _enabled: boolean;

  get enabled(): boolean {
    return this._enabled;
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly commandBus: CommandBus,
    private readonly i18n: I18nService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_IMPORT_BOT_TOKEN');
    this._enabled = Boolean(token);
    if (token) this.bot = new Bot(token);
  }

  /**
   * Resolves display language for a Telegram user.
   * Uses ctx.from.language_code (Telegram client locale) with 'ru' fallback.
   * 'en'/'en-*' → 'en', anything else → 'ru'.
   */
  resolveTelegramLang(telegramUserId: string, languageCode: string | undefined): string {
    return languageCode?.toLowerCase().startsWith('en') ? 'en' : 'ru';
  }

  /** URL Mini App: PUBLIC_APP_URL + /tma; без PUBLIC_APP_URL кнопки не ставятся */
  private get tmaUrl(): string | null {
    const base = this.configService.get<string>('PUBLIC_APP_URL');
    return base ? `${base.replace(/\/+$/, '')}/tma` : null;
  }

  private tmaKeyboard(
    labelKey: string,
    lang: string,
  ): { reply_markup: InlineKeyboard } | undefined {
    const url = this.tmaUrl;
    if (!url) return undefined;
    return {
      reply_markup: new InlineKeyboard().webApp(this.i18n.translate(labelKey, { lang }), url),
    };
  }

  private summaryText(c: IngestCounts, lang: string): string {
    const parts: string[] = [];
    if (c.imported)
      parts.push(
        this.i18n.translate('telegram.summary.imported', {
          lang,
          args: { count: c.imported },
        }),
      );
    if (c.duplicates)
      parts.push(
        this.i18n.translate('telegram.summary.duplicates', {
          lang,
          args: { count: c.duplicates },
        }),
      );
    if (c.unparsed)
      parts.push(
        this.i18n.translate('telegram.summary.unparsed', {
          lang,
          args: { count: c.unparsed },
        }),
      );
    if (c.imported) parts.push(this.i18n.translate('telegram.summary.confirmHint', { lang }));
    return parts.join('\n') || this.i18n.translate('telegram.summary.nothing', { lang });
  }

  async onModuleInit(): Promise<void> {
    if (!this.bot) {
      this.logger.warn('TELEGRAM_IMPORT_BOT_TOKEN не задан — telegram-import отключён');
      return;
    }
    this.registerHandlers(this.bot);
    try {
      await this.bot.init();
    } catch (err) {
      this._enabled = false;
      this.bot = null;
      this.logger.error(
        'Не удалось инициализировать Telegram-бота — telegram-import отключён',
        err,
      );
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    const url = this.configService.get<string>('TELEGRAM_IMPORT_WEBHOOK_URL');
    const secret = this.configService.get<string>('TELEGRAM_IMPORT_WEBHOOK_SECRET');
    if (this.bot && url && secret) {
      try {
        await this.bot.api.setWebhook(url, { secret_token: secret });
        this.logger.log(`Telegram webhook установлен: ${url}`);
      } catch (err) {
        this.logger.error(`Не удалось установить Telegram webhook: ${url}`, err);
      }
    }

    if (this.bot && this.tmaUrl) {
      try {
        await this.bot.api.setChatMenuButton({
          menu_button: { type: 'web_app', text: 'Инбокс', web_app: { url: this.tmaUrl } },
        });
        this.logger.log(`Telegram menu button установлен: ${this.tmaUrl}`);
      } catch (err) {
        this.logger.error('Не удалось установить Telegram menu button', err);
      }
    }
  }

  async handleUpdate(update: Update): Promise<void> {
    if (this.bot) await this.bot.handleUpdate(update);
  }

  private registerHandlers(bot: Bot): void {
    bot.catch((err) => {
      this.logger.error('Ошибка в обработчике Telegram-апдейта', err.error ?? err);
    });

    const pm = bot.chatType('private');

    pm.command('start', async (ctx) => {
      const lang = this.resolveTelegramLang(String(ctx.from.id), ctx.from.language_code);
      const token = ctx.match.trim();
      if (!token) {
        await ctx.reply(
          this.i18n.translate('telegram.start.noToken', { lang }),
          this.tmaKeyboard('telegram.buttons.openInbox', lang),
        );
        return;
      }
      const result = await this.commandBus.execute<LinkTelegramAccountCommand, LinkResult>(
        new LinkTelegramAccountCommand(token, String(ctx.from.id), ctx.from.username ?? null),
      );
      const replies: Record<LinkResult, string> = {
        linked: this.i18n.translate('telegram.start.linked', { lang }),
        invalid_token: this.i18n.translate('telegram.start.invalidToken', { lang }),
        already_linked_other: this.i18n.translate('telegram.start.alreadyLinkedOther', {
          lang,
        }),
      };
      await ctx.reply(replies[result]);
    });

    pm.on('message:text', async (ctx) => {
      const lang = this.resolveTelegramLang(String(ctx.from.id), ctx.from.language_code);
      const result = await this.commandBus.execute<IngestBankMessageCommand, IngestResult>(
        new IngestBankMessageCommand(String(ctx.from.id), ctx.message.text),
      );
      if (result === 'not_linked') {
        await ctx.reply(
          this.i18n.translate('telegram.notLinked', { lang }),
          this.tmaKeyboard('telegram.buttons.linkAccount', lang),
        );
        return;
      }
      const key =
        result === 'imported' ? 'imported' : result === 'duplicate' ? 'duplicates' : 'unparsed';
      this.aggregator.add(ctx.chat.id, key, async (counts) => {
        const keyboard = counts.imported
          ? this.tmaKeyboard('telegram.buttons.confirm', lang)
          : undefined;
        await ctx.reply(this.summaryText(counts, lang), keyboard);
      });
    });
  }
}
