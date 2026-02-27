import { ref } from 'vue';
import { useToast } from '@/shared/ui';
import { haptics } from '@/shared/lib/haptics';
import { formatCurrency } from '@/shared/lib/format/currency';
import { getInitial } from '@/shared/lib/format/text';
import type { ParticipantSummary } from './types';

export interface ReceiptShareData {
  storeName: string | null;
  date: number;
  currency: string;
  totalAmount: number;
  subtotal: number;
  serviceChargePercent: number | null;
  serviceChargeAmount: number;
  participants: ParticipantSummary[];
}

// --- Canvas layout constants ---
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const CARD_WIDTH = 480;
const PADDING_X = 28;
const PADDING_Y = 24;
const SCALE = 2; // retina
const HEADER_HEIGHT = 180;
const PARTICIPANT_NAME_HEIGHT = 36;
const PARTICIPANT_GAP = 12;
const PARTICIPANT_SECTION_HEADER = 40; // "КТО СКОЛЬКО ДОЛЖЕН" title
const DIVIDER_GAP = 24;
const SERVICE_CHARGE_HEIGHT = 30;
const WATERMARK_SECTION_HEIGHT = 80; // logo + name + URL
const CONTENT_WIDTH = CARD_WIDTH - PADDING_X * 2;
const NAME_MAX_WIDTH = CONTENT_WIDTH - 200;
const AMOUNT_X = CARD_WIDTH - PADDING_X;

// Colors
const BG_COLOR = '#FAFAFA';
const BRAND_COLOR = '#c59b3f'; // Gold from logo
const BRAND_GOLD_LIGHT = '#e8c865';
const TEXT_PRIMARY = '#09090B';
const TEXT_SECONDARY = '#71717A';
const TEXT_TERTIARY = '#A1A1AA';
const TEXT_WHITE = '#FFFFFF';
const DIVIDER_COLOR = '#E4E4E7';

function createGoldGradient(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): CanvasGradient {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, BRAND_COLOR);
  g.addColorStop(0.5, BRAND_GOLD_LIGHT);
  g.addColorStop(1, BRAND_COLOR);
  return g;
}

// Brand
const APP_NAME = 'OURO FINANCE';
const APP_URL = 'app.ouro-finance.top';
const LOGO_SIZE = 24;

function formatItemName(item: { name: string; sharedWith: number }): string {
  return item.sharedWith > 1 ? `${item.name} (1/${item.sharedWith})` : item.name;
}

function formatShareDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// --- Logo drawing (programmatic — gold ring from favicon.svg) ---

function drawLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const r = size / 2;
  const strokeWidth = size * 0.18;

  // Gold gradient ring
  const gradient = createGoldGradient(ctx, cx - r, cy - r, cx + r, cy + r);

  // Dark circle background
  ctx.beginPath();
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Gold ring
  ctx.beginPath();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
}

// --- Canvas drawing helpers ---

function drawDivider(ctx: CanvasRenderingContext2D, y: number): number {
  y += 4;
  ctx.beginPath();
  ctx.strokeStyle = DIVIDER_COLOR;
  ctx.lineWidth = 1;
  ctx.moveTo(PADDING_X, y);
  ctx.lineTo(CARD_WIDTH - PADDING_X, y);
  ctx.stroke();
  return y + DIVIDER_GAP - 4;
}

function drawHeader(ctx: CanvasRenderingContext2D, data: ReceiptShareData, y: number): number {
  // Brand with logo
  const brandText = APP_NAME;
  ctx.font = `700 13px ${FONT_FAMILY}`;
  const brandWidth = ctx.measureText(brandText).width;
  const totalBrandWidth = LOGO_SIZE + 8 + brandWidth;
  const brandStartX = (CARD_WIDTH - totalBrandWidth) / 2;

  drawLogo(ctx, brandStartX + LOGO_SIZE / 2, y + 10, LOGO_SIZE);

  ctx.font = `700 13px ${FONT_FAMILY}`;
  ctx.fillStyle = BRAND_COLOR;
  ctx.textAlign = 'left';
  ctx.fillText(brandText, brandStartX + LOGO_SIZE + 8, y + 15);
  y += 40;

  // Store name
  ctx.font = `600 16px ${FONT_FAMILY}`;
  ctx.fillStyle = TEXT_TERTIARY;
  ctx.textAlign = 'center';
  ctx.fillText(
    (data.storeName || 'Чек оплачен').toUpperCase(),
    CARD_WIDTH / 2,
    y + 16,
    CONTENT_WIDTH,
  );
  y += 34;

  // Amount
  ctx.font = `900 48px ${FONT_FAMILY}`;
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.textAlign = 'center';
  ctx.fillText(formatCurrency(data.totalAmount, data.currency), CARD_WIDTH / 2, y + 48);
  y += 70;

  // Date
  ctx.font = `500 14px ${FONT_FAMILY}`;
  ctx.fillStyle = TEXT_SECONDARY;
  ctx.textAlign = 'center';
  ctx.fillText(formatShareDate(data.date), CARD_WIDTH / 2, y + 14);
  y += 36;

  return y;
}

