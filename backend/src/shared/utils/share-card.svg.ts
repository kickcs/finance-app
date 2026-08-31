import { join } from 'path';
import { escapeXml, formatAmount, truncate } from './share';

/**
 * Примитивы OG-карточки 1200×630: слева — бумажный лист (тот же язык, что у
 * canvas-карточек в приложении), справа — постер со ссылкой. Оба модуля, долги
 * и чек, собирают свою картинку из этих кусков.
 */

const FONT_DIR = join(process.cwd(), 'assets', 'fonts');

export const SHARE_FONT_FILES = [
  join(FONT_DIR, 'golos-500.ttf'),
  join(FONT_DIR, 'golos-600.ttf'),
  join(FONT_DIR, 'golos-800.ttf'),
  join(FONT_DIR, 'plex-mono-500.ttf'),
  join(FONT_DIR, 'plex-mono-600.ttf'),
];

export const SHARE_DISPLAY = 'Golos Text';
export const SHARE_MONO = 'IBM Plex Mono';

export const OG = {
  W: 1200,
  H: 630,
  X: 76,
  CW: 616,
  PAD: 40,
  CX: 76 + 40,
  CR: 76 + 616 - 40,
  RIGHT: 772,
  ROW_H: 60,
} as const;

export const SVG_COLORS = {
  ground: '#E6E9F0',
  paper: '#FFFFFF',
  ink: '#141418',
  inkSoft: '#565B6B',
  inkFaint: '#98A0B0',
  hairline: '#E2E6EC',
  perf: '#C6CDD9',
  goldText: '#96691C',
  gold1: '#C59B3F',
  gold2: '#E8C865',
  givenText: '#C2620A',
  givenRail: '#F59E0B',
  takenText: '#7E22CE',
  takenRail: '#A855F7',
  urlGray: '#8B93A3',
} as const;

