/**
 * Оболочка «карточек для шаринга» — картинок, которые пользователь отправляет в
 * мессенджер вместо скриншота экрана.
 *
 * Карточка — лист бумаги на подложке: рваный сверху край, линия отрыва с
 * вырезами, разлинованный «стол» вокруг. Подложка своя и непрозрачная — иначе
 * в вырезы просвечивал бы фон мессенджера. Светлая независимо от темы
 * приложения: её смотрят в чужой ленте.
 */

/** Ретина: рисуем в 2× и отдаём в 2×, иначе текст мылит на телефоне. */
export const SHARE_SCALE = 2;

export const SHARE_COLORS = {
  ground: '#E6E9F0',
  rule: 'rgba(20,24,40,0.055)',
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
  url: '#8B93A3',
} as const;

export const DISPLAY = '"Golos Text", -apple-system, BlinkMacSystemFont, sans-serif';
export const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace';

export const APP_NAME = 'OURO FINANCE';
export const APP_URL = 'app.ouro-finance.top';

const W = 480;
const MARGIN = 20;
const CARD_W = W - MARGIN * 2;
const PAD = 24;

export const CARD = {
  W,
  MARGIN,
  CARD_W,
  PAD,
  CX: MARGIN + PAD,
  CR: MARGIN + CARD_W - PAD,
  CW: CARD_W - PAD * 2,
  GUTTER: 15,
  TEAR_AMP: 6,
  CARD_Y: 16,
} as const;

/** Тело карточки: `draw = false` — только считает, `true` — ещё и рисует. */
export type CardBody = (ctx: CanvasRenderingContext2D, draw: boolean) => number;

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Рваный край: зубцы неравной глубины, изредка укус вдвое глубже. Ровная пила
 * читалась бы как декор. Форма сеется датой снимка — одни данные дают одну
 * картинку.
 */
function tearPoints(x: number, w: number, amp: number, seed: number): Array<[number, number]> {
  const rng = mulberry32(seed);
  const points: Array<[number, number]> = [[x, amp * 0.5]];
  let px = x;
  while (px < x + w) {
    px = Math.min(px + 4 + rng() * 5, x + w);
    points.push([px, rng() * amp * (rng() < 0.18 ? 1.7 : 1)]);
  }
  return points;
}

function cardPath(ctx: CanvasRenderingContext2D, height: number, seed: number): void {
  const { MARGIN: x, CARD_Y: y, CARD_W: w, TEAR_AMP } = CARD;
  const r = 16;
  ctx.beginPath();
  const points = tearPoints(x, w, TEAR_AMP, seed);
  ctx.moveTo(points[0][0], y + points[0][1]);
  for (const [px, dy] of points) ctx.lineTo(px, y + dy);
  ctx.lineTo(x + w, y + height - r);
  ctx.quadraticCurveTo(x + w, y + height, x + w - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.closePath();
}

/**
 * maxWidth у fillText не обрезает, а сплющивает глифы по горизонтали — на
 * длинном названии это читается как сломанный шрифт. Режем сами.
 */
export function fit(ctx: CanvasRenderingContext2D, value: string, max?: number): string {
  if (max === undefined || ctx.measureText(value).width <= max) return value;
  let lo = 0;
  let hi = value.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(`${value.slice(0, mid)}…`).width <= max) lo = mid;
    else hi = mid - 1;
  }
  return `${value.slice(0, lo).trimEnd()}…`;
}

interface TextOptions {
  font: string;
  color: string;
  align?: CanvasTextAlign;
  track?: number;
  max?: number;
}

export function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  { font, color, align = 'left', track = 0, max }: TextOptions,
): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.letterSpacing = track ? `${track}px` : '0px';
  ctx.fillText(fit(ctx, value, max), x, y);
  ctx.letterSpacing = '0px';
}

export function measure(
  ctx: CanvasRenderingContext2D,
  value: string,
  font: string,
  track = 0,
): number {
  ctx.font = font;
  ctx.letterSpacing = track ? `${track}px` : '0px';
  const width = ctx.measureText(value).width;
  ctx.letterSpacing = '0px';
  return width;
}

/** Кольцо-ороборос — единственное место, где живёт золотой градиент. */
export function drawMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  const r = size / 2;

  ctx.beginPath();
  ctx.fillStyle = SHARE_COLORS.ink;
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  const gradient = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  gradient.addColorStop(0, SHARE_COLORS.gold1);
  gradient.addColorStop(0.5, SHARE_COLORS.gold2);
  gradient.addColorStop(1, SHARE_COLORS.gold1);

  ctx.beginPath();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = size * 0.17;
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
}