function calcParticipantsHeight(data: ReceiptShareData): number {
  const owers = data.participants.filter((p) => !p.isMe && p.total > 0);

  // Section header "КТО СКОЛЬКО ДОЛЖЕН"
  let h = PARTICIPANT_SECTION_HEADER;

  if (owers.length === 0) {
    return h + 40; // empty state text
  }

  // Each participant row
  h += owers.length * PARTICIPANT_NAME_HEIGHT;
  // Gaps between participants (not after last)
  if (owers.length > 1) {
    h += (owers.length - 1) * PARTICIPANT_GAP;
  }

  return h;
}

function drawParticipants(
  ctx: CanvasRenderingContext2D,
  data: ReceiptShareData,
  y: number,
): number {
  ctx.font = `600 13px ${FONT_FAMILY}`;
  ctx.fillStyle = TEXT_TERTIARY;
  ctx.textAlign = 'left';
  ctx.fillText('КТО СКОЛЬКО ДОЛЖЕН', PADDING_X, y + 15);
  y += PARTICIPANT_SECTION_HEADER;

  const owers = data.participants.filter((p) => !p.isMe && p.total > 0);

  if (owers.length === 0) {
    ctx.font = `400 15px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_TERTIARY;
    ctx.textAlign = 'center';
    ctx.fillText('Никто ничего не должен', CARD_WIDTH / 2, y + 15);
    return y + 40;
  }

  for (let i = 0; i < owers.length; i++) {
    const p = owers[i];
    const centerY = y + PARTICIPANT_NAME_HEIGHT / 2;

    // Color dot (Avatar)
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(PADDING_X + 16, centerY, 14, 0, Math.PI * 2);
    ctx.fill();

    // Initial letter in avatar
    ctx.font = `600 12px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_WHITE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getInitial(p.name), PADDING_X + 16, centerY + 1);

    // Name
    ctx.font = `500 16px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(p.name, PADDING_X + 40, centerY + 5, NAME_MAX_WIDTH);

    // Amount
    ctx.font = `700 16px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrency(p.total, data.currency), AMOUNT_X, centerY + 5);

    // Dotted line connecting name and amount
    const nameWidth = ctx.measureText(p.name).width;
    const amountStr = formatCurrency(p.total, data.currency);
    const amountWidth = ctx.measureText(amountStr).width;

    const lineStartX = PADDING_X + 40 + nameWidth + 10;
    const lineEndX = AMOUNT_X - amountWidth - 10;

    if (lineEndX > lineStartX) {
      ctx.beginPath();
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = DIVIDER_COLOR;
      ctx.lineWidth = 2;
      ctx.moveTo(lineStartX, centerY + 1);
      ctx.lineTo(lineEndX, centerY + 1);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    y += PARTICIPANT_NAME_HEIGHT;

    // Gap between participants
    if (i < owers.length - 1) {
      y += PARTICIPANT_GAP;
    }
  }
  return y;
}

