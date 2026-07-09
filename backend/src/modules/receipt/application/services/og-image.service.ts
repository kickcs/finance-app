import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { Resvg } from '@resvg/resvg-js';
import { SharedReceiptService, type SharedReceiptPayload } from './shared-receipt.service';

// Бандленные шрифты (кириллица) — рендер не зависит от шрифтов системы/контейнера
const FONT_DIR = join(process.cwd(), 'assets', 'fonts');
const FONT_FILES = [join(FONT_DIR, 'DejaVuSans.ttf'), join(FONT_DIR, 'DejaVuSans-Bold.ttf')];
const FONT_FAMILY = 'DejaVu Sans';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Escapes text for safe embedding inside SVG/XML content.
 */
function escapeSvg(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatAmount(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function formatDateShort(timestamp: number): string {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

// Палитра приложения (frontend design tokens)
const BG = '#100e28';
const PRIMARY = '#4f46e5';
const PRIMARY_SOFT = '#a5b4fc';
const INK = '#18181b';
const INK_SOFT = '#3f3f46';
const MUTED = '#71717a';
const MUTED_LIGHT = '#a1a1aa';
const GRAY_ON_DARK = '#9ca3af';
const HAIRLINE = '#e4e4e7';

/**
 * 1200×630 OG-карточка: белый «бумажный чек» (фирменная эстетика success-экрана —
 * primary-полоса, пунктирный отрыв, боковые вырезы) на тёмном фоне с брендингом
 * и CTA справа. Pure function — без I/O; все строки экранируются.
 */
export function buildOgSvg(payload: SharedReceiptPayload): string {
  const storeName = escapeSvg(truncate((payload.storeName || 'Чек').toUpperCase(), 24));
  const rawTotal = `${formatAmount(payload.totalAmount)} ${payload.currency}`;
  const totalText = escapeSvg(rawTotal);
  const totalSize = rawTotal.length > 12 ? 56 : 72;
  const dateText = escapeSvg(formatDateShort(payload.date));

  const participantsCount = payload.participants.length;
  const visible = payload.participants.slice(0, 3);
  const extraCount = participantsCount - visible.length;

  const rows: string[] = [];
  visible.forEach((p, i) => {
    const y = 372 + i * 54;
    const color = /^#[0-9a-fA-F]{3,8}$/.test(p.color) ? p.color : PRIMARY;
    rows.push(
      `<circle cx="136" cy="${y - 9}" r="9" fill="${color}" />`,
      `<text x="162" y="${y}" font-size="26" fill="${INK_SOFT}" font-family="${FONT_FAMILY}">${escapeSvg(truncate(p.name, 16))}</text>`,
      `<text x="624" y="${y}" text-anchor="end" font-size="26" font-weight="700" fill="${INK}" font-family="${FONT_FAMILY}">${escapeSvg(`${formatAmount(p.total)}`)}</text>`,
    );
  });
  if (extraCount > 0) {
    rows.push(
      `<text x="162" y="${372 + visible.length * 54}" font-size="24" fill="${MUTED_LIGHT}" font-family="${FONT_FAMILY}">+${extraCount} ещё</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${BG}" />
  <circle cx="1060" cy="-70" r="300" fill="${PRIMARY}" opacity="0.16" />
  <circle cx="-90" cy="650" r="260" fill="${PRIMARY}" opacity="0.10" />

  <!-- Чек: primary-полоса сверху + белое тело -->
  <path d="M80 92 a28 28 0 0 1 28 -28 h544 a28 28 0 0 1 28 28 h-600 z" fill="${PRIMARY}" />
  <path d="M80 92 h600 v446 a28 28 0 0 1 -28 28 h-544 a28 28 0 0 1 -28 -28 z" fill="#ffffff" />

  <text x="380" y="156" text-anchor="middle" font-size="24" letter-spacing="6" fill="${MUTED}" font-family="${FONT_FAMILY}" font-weight="600">${storeName}</text>
  <text x="380" y="238" text-anchor="middle" font-size="${totalSize}" font-weight="800" fill="${INK}" font-family="${FONT_FAMILY}">${totalText}</text>
  ${dateText ? `<text x="380" y="282" text-anchor="middle" font-size="22" fill="${MUTED_LIGHT}" font-family="${FONT_FAMILY}">${dateText}</text>` : ''}

  <!-- Пунктирный отрыв с вырезами по бокам -->
  <line x1="122" y1="316" x2="638" y2="316" stroke="${HAIRLINE}" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round" />
  <circle cx="80" cy="316" r="14" fill="${BG}" />
  <circle cx="680" cy="316" r="14" fill="${BG}" />

  ${rows.join('\n  ')}

  <!-- Брендинг и CTA -->
  <text x="744" y="178" font-size="24" letter-spacing="6" fill="${PRIMARY_SOFT}" font-family="${FONT_FAMILY}" font-weight="700">OURO FINANCE</text>
  <text x="744" y="252" font-size="48" font-weight="800" fill="#ffffff" font-family="${FONT_FAMILY}">Вас позвали</text>
  <text x="744" y="312" font-size="48" font-weight="800" fill="#ffffff" font-family="${FONT_FAMILY}">разделить чек</text>
  <text x="744" y="362" font-size="26" fill="${GRAY_ON_DARK}" font-family="${FONT_FAMILY}">Доли и реквизиты — по ссылке</text>
  <rect x="744" y="420" width="272" height="68" rx="34" fill="${PRIMARY}" />
  <text x="880" y="464" text-anchor="middle" font-size="27" font-weight="700" fill="#ffffff" font-family="${FONT_FAMILY}">Открыть чек</text>
</svg>`;
}

interface CacheEntry {
  buf: Buffer;
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
      if (Date.now() - cached.at < CACHE_TTL_MS) {
        return cached.buf;
      }
      this.cache.delete(token);
    }

    const payload = await this.sharedReceiptService.getByToken(token);
    const svg = buildOgSvg(payload);

    try {
      const resvg = new Resvg(svg, {
        font: {
          fontFiles: FONT_FILES,
          loadSystemFonts: false,
          defaultFontFamily: FONT_FAMILY,
        },
      });
      const buf = resvg.render().asPng();
      this.cache.set(token, { buf, at: Date.now() });
      return buf;
    } catch (error) {
      this.logger.warn(`Failed to render OG image for token ${token}: ${String(error)}`);
      throw error;
    }
  }
}
