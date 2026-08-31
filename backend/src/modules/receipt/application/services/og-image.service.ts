import { Injectable, Logger } from '@nestjs/common';
import { Resvg } from '@resvg/resvg-js';
import { SharedReceiptService, type SharedReceiptPayload } from './shared-receipt.service';
import {
  OG,
  SHARE_DISPLAY,
  SHARE_FONT_FILES,
  SVG_COLORS,
  bareAmount,
  ogCardHeight,
  ogChrome,
  ogHero,
  ogLayout,
  ogPoster,
  ogRows,
  ogTear,
  plural,
  shortDate,
  type OgRow,
} from '../../../../shared/utils/share-card.svg';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
// Кэш живёт в памяти процесса, а токены раздаются наружу: без потолка
// краулер, обошедший тысячу ссылок, оставил бы в куче тысячу PNG.
const CACHE_MAX_ENTRIES = 200;

const PERSON_UNIT: [string, string, string] = ['человек', 'человека', 'человек'];

/**
 * 1200×630: слева бумажный чек — тот же язык, что у карточки в приложении, —
 * справа постер со ссылкой. Pure function, без I/O; все строки экранируются
 * внутри примитивов.
 */
export function buildOgSvg(payload: SharedReceiptPayload): string {
  // Кто сколько должен, а не кто сколько съел: своей строки у плательщика нет
  const owers = payload.participants.filter((p) => !p.isMe && p.total > 0);
  const back = owers.reduce((sum, p) => sum + p.total, 0);

  const cardHeight = ogCardHeight(owers.length, owers.length > 3);
  const { y, tearY, row0 } = ogLayout(cardHeight);

  const rows: OgRow[] = owers.map((participant) => {
    const count = participant.items.length;
    return {
      color: participant.color,
      title: participant.name,
      sub: `${count} ${plural(count, 'позиция', 'позиции', 'позиций')}`,
      amount: bareAmount(participant.total),
      unit: PERSON_UNIT,
    };
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG.W}" height="${OG.H}" viewBox="0 0 ${OG.W} ${OG.H}">
  ${ogChrome(shortDate(payload.date), payload.date, cardHeight, y)}
  ${ogHero({
    y,
    subject: payload.storeName || 'Чек',
    amount: bareAmount(payload.totalAmount),
    currency: payload.currency,
    color: SVG_COLORS.ink,
    caption: back > 0 ? `вам вернут ${bareAmount(back)} ${payload.currency}` : 'делить не с кем',
  })}
  ${ogTear(tearY)}
  ${ogRows(rows, row0)}
  ${ogPoster('Счёт', 'разделён', 'Кто сколько должен — по ссылке', 'Открыть чек')}
</svg>`;
}

interface CacheEntry {
  buffer: Buffer;
  at: number;
}

@Injectable()
export class OgImageService {
  private readonly logger = new Logger(OgImageService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly sharedReceiptService: SharedReceiptService) {}

  async getOgPng(token: string): Promise<Buffer> {
    const cached = this.cache.get(token);
    if (cached) {
      if (Date.now() - cached.at < CACHE_TTL_MS) return cached.buffer;
      this.cache.delete(token);
    }

    const payload = await this.sharedReceiptService.getByToken(token);
    const svg = buildOgSvg(payload);

    try {
      const buffer = new Resvg(svg, {
        font: {
          fontFiles: SHARE_FONT_FILES,
          loadSystemFonts: false,
          defaultFontFamily: SHARE_DISPLAY,
        },
      })
        .render()
        .asPng();

      if (this.cache.size >= CACHE_MAX_ENTRIES) {
        // Map держит порядок вставки — выкидываем самый давний
        const oldest = this.cache.keys().next();
        if (!oldest.done) this.cache.delete(oldest.value);
      }
      this.cache.set(token, { buffer, at: Date.now() });

      return buffer;
    } catch (error) {
      this.logger.warn(`Failed to render OG image for token ${token}: ${String(error)}`);
      throw error;
    }
  }
}