function renderCardToCanvas(data: ReceiptShareData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const participantsHeight = calcParticipantsHeight(data);
  const hasServiceCharge = data.serviceChargePercent && data.serviceChargeAmount > 0;

  const totalHeight =
    PADDING_Y +
    HEADER_HEIGHT +
    DIVIDER_GAP +
    participantsHeight +
    (hasServiceCharge ? SERVICE_CHARGE_HEIGHT : 0) +
    PADDING_Y +
    WATERMARK_SECTION_HEIGHT;

  // Set canvas size (retina)
  canvas.width = CARD_WIDTH * SCALE;
  canvas.height = totalHeight * SCALE;
  canvas.style.width = `${CARD_WIDTH}px`;
  canvas.style.height = `${totalHeight}px`;
  ctx.scale(SCALE, SCALE);

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CARD_WIDTH, totalHeight);

  // Header banner — gold gradient
  ctx.fillStyle = createGoldGradient(ctx, 0, 0, CARD_WIDTH, 0);
  ctx.fillRect(0, 0, CARD_WIDTH, 8);

  let y = PADDING_Y;
  y = drawHeader(ctx, data, y);

  // Cutout circles (receipt paper effect)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(0, y + 4, 16, 0, Math.PI * 2);
  ctx.arc(CARD_WIDTH, y + 4, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  y = drawDivider(ctx, y);
  y = drawParticipants(ctx, data, y);

  if (hasServiceCharge) {
    ctx.font = `500 13px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_TERTIARY;
    ctx.textAlign = 'center';
    ctx.fillText(
      `Суммы включают ${data.serviceChargePercent}% за обслуживание`,
      CARD_WIDTH / 2,
      y + 24,
    );
  }

  // Watermark: logo + brand name + URL
  const wmY = totalHeight - WATERMARK_SECTION_HEIGHT + 12;

  // Thin divider above watermark
  ctx.beginPath();
  ctx.strokeStyle = DIVIDER_COLOR;
  ctx.lineWidth = 0.5;
  ctx.moveTo(CARD_WIDTH / 2 - 80, wmY - 4);
  ctx.lineTo(CARD_WIDTH / 2 + 80, wmY - 4);
  ctx.stroke();

  // Logo + Brand
  const wmLogoSize = 20;
  ctx.font = `800 12px ${FONT_FAMILY}`;
  const wmBrandWidth = ctx.measureText(APP_NAME).width;
  const wmTotalWidth = wmLogoSize + 6 + wmBrandWidth;
  const wmStartX = (CARD_WIDTH - wmTotalWidth) / 2;

  drawLogo(ctx, wmStartX + wmLogoSize / 2, wmY + 10, wmLogoSize);

  ctx.font = `800 12px ${FONT_FAMILY}`;
  ctx.fillStyle = BRAND_COLOR;
  ctx.textAlign = 'left';
  ctx.fillText(APP_NAME, wmStartX + wmLogoSize + 6, wmY + 14);

  // URL
  ctx.font = `500 11px ${FONT_FAMILY}`;
  ctx.fillStyle = TEXT_TERTIARY;
  ctx.textAlign = 'center';
  ctx.fillText(APP_URL, CARD_WIDTH / 2, wmY + 34);

  return canvas;
}

// --- Sharing utilities ---

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/png',
    );
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildShareText(data: ReceiptShareData): string {
  const title = data.storeName || 'Чек';
  const total = formatCurrency(data.totalAmount, data.currency);
  const lines = [`${title} — ${total}`, ''];

  for (const p of data.participants) {
    const amount = formatCurrency(p.total, data.currency);
    lines.push(`${p.name}: ${amount}`);
    for (const item of p.items) {
      lines.push(`  ${formatItemName(item)} — ${formatCurrency(item.share, data.currency)}`);
    }
  }

  lines.push('', `Рассчитано в Ouro Finance — ${APP_URL}`);
  return lines.join('\n');
}

function buildFilename(data: ReceiptShareData): string {
  const name = (data.storeName || 'receipt')
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
  const date = new Date(data.date).toISOString().slice(0, 10);
  return `ouro-${name}-${date}.png`;
}

export function useReceiptShare() {
  const isSharing = ref(false);
  const { toast } = useToast();

  async function shareAsImage(data: ReceiptShareData): Promise<void> {
    isSharing.value = true;
    try {
      const canvas = renderCardToCanvas(data);
      const blob = await canvasToBlob(canvas);
      const file = new File([blob], buildFilename(data), { type: 'image/png' });
      const text = buildShareText(data);

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        haptics.success();
      } else {
        downloadBlob(blob, buildFilename(data));
        toast({ title: 'Изображение сохранено', variant: 'success' });
        haptics.success();
      }
    } catch (e) {
      // User cancelled share — not an error
      if (e instanceof Error && e.name === 'AbortError') return;
      console.error('Share image failed:', e);
      toast({ title: 'Не удалось поделиться', variant: 'error' });
      haptics.error();
    } finally {
      isSharing.value = false;
    }
  }

  async function shareAsText(data: ReceiptShareData): Promise<void> {
    isSharing.value = true;
    const text = buildShareText(data);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        haptics.success();
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Скопировано', variant: 'success' });
        haptics.success();
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Скопировано', variant: 'success' });
        haptics.success();
      } catch {
        toast({ title: 'Не удалось скопировать', variant: 'error' });
        haptics.error();
      }
    } finally {
      isSharing.value = false;
    }
  }

  async function saveToGallery(data: ReceiptShareData): Promise<void> {
    isSharing.value = true;
    try {
      const canvas = renderCardToCanvas(data);
      const blob = await canvasToBlob(canvas);
      downloadBlob(blob, buildFilename(data));
      toast({ title: 'Изображение сохранено', variant: 'success' });
      haptics.success();
    } catch (e) {
      console.error('Save to gallery failed:', e);
      toast({ title: 'Не удалось сохранить', variant: 'error' });
      haptics.error();
    } finally {
      isSharing.value = false;
    }
  }

  return {
    isSharing,
    shareAsImage,
    shareAsText,
    saveToGallery,
  };
}
