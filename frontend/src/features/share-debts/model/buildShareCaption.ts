import { formatCurrency } from '@/shared/lib/format/currency';
import type { SharedDebtsPayload } from '@/entities/debt';

/** Итог одной строкой: кто кому должен и сколько. Общий для подписи и текстовой сверки. */
export function buildNetLine(payload: SharedDebtsPayload): string {
  const net = formatCurrency(Math.abs(payload.net), payload.currency);
  return `${payload.personName} — ${payload.net >= 0 ? `должен ${net}` : `вы должны ${net}`}`;
}

/**
 * Подпись, которая уходит вместе с картинкой в системный шеринг.
 *
 * Картинку в чате не выделишь: чтобы вернуть долг, получателю приходится
 * перебивать номер карты руками с изображения. Поэтому рядом с картинкой едет
 * короткий текст — итог и карта, — и уже он в сообщении копируется.
 *
 * Номер карты идёт сплошными цифрами: мессенджеры (Telegram в их числе) сами
 * узнают в тексте номер банковской карты и дают скопировать его одним нажатием,
 * а пробелы между группами эту подсказку ломают. Полный список долгов сюда не
 * идёт — он уже на картинке, а подпись, которую не прочитать целиком, пользы не
 * приносит.
 */
export function buildShareCaption(payload: SharedDebtsPayload): string {
  const lines = [buildNetLine(payload)];
  if (payload.cardNumber) lines.push(`Карта: ${payload.cardNumber}`);

  return lines.join('\n');
}
