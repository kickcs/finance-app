import { ref } from 'vue';
import { useToast } from '@/shared/ui';
import { haptics } from '@/shared/lib/haptics';
import { formatCurrency } from '@/shared/lib/format/currency';
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
const CARD_WIDTH = 640;
const PADDING_X = 36;
const PADDING_Y = 32;
const SCALE = 2; // retina
const HEADER_HEIGHT = 100;
const PARTICIPANT_NAME_HEIGHT = 36;
const ITEM_LINE_HEIGHT = 24;
const PARTICIPANT_GAP = 12;
const DIVIDER_GAP = 24;
const TOTAL_SECTION_HEIGHT = 48;
const SERVICE_LINE_HEIGHT = 24;
const CONTENT_WIDTH = CARD_WIDTH - PADDING_X * 2;
const NAME_MAX_WIDTH = CONTENT_WIDTH - 200;
const ITEMS_INDENT = PADDING_X + 20;
const AMOUNT_X = CARD_WIDTH - PADDING_X;

// Colors
const BG_COLOR = '#FAFAFA';
const TEXT_PRIMARY = '#09090B';
const TEXT_SECONDARY = '#71717A';
const TEXT_TERTIARY = '#A1A1AA';
const DIVIDER_COLOR = '#E4E4E7';

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
  // Brand
  ctx.font = `500 13px ${FONT_FAMILY}`;
  ctx.fillStyle = TEXT_TERTIARY;
  ctx.textAlign = 'left';
  ctx.fillText('My Finance', PADDING_X, y + 13);
  y += 28;

  // Store name
  ctx.font = `700 22px ${FONT_FAMILY}`;
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.fillText(data.storeName || 'Чек', PADDING_X, y + 22, CONTENT_WIDTH);
  y += 34;

  // Date
  ctx.font = `400 14px ${FONT_FAMILY}`;
  ctx.fillStyle = TEXT_SECONDARY;
  ctx.fillText(formatShareDate(data.date), PADDING_X, y + 14);
  y += 28;

  return y;
}

function calcParticipantsHeight(data: ReceiptShareData): number {
  let h = 0;
  for (const p of data.participants) {
    h += PARTICIPANT_NAME_HEIGHT;
    h += p.items.length * ITEM_LINE_HEIGHT;
    h += PARTICIPANT_GAP;
  }
  // Remove last gap
  if (data.participants.length > 0) h -= PARTICIPANT_GAP;
  return h;
}

function drawParticipants(ctx: CanvasRenderingContext2D, data: ReceiptShareData, y: number): number {
  for (let i = 0; i < data.participants.length; i++) {
    const p = data.participants[i];
    const centerY = y + PARTICIPANT_NAME_HEIGHT / 2;

    // Color dot
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(PADDING_X + 6, centerY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Name
    ctx.font = `500 15px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.textAlign = 'left';
    const displayName = p.name + (p.isMe ? ' (вы)' : '');
    ctx.fillText(displayName, PADDING_X + 20, centerY + 5, NAME_MAX_WIDTH);

    // Amount
    ctx.font = `600 15px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrency(p.total, data.currency), AMOUNT_X, centerY + 5);

    y += PARTICIPANT_NAME_HEIGHT;

    // Items
    ctx.font = `400 12px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_TERTIARY;
    for (const item of p.items) {
      ctx.textAlign = 'left';
      ctx.fillText(formatItemName(item), ITEMS_INDENT, y + 14, NAME_MAX_WIDTH - 20);

      ctx.textAlign = 'right';
      ctx.fillText(formatCurrency(item.share, data.currency), AMOUNT_X, y + 14);

      y += ITEM_LINE_HEIGHT;
    }

    // Gap between participants
    if (i < data.participants.length - 1) {
      y += PARTICIPANT_GAP;
    }
  }
  return y;
}

function drawTotal(ctx: CanvasRenderingContext2D, data: ReceiptShareData, y: number): number {
  ctx.font = `500 15px ${FONT_FAMILY}`;
  ctx.fillStyle = TEXT_SECONDARY;
  ctx.textAlign = 'left';
  ctx.fillText('Итого', PADDING_X, y + 20);

  ctx.font = `700 20px ${FONT_FAMILY}`;
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.textAlign = 'right';
  ctx.fillText(formatCurrency(data.totalAmount, data.currency), AMOUNT_X, y + 22);
  y += TOTAL_SECTION_HEIGHT;

  // Service charge note
  if (data.serviceChargePercent && data.serviceChargeAmount > 0) {
    ctx.font = `400 12px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_TERTIARY;
    ctx.textAlign = 'left';
    ctx.fillText(`вкл. обслуживание ${data.serviceChargePercent}%`, PADDING_X, y + 4);
  }

  return y;
}

function renderCardToCanvas(data: ReceiptShareData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Calculate total height
  const participantsHeight = calcParticipantsHeight(data);
  const serviceLineHeight = data.serviceChargePercent && data.serviceChargeAmount > 0 ? SERVICE_LINE_HEIGHT : 0;
  const totalHeight =
    PADDING_Y + HEADER_HEIGHT + DIVIDER_GAP + participantsHeight + DIVIDER_GAP +
    TOTAL_SECTION_HEIGHT + serviceLineHeight + PADDING_Y;

  // Set canvas size (retina)
  canvas.width = CARD_WIDTH * SCALE;
  canvas.height = totalHeight * SCALE;
  canvas.style.width = `${CARD_WIDTH}px`;
  canvas.style.height = `${totalHeight}px`;
  ctx.scale(SCALE, SCALE);

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CARD_WIDTH, totalHeight);

  let y = PADDING_Y;
  y = drawHeader(ctx, data, y);
  y = drawDivider(ctx, y);
  y = drawParticipants(ctx, data, y);
  y = drawDivider(ctx, y);
  drawTotal(ctx, data, y);

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

  return lines.join('\n');
}

const SHARE_FILENAME = 'receipt-split.png';

export function useReceiptShare() {
  const isSharing = ref(false);
  const { toast } = useToast();

  async function shareAsImage(data: ReceiptShareData): Promise<void> {
    isSharing.value = true;
    try {
      const canvas = renderCardToCanvas(data);
      const blob = await canvasToBlob(canvas);
      const file = new File([blob], SHARE_FILENAME, { type: 'image/png' });
      const text = buildShareText(data);

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        haptics.success();
      } else {
        downloadBlob(blob, SHARE_FILENAME);
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
      downloadBlob(blob, SHARE_FILENAME);
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
