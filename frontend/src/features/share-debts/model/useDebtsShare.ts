import { ref } from 'vue';
import { useToast } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import { formatCurrency } from '@/shared/lib/format/currency';
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
import { buildNetLine, buildShareCaption } from './buildShareCaption';

function buildShareText(payload: SharedDebtsPayload): string {
  const lines = [buildNetLine(payload), `на ${formatLocalDate(payload.snapshotAt)}`, ''];

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
    // Сплошными цифрами — как и в подписи к картинке: с пробелами мессенджер уже
    // не узнаёт в строке номер карты и не предлагает скопировать его одним нажатием
    lines.push('', `Карта для перевода: ${payload.cardNumber}`);
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

/** Буфер может быть закрыт (нет разрешения, не тот контекст) — это не повод ронять отправку. */
async function copyQuietly(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
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
   *
   * Вместе с файлом уходит подпись — итог и карта: в чате они станут текстом,
   * который копируется, а не цифрами на картинке. Подпись при файле берут не
   * все платформы, поэтому её спрашиваем отдельным `canShare`, и там, где её не
   * возьмут, кладём в буфер обмена — вставить в то же сообщение остаётся руками.
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
      const caption = buildShareCaption(payload);

      if (navigator.canShare?.({ files: [file], text: caption })) {
        await navigator.share({ files: [file], text: caption });
        trigger('success');
      } else if (navigator.canShare?.({ files: [file] })) {
        // Копируем до вызова шеринга: системный лист забирает фокус, и после
        // него доступ к буферу браузер уже не даёт
        const copied = await copyQuietly(caption);
        await navigator.share({ files: [file] });
        trigger('success');
        if (copied) toast({ title: 'Текст скопирован — вставьте в сообщение' });
      } else {
        downloadBlob(blob, filename);
        const copied = await copyQuietly(caption);
        toast({
          title: copied ? 'Изображение сохранено, текст скопирован' : 'Изображение сохранено',
          variant: 'success',
        });
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

  /** Сохранение — то же самое без системного шеринга: подпись отдаём через буфер. */
  async function saveAsImage(payload: SharedDebtsPayload): Promise<void> {
    isSharing.value = true;
    let canvas: HTMLCanvasElement | null = null;
    try {
      await ensureShareFonts();
      canvas = renderDebtsCardToCanvas(payload);
      const blob = await canvasToBlob(canvas);
      downloadBlob(blob, buildFilename(payload));
      const copied = await copyQuietly(buildShareCaption(payload));
      toast({
        title: copied ? 'Изображение сохранено, текст скопирован' : 'Изображение сохранено',
        variant: 'success',
      });
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
    buildShareCaption,
  };
}
