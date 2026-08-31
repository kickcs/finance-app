import { ref } from 'vue';
import { useToast } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import { formatCurrency } from '@/shared/lib/format/currency';
import { toLocalISODate } from '@/shared/lib/date';
import {
  APP_URL,
  buildShareFilename,
  canvasToBlob,
  downloadBlob,
} from '@/shared/lib/share/shareCard';
import { ensureShareFonts } from '@/shared/lib/share/shareFonts';
import { renderReceiptCardToCanvas, type ReceiptShareData } from './renderReceiptCard';

export type { ReceiptShareData };

/** Доля общей позиции в текстовом шаринге: «Ачик-чучук (1/2)». */
function formatItemName(item: { name: string; sharedWith: number }): string {
  return item.sharedWith > 1 ? `${item.name} (1/${item.sharedWith})` : item.name;
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

  const enabledShareCharges = data.charges.filter((c) => c.enabled);
  if (enabledShareCharges.length > 0 && data.chargesAmount > 0) {
    const chargeLabels = enabledShareCharges
      .map((c) =>
        c.type === 'amount'
          ? `${formatCurrency(c.amount, data.currency)} ${c.label.toLowerCase()}`
          : `${c.percent}% ${c.label.toLowerCase()}`,
      )
      .join(', ');
    lines.push('', `Включает ${chargeLabels}`);
  }

  lines.push('', `Рассчитано в Ouro Finance — ${APP_URL}`);
  return lines.join('\n');
}

function buildFilename(data: ReceiptShareData): string {
  return buildShareFilename(
    data.storeName || 'receipt',
    toLocalISODate(new Date(data.date)),
    'receipt',
  );
}

export function useReceiptShare() {
  const { trigger } = useHaptics();
  const isSharing = ref(false);
  const { toast } = useToast();

  async function shareAsImage(data: ReceiptShareData): Promise<void> {
    isSharing.value = true;
    try {
      await ensureShareFonts();
      const canvas = renderReceiptCardToCanvas(data);
      const blob = await canvasToBlob(canvas);
      canvas.width = 0;
      canvas.height = 0;
      const filename = buildFilename(data);
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        trigger('success');
      } else {
        downloadBlob(blob, filename);
        toast({ title: 'Изображение сохранено', variant: 'success' });
      }
    } catch (e) {
      // User cancelled share — not an error
      if (e instanceof Error && e.name === 'AbortError') return;
      console.error('Share image failed:', e);
      toast({ title: 'Не удалось поделиться', variant: 'error' });
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
        trigger('success');
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Скопировано', variant: 'success' });
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Скопировано', variant: 'success' });
      } catch {
        toast({ title: 'Не удалось скопировать', variant: 'error' });
      }
    } finally {
      isSharing.value = false;
    }
  }

  async function saveToGallery(data: ReceiptShareData): Promise<void> {
    isSharing.value = true;
    try {
      await ensureShareFonts();
      const canvas = renderReceiptCardToCanvas(data);
      const blob = await canvasToBlob(canvas);
      canvas.width = 0;
      canvas.height = 0;
      downloadBlob(blob, buildFilename(data));
      toast({ title: 'Изображение сохранено', variant: 'success' });
    } catch (e) {
      console.error('Save to gallery failed:', e);
      toast({ title: 'Не удалось сохранить', variant: 'error' });
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
