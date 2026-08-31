/**
 * Общие примитивы «карточек для шаринга» — картинок, которые пользователь
 * отправляет в мессенджер вместо скриншота экрана.
 *
 * Карточка всегда светлая, независимо от темы приложения: её смотрят в чужой
 * ленте, где тёмный прямоугольник выглядит инородно, а не в самом приложении.
 */

export const SHARE_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/** Ретина: рисуем в 2× и отдаём в 2×, иначе текст мылит на телефоне. */
export const SHARE_SCALE = 2;

export const SHARE_COLORS = {
  bg: '#FAFAFA',
  brand: '#c59b3f',
  brandLight: '#e8c865',
  textPrimary: '#09090B',
  textSecondary: '#71717A',
  textTertiary: '#A1A1AA',
  textWhite: '#FFFFFF',
  divider: '#E4E4E7',
} as const;

export const APP_NAME = 'OURO FINANCE';
export const APP_URL = 'app.ouro-finance.top';

export function createGoldGradient(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): CanvasGradient {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, SHARE_COLORS.brand);
  g.addColorStop(0.5, SHARE_COLORS.brandLight);
  g.addColorStop(1, SHARE_COLORS.brand);
  return g;
}

/** Логотип рисуется кодом, а не картинкой: PNG-ассет пришлось бы ждать по сети. */
export function drawBrandLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  const r = size / 2;
  const strokeWidth = size * 0.18;
  const gradient = createGoldGradient(ctx, cx - r, cy - r, cx + r, cy + r);

  ctx.beginPath();
  ctx.fillStyle = SHARE_COLORS.textPrimary;
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Подпись внизу карточки: логотип, название и адрес приложения.
 * Возвращать нечего — блок всегда последний.
 */
export function drawBrandWatermark(
  ctx: CanvasRenderingContext2D,
  cardWidth: number,
  y: number,
): void {
  ctx.beginPath();
  ctx.strokeStyle = SHARE_COLORS.divider;
  ctx.lineWidth = 0.5;
  ctx.moveTo(cardWidth / 2 - 80, y - 4);
  ctx.lineTo(cardWidth / 2 + 80, y - 4);
  ctx.stroke();

  const logoSize = 20;
  ctx.font = `800 12px ${SHARE_FONT_FAMILY}`;
  const brandWidth = ctx.measureText(APP_NAME).width;
  const startX = (cardWidth - (logoSize + 6 + brandWidth)) / 2;

  drawBrandLogo(ctx, startX + logoSize / 2, y + 10, logoSize);

  ctx.font = `800 12px ${SHARE_FONT_FAMILY}`;
  ctx.fillStyle = SHARE_COLORS.brand;
  ctx.textAlign = 'left';
  ctx.fillText(APP_NAME, startX + logoSize + 6, y + 14);

  ctx.font = `500 11px ${SHARE_FONT_FAMILY}`;
  ctx.fillStyle = SHARE_COLORS.textTertiary;
  ctx.textAlign = 'center';
  ctx.fillText(APP_URL, cardWidth / 2, y + 34);
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
