import { ref } from 'vue';
import { useToast } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatCardNumber } from '@/shared/lib/format/cardNumber';
import { formatLocalDate } from '@/shared/lib/format/date';
import { toLocalISODate } from '@/shared/lib/date';
import {
  APP_URL,
  buildShareFilename,
  canvasToBlob,
  downloadBlob,
} from '@/shared/lib/share/shareCard';
import { debtShareApi, type SharedDebtsPayload } from '@/entities/debt';
import { ensureShareFonts } from '@/shared/lib/share/shareFonts';
import { renderDebtsCardToCanvas } from './renderDebtsCard';

function buildShareText(payload: SharedDebtsPayload): string {
  const isPositive = payload.net >= 0;
  const net = formatCurrency(Math.abs(payload.net), payload.currency);
  const lines = [
    `${payload.personName} — ${isPositive ? `должен ${net}` : `вы должны ${net}`}`,
    `на ${formatLocalDate(payload.snapshotAt)}`,
    '',
  ];

  for (const debt of payload.debts) {
    const remaining = formatCurrency(debt.remainingAmount, debt.currency);
    const forgiven =
      debt.forgivenAmount > 0
        ? `, прощено ${formatCurrency(debt.forgivenAmount, debt.currency)}`
        : '';
    const due = debt.dueDate ? `, до ${formatLocalDate(debt.dueDate)}` : '';
    lines.push(`${debt.title}: ${remaining}${forgiven}${due}`);
  }

  if (payload.debts.length === 0) lines.push('Открытых долгов нет');

  if (payload.cardNumber) {
    lines.push('', `Карта для перевода: ${formatCardNumber(payload.cardNumber)}`);
  }

  lines.push('', `Сверено в Ouro Finance — ${APP_URL}`);
  return lines.join('\n');
}

function buildFilename(payload: SharedDebtsPayload): string {
  return buildShareFilename(
    payload.personName,
    toLocalISODate(new Date(payload.snapshotAt)),
    'debts',
  );
}

export function useDebtsShare() {
  const { trigger } = useHaptics();
  const { toast } = useToast();

  const isSharing = ref(false);
  const isCreatingLink = ref(false);
  const createdUrl = ref<string | null>(null);
  const linkError = ref<string | null>(null);

  function resetLink(): void {
    createdUrl.value = null;
    linkError.value = null;
  }

  /**
   * Картинка отдаётся через системный шеринг, а где его нет — скачивается.
   * `navigator.canShare` спрашиваем именно с файлом: браузеры умеют шарить
   * текст, но не файлы, и без проверки шаринг падал бы уже после рендера.
   */
  async function shareAsImage(payload: SharedDebtsPayload): Promise<void> {
    isSharing.value = true;
    // Рендер тоже внутри try: он умеет бросать (нет 2d-контекста, не хватило
    // памяти под холст), и снаружи оставил бы кнопку навсегда в загрузке.
    let canvas: HTMLCanvasElement | null = null;
    try {
      await ensureShareFonts();
      canvas = renderDebtsCardToCanvas(payload);
      const blob = await canvasToBlob(canvas);
      const filename = buildFilename(payload);
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        trigger('success');
      } else {
        downloadBlob(blob, filename);
        toast({ title: 'Изображение сохранено', variant: 'success' });
      }
    } catch (error) {
      // Отмена системного шаринга — не ошибка
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Share debts image failed:', error);
      toast({ title: 'Не удалось поделиться', variant: 'error' });
    } finally {
      // Освобождаем буфер сразу: на длинных списках холст занимает мегабайты
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      isSharing.value = false;
    }
  }

  async function saveAsImage(payload: SharedDebtsPayload): Promise<void> {
    isSharing.value = true;
    let canvas: HTMLCanvasElement | null = null;
    try {
      await ensureShareFonts();
      canvas = renderDebtsCardToCanvas(payload);
      const blob = await canvasToBlob(canvas);
      downloadBlob(blob, buildFilename(payload));
      toast({ title: 'Изображение сохранено', variant: 'success' });
    } catch (error) {
      console.error('Save debts image failed:', error);
      toast({ title: 'Не удалось сохранить', variant: 'error' });
    } finally {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      isSharing.value = false;
    }
  }

  async function shareAsText(payload: SharedDebtsPayload): Promise<void> {
    isSharing.value = true;
    const text = buildShareText(payload);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        trigger('success');
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Скопировано', variant: 'success' });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
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

  /** Ссылка создаётся один раз на открытие шторки — повторный тап её не пересоздаёт. */
  async function createLink(payload: SharedDebtsPayload): Promise<void> {
    if (createdUrl.value || isCreatingLink.value) return;
    isCreatingLink.value = true;
    linkError.value = null;
    try {
      const { url } = await debtShareApi.share(payload);
      createdUrl.value = url;
      trigger('success');
    } catch (error) {
      linkError.value = error instanceof Error ? error.message : 'Не удалось создать ссылку';
      trigger('error');
    } finally {
      isCreatingLink.value = false;
    }
  }

  async function copyLink(): Promise<void> {
    if (!createdUrl.value) return;
    try {
      await navigator.clipboard.writeText(createdUrl.value);
      trigger('success');
      toast({ title: 'Ссылка скопирована' });
    } catch {
      toast({ title: 'Не удалось скопировать', variant: 'error' });
    }
  }

  async function shareLink(personName: string): Promise<void> {
    if (!createdUrl.value) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Долги: ${personName}`, url: createdUrl.value });
        return;
      } catch (error) {
        // Отменил шаринг — молча выходим, ссылка уже на экране.
        // Любой другой отказ (шаринг ссылок не поддержан, нет жеста) — не повод
        // оставить тап без ответа: кладём ссылку в буфер.
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    await copyLink();
  }

  return {
    isSharing,
    isCreatingLink,
    createdUrl,
    linkError,
    resetLink,
    shareAsImage,
    saveAsImage,
    shareAsText,
    createLink,
    copyLink,
    shareLink,
    buildShareText,
  };
}