/** Линия отрыва: перфорация между вырезами, прогрызенными до подложки. */
export function drawTear(ctx: CanvasRenderingContext2D, y: number): void {
  const { MARGIN: x, CARD_W: w } = CARD;

  ctx.save();
  ctx.fillStyle = SHARE_COLORS.ground;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w, y, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.setLineDash([1.5, 6]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = SHARE_COLORS.perf;
  ctx.lineWidth = 2;
  ctx.moveTo(x + 17, y);
  ctx.lineTo(x + w - 17, y);
  ctx.stroke();
  ctx.restore();
}

/** Вертикальная плашка в жёлобе: у долга кодирует направление, у участника — его цвет. */
export function rail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, 3, height, 1.5);
  ctx.fill();
}

/** Бровь листа: марка, название приложения и дата снимка. Возвращает y волосяной линии. */
export function eyebrow(ctx: CanvasRenderingContext2D, draw: boolean, rightLabel: string): number {
  const { CX, CR, CARD_Y, TEAR_AMP } = CARD;
  const y = CARD_Y + TEAR_AMP + 9;

  if (draw) {
    drawMark(ctx, CX + 9, y + 8, 18);
    text(ctx, APP_NAME, CX + 26, y + 12, {
      font: `600 11px ${DISPLAY}`,
      color: SHARE_COLORS.goldText,
      track: 1.6,
    });
    text(ctx, rightLabel, CR, y + 12, {
      font: `500 11px ${MONO}`,
      color: SHARE_COLORS.inkFaint,
      align: 'right',
    });

    ctx.beginPath();
    ctx.strokeStyle = SHARE_COLORS.hairline;
    ctx.lineWidth = 1;
    ctx.moveTo(CX, y + 28.5);
    ctx.lineTo(CR, y + 28.5);
    ctx.stroke();
  }

  return y + 28;
}

/** Сумма-герой: валюта мельче и тише, иначе съедает ширину у самих цифр. */
export function hero(
  ctx: CanvasRenderingContext2D,
  draw: boolean,
  y: number,
  amount: string,
  currency: string,
  color: string,
): void {
  if (!draw) return;

  const font = `800 38px ${DISPLAY}`;
  const width = measure(ctx, amount, font, -0.8);
  text(ctx, amount, CARD.CX, y, { font, color, track: -0.8 });
  text(ctx, currency, CARD.CX + width + 7, y, {
    font: `600 17px ${DISPLAY}`,
    color: SHARE_COLORS.inkSoft,
  });
}

/**
 * Тело карточки описывается один раз и вызывается дважды: сначала на замер,
 * потом на отрисовку. Отдельная формула высоты расходилась бы с рисованием при
 * любой правке шапки — и молча оставляла мёртвую полосу внизу.
 */
export function renderCard(body: CardBody, seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const cardHeight = body(ctx, false) - CARD.CARD_Y;
  const height = CARD.CARD_Y + cardHeight + 46;

  canvas.width = CARD.W * SHARE_SCALE;
  canvas.height = height * SHARE_SCALE;
  canvas.style.width = `${CARD.W}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(SHARE_SCALE, SHARE_SCALE);

  ctx.fillStyle = SHARE_COLORS.ground;
  ctx.fillRect(0, 0, CARD.W, height);
  ctx.strokeStyle = SHARE_COLORS.rule;
  ctx.lineWidth = 1;
  for (let y = 12.5; y < height; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD.W, y);
    ctx.stroke();
  }

  ctx.save();
  ctx.shadowColor = 'rgba(17,22,40,0.14)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = SHARE_COLORS.paper;
  cardPath(ctx, cardHeight, seed);
  ctx.fill();
  ctx.restore();

  body(ctx, true);

  // Адрес приложения — на подложке, снаружи документа: там водяному знаку и место
  text(ctx, APP_URL, CARD.W / 2, CARD.CARD_Y + cardHeight + 29, {
    font: `500 11px ${MONO}`,
    color: SHARE_COLORS.url,
    align: 'center',
  });

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/png',
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Имя файла из произвольного заголовка: латиница/кириллица/цифры, остальное — дефис. */
export function buildShareFilename(title: string, isoDate: string, fallback: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
  return `ouro-${slug || fallback}-${isoDate}.png`;
}

/**
 * Дата на карточке — всегда `31.08.26`. Длинная форма («31 августа 2026 г.»)
 * занимает половину брови и в подстрочнике долга выталкивает срок под обрезку.
 */
export function shortDate(value: string | number): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${String(d.getFullYear()).slice(2)}`;
}

/** Целые с группировкой по три и без символа валюты — валюта названа один раз, в шапке. */
export function bareAmount(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
