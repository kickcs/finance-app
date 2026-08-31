import { Injectable, Logger } from '@nestjs/common';
import { Resvg } from '@resvg/resvg-js';
import { SharedDebtsService, type SharedDebtsPayload } from './shared-debts.service';
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
  shortDate,
  type OgRow,
} from '../../../../shared/utils/share-card.svg';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
// Кэш живёт в памяти процесса, а токены раздаются наружу: без потолка
// краулер, обошедший тысячу ссылок, оставил бы в куче тысячу PNG.
const CACHE_MAX_ENTRIES = 200;

const DEBT_UNIT: [string, string, string] = ['долг', 'долга', 'долгов'];

/**
 * 1200×630: слева бумажный лист сверки — тот же язык, что у карточки в
 * приложении, — справа постер со ссылкой. Pure function, без I/O; все строки
 * экранируются внутри примитивов.
 */
export function buildDebtsOgSvg(payload: SharedDebtsPayload): string {
  const positive = payload.net >= 0;
  const mutual = payload.totalGiven > 0 && payload.totalTaken > 0;
  const mixed = payload.debts.some((debt) => debt.currency !== payload.currency);

  const cardHeight = ogCardHeight(payload.debts.length, payload.debts.length > 3);
  const { y, tearY, row0 } = ogLayout(cardHeight);

  const rows: OgRow[] = payload.debts.map((debt) => ({
    color: debt.direction === 'given' ? SVG_COLORS.givenRail : SVG_COLORS.takenRail,
    title: debt.title,
    sub: debt.dueDate ? `до ${shortDate(debt.dueDate)}` : 'без срока',
    amount: mixed
      ? `${bareAmount(debt.remainingAmount)} ${debt.currency}`
      : bareAmount(debt.remainingAmount),
    unit: DEBT_UNIT,
  }));

  // Нетто — разность встречных сторон, и по списку её не проверить: при
  // встречных долгах называем обе стороны вместо «должен вам»
  const caption = mutual
    ? `вам должны ${bareAmount(payload.totalGiven)}  ·  вы должны ${bareAmount(payload.totalTaken)}`
    : positive
      ? 'должен вам'
      : 'вы должны';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG.W}" height="${OG.H}" viewBox="0 0 ${OG.W} ${OG.H}">
  ${ogChrome(shortDate(payload.snapshotAt), payload.snapshotAt, cardHeight, y)}
  ${ogHero({
    y,
    subject: payload.personName,
    amount: `${positive ? '+' : '−'}${bareAmount(Math.abs(payload.net))}`,
    currency: payload.currency,
    color: positive ? SVG_COLORS.givenText : SVG_COLORS.takenText,
    caption,
  })}
  ${ogTear(tearY)}
  ${ogRows(rows, row0)}
  ${ogPoster('Сверка', 'по долгам', 'Все суммы — по ссылке', 'Открыть сверку')}
</svg>`;
}

interface CacheEntry {
  buffer: Buffer;
  at: number;
}

@Injectable()
export class DebtsOgImageService {
  private readonly logger = new Logger(DebtsOgImageService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly sharedDebtsService: SharedDebtsService) {}

  async getOgPng(token: string): Promise<Buffer> {
    const cached = this.cache.get(token);
    if (cached) {
      if (Date.now() - cached.at < CACHE_TTL_MS) return cached.buffer;
      this.cache.delete(token);
    }

    const payload = await this.sharedDebtsService.getByToken(token);
    const svg = buildDebtsOgSvg(payload);

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
      this.logger.warn(`Failed to render debts OG image for token ${token}: ${String(error)}`);
      throw error;
    }
  }
}