const TEAR_TO_LINE = 286;
const LINE_TO_ROW0 = 56;
const EXTRA_ROW = 34;
const MAX_ROWS = 3;

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function shortDate(value: string | number): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${String(d.getFullYear()).slice(2)}`;
}

function mulberry32(a: number): () => number {
  let s = a;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Рваный верхний край листа: зубцы неравной глубины, форма сеется датой снимка. */
function tornPath(x: number, y: number, w: number, h: number, seed: number): string {
  const rng = mulberry32(seed);
  const r = 24;
  const amp = 9;
  let d = `M${x} ${(y + amp * 0.5).toFixed(1)}`;
  let px = x;
  while (px < x + w) {
    px = Math.min(px + 6 + rng() * 8, x + w);
    d += ` L${px.toFixed(1)} ${(y + rng() * amp * (rng() < 0.18 ? 1.7 : 1)).toFixed(1)}`;
  }
  d += ` L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h}`;
  d += ` L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} Z`;
  return d;
}

/** Высота бумаги — от числа строк: пустой низ выглядел бы обрывом вёрстки. */
export function ogCardHeight(rowCount: number, hasExtra: boolean): number {
  const shown = Math.max(Math.min(rowCount, MAX_ROWS), 1);
  return (
    TEAR_TO_LINE + LINE_TO_ROW0 + (shown - 1) * OG.ROW_H + 22 + 32 + (hasExtra ? EXTRA_ROW : 0)
  );
}

export function ogLayout(cardH: number): { y: number; tearY: number; row0: number } {
  const y = (OG.H - cardH) / 2;
  const tearY = y + TEAR_TO_LINE;
  return { y, tearY, row0: tearY + LINE_TO_ROW0 };
}

/** Подложка в разлиновку, бумага с тенью и бровь листа: марка, имя, дата снимка. */
export function ogChrome(dateLabel: string, seed: number, cardH: number, y: number): string {
  let rules = '';
  for (let ry = 16.5; ry < OG.H; ry += 30) {
    rules += `<line x1="0" y1="${ry}" x2="${OG.W}" y2="${ry}" stroke="#141828" stroke-opacity="0.05" stroke-width="1"/>`;
  }
  return `<defs>
    <linearGradient id="au" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${SVG_COLORS.gold1}"/><stop offset="0.5" stop-color="${SVG_COLORS.gold2}"/><stop offset="1" stop-color="${SVG_COLORS.gold1}"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="13" stdDeviation="16" flood-color="#111628" flood-opacity="0.17"/>
    </filter>
  </defs>
  <rect width="${OG.W}" height="${OG.H}" fill="${SVG_COLORS.ground}"/>${rules}
  <path d="${tornPath(OG.X, y, OG.CW, cardH, seed)}" fill="${SVG_COLORS.paper}" filter="url(#sh)"/>
  <circle cx="${OG.CX + 15}" cy="${y + 48}" r="15" fill="${SVG_COLORS.ink}"/>
  <circle cx="${OG.CX + 15}" cy="${y + 48}" r="8.3" fill="none" stroke="url(#au)" stroke-width="5.1"/>
  <text x="${OG.CX + 44}" y="${y + 55}" font-family="${SHARE_DISPLAY}" font-size="18" font-weight="600" letter-spacing="2.6" fill="${SVG_COLORS.goldText}">OURO FINANCE</text>
  <text x="${OG.CR}" y="${y + 55}" text-anchor="end" font-family="${SHARE_MONO}" font-size="18" font-weight="500" fill="${SVG_COLORS.inkFaint}">${escapeXml(dateLabel)}</text>
  <line x1="${OG.CX}" y1="${y + 78}" x2="${OG.CR}" y2="${y + 78}" stroke="${SVG_COLORS.hairline}" stroke-width="2"/>`;
}

/** Линия отрыва: перфорация между вырезами, прогрызенными до подложки. */
export function ogTear(tearY: number): string {
  return `<circle cx="${OG.X}" cy="${tearY}" r="17" fill="${SVG_COLORS.ground}"/>
  <circle cx="${OG.X + OG.CW}" cy="${tearY}" r="17" fill="${SVG_COLORS.ground}"/>
  <line x1="${OG.X + 29}" y1="${tearY}" x2="${OG.X + OG.CW - 29}" y2="${tearY}" stroke="${SVG_COLORS.perf}" stroke-width="4" stroke-dasharray="2 11" stroke-linecap="round"/>`;
}

/** Валюта — tspan в том же text: ширину суммы посчитает рендерер, а не мы. */
export function ogHero(o: {
  y: number;
  subject: string;
  amount: string;
  currency: string;
  color: string;
  caption: string;
}): string {
  return `<text x="${OG.CX}" y="${o.y + 124}" font-family="${SHARE_DISPLAY}" font-size="24" font-weight="600" fill="${SVG_COLORS.ink}">${escapeXml(truncate(o.subject, 26))}</text>
  <text x="${OG.CX}" y="${o.y + 194}" font-family="${SHARE_DISPLAY}" font-size="58" font-weight="800" letter-spacing="-1" fill="${o.color}">${escapeXml(o.amount)}<tspan dx="14" font-size="26" font-weight="600" letter-spacing="0" fill="${SVG_COLORS.inkSoft}">${escapeXml(o.currency)}</tspan></text>
  <text x="${OG.CX}" y="${o.y + 234}" font-family="${SHARE_DISPLAY}" font-size="22" font-weight="500" fill="${SVG_COLORS.inkSoft}">${escapeXml(o.caption)}</text>`;
}

export interface OgRow {
  color: string;
  title: string;
  sub: string;
  amount: string;
  unit: [one: string, few: string, many: string];
}

/** Цвет приходит из данных — в разметку пускаем только настоящий hex. */
function safeColor(color: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : SVG_COLORS.givenRail;
}

export function ogRows(rows: OgRow[], row0: number): string {
  const visible = rows.slice(0, MAX_ROWS);
  let out = '';
  visible.forEach((row, i) => {
    const y = row0 + i * OG.ROW_H;
    // Мерить текст в SVG нечем — режем по знакам, с оглядкой на длину суммы
    const title = truncate(row.title, row.amount.length > 9 ? 18 : 22);
    out += `<rect x="${OG.CX}" y="${y - 21}" width="5" height="46" rx="2.5" fill="${safeColor(row.color)}"/>
  <text x="${OG.CX + 26}" y="${y}" font-family="${SHARE_DISPLAY}" font-size="24" font-weight="500" fill="${SVG_COLORS.ink}">${escapeXml(title)}</text>
  <text x="${OG.CX + 26}" y="${y + 22}" font-family="${SHARE_DISPLAY}" font-size="17" font-weight="500" fill="${SVG_COLORS.inkFaint}">${escapeXml(row.sub)}</text>
  <text x="${OG.CR}" y="${y}" text-anchor="end" font-family="${SHARE_MONO}" font-size="24" font-weight="600" fill="${SVG_COLORS.ink}">${escapeXml(row.amount)}</text>`;
  });

  const extra = rows.length - visible.length;
  if (extra > 0 && rows[0]) {
    const [one, few, many] = rows[0].unit;
    out += `<text x="${OG.CX + 26}" y="${row0 + visible.length * OG.ROW_H + 4}" font-family="${SHARE_DISPLAY}" font-size="20" font-weight="500" fill="${SVG_COLORS.inkFaint}">и ещё ${extra} ${plural(extra, one, few, many)}</text>`;
  }
  return out;
}

/** Постер выровнен по холсту, а не по бумаге: её высота гуляет от числа строк. */
export function ogPoster(line1: string, line2: string, sub: string, cta: string): string {
  const { RIGHT } = OG;
  return `<text x="${RIGHT}" y="212" font-family="${SHARE_DISPLAY}" font-size="60" font-weight="800" letter-spacing="-1.2" fill="${SVG_COLORS.ink}">${escapeXml(line1)}</text>
  <text x="${RIGHT}" y="280" font-family="${SHARE_DISPLAY}" font-size="60" font-weight="800" letter-spacing="-1.2" fill="${SVG_COLORS.ink}">${escapeXml(line2)}</text>
  <text x="${RIGHT}" y="336" font-family="${SHARE_DISPLAY}" font-size="23" font-weight="500" fill="${SVG_COLORS.inkSoft}">${escapeXml(sub)}</text>
  <rect x="${RIGHT}" y="378" width="296" height="70" rx="35" fill="${SVG_COLORS.ink}"/>
  <text x="${RIGHT + 148}" y="422" text-anchor="middle" font-family="${SHARE_DISPLAY}" font-size="24" font-weight="800" fill="#ffffff">${escapeXml(cta)}</text>
  <text x="${RIGHT}" y="500" font-family="${SHARE_MONO}" font-size="18" font-weight="500" fill="${SVG_COLORS.urlGray}">app.ouro-finance.top</text>`;
}

export { formatAmount as bareAmount };
