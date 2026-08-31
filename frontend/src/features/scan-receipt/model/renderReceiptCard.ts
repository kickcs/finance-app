import {
  CARD,
  DISPLAY,
  MONO,
  SHARE_COLORS,
  bareAmount,
  drawTear,
  eyebrow,
  hero,
  measure,
  rail,
  renderCard,
  shortDate,
  text,
  type CardBody,
} from '@/shared/lib/share/shareCard';
import type { ParticipantSummary, ReceiptCharge } from './types';

export interface ReceiptShareData {
  storeName: string | null;
  date: number;
  currency: string;
  totalAmount: number;
  subtotal: number;
  charges: ReceiptCharge[];
  chargesAmount: number;
  participants: ParticipantSummary[];
}

const NAME_ROW = 24;
const ITEM_ROW = 19;
const PARTICIPANT_GAP = 18;
const LABEL_GAP = 26;

/** Доля общей позиции подписывается прямо в названии: «Ачик-чучук · 1/2». */
function itemLabel(item: { name: string; sharedWith: number }): string {
  return item.sharedWith > 1 ? `${item.name} · 1/${item.sharedWith}` : item.name;
}

/** Примечание о сборах: суммы участников уже включают их, и это надо сказать. */
export function buildChargesNote(charges: ReceiptCharge[], chargesAmount: number): string | null {
  const enabled = charges.filter((charge) => charge.enabled);
  if (enabled.length === 0 || chargesAmount <= 0) return null;

  const labels = enabled
    .map((charge) =>
      charge.type === 'amount'
        ? `${bareAmount(charge.amount)} ${charge.label.toLowerCase()}`
        : `${charge.percent}% ${charge.label.toLowerCase()}`,
    )
    .join(', ');

  return `Суммы включают ${labels}`;
}

function receiptBody(data: ReceiptShareData): CardBody {
  const { CX, CR, CW, GUTTER } = CARD;
  const owers = data.participants.filter((p) => !p.isMe && p.total > 0);
  const back = owers.reduce((sum, p) => sum + p.total, 0);
  const note = buildChargesNote(data.charges, data.chargesAmount);

  return (ctx, draw) => {
    let y = eyebrow(ctx, draw, shortDate(data.date));

    y += 24;
    if (draw) {
      text(ctx, data.storeName || 'Чек', CX, y, {
        font: `600 15px ${DISPLAY}`,
        color: SHARE_COLORS.ink,
        max: CW,
      });
    }

    y += 44;
    hero(ctx, draw, y, bareAmount(data.totalAmount), data.currency, SHARE_COLORS.ink);

    y += 25;
    if (draw) {
      text(
        ctx,
        back > 0 ? `вам вернут ${bareAmount(back)} ${data.currency}` : 'делить не с кем',
        CX,
        y,
        { font: `500 14px ${DISPLAY}`, color: SHARE_COLORS.inkSoft },
      );
    }

    // Отрыв делит корешок и список — он же и есть разделитель секций
    y += 26;
    if (draw) drawTear(ctx, y);
    y += 30;

    if (owers.length === 0) {
      if (draw) {
        text(ctx, 'Никто ничего не должен', CX, y, {
          font: `500 14px ${DISPLAY}`,
          color: SHARE_COLORS.inkFaint,
        });
      }
      return y + 24;
    }

    // Заголовок нужен: без него список читается как «кто сколько съел», а это
    // суммы к возврату, и своей строки у плательщика в нём нет
    if (draw) {
      text(ctx, 'КТО СКОЛЬКО ДОЛЖЕН', CX, y, {
        font: `600 11px ${DISPLAY}`,
        color: SHARE_COLORS.inkFaint,
        track: 1.4,
      });
    }
    y += LABEL_GAP;

    owers.forEach((participant, index) => {
      const items = participant.items;

      if (draw) {
        rail(ctx, CX, y - 14, NAME_ROW + (items.length - 1) * ITEM_ROW + 18, participant.color);

        const amount = bareAmount(participant.total);
        const amountFont = `600 16px ${MONO}`;
        const amountWidth = measure(ctx, amount, amountFont);

        text(ctx, participant.name, CX + GUTTER, y, {
          font: `600 16px ${DISPLAY}`,
          color: SHARE_COLORS.ink,
          max: CW - GUTTER - amountWidth - 16,
        });
        text(ctx, amount, CR, y, {
          font: amountFont,
          color: SHARE_COLORS.ink,
          align: 'right',
        });

        items.forEach((item, itemIndex) => {
          const itemY = y + NAME_ROW + itemIndex * ITEM_ROW;
          const itemFont = `500 12px ${MONO}`;
          const shareText = bareAmount(item.share);
          const shareWidth = measure(ctx, shareText, itemFont);

          text(ctx, itemLabel(item), CX + GUTTER, itemY, {
            font: `500 13px ${DISPLAY}`,
            color: SHARE_COLORS.inkSoft,
            max: CW - GUTTER - shareWidth - 16,
          });
          text(ctx, shareText, CR, itemY, {
            font: itemFont,
            color: SHARE_COLORS.inkFaint,
            align: 'right',
          });
        });
      }

      y +=
        NAME_ROW +
        participant.items.length * ITEM_ROW +
        (index < owers.length - 1 ? PARTICIPANT_GAP : 0);
    });

    if (note) {
      y += 22;
      if (draw) {
        // Волосяная линия — иначе примечание читается как ещё одна позиция
        ctx.beginPath();
        ctx.strokeStyle = SHARE_COLORS.hairline;
        ctx.lineWidth = 1;
        ctx.moveTo(CX, y - 13.5);
        ctx.lineTo(CR, y - 13.5);
        ctx.stroke();

        text(ctx, note, CX, y, {
          font: `500 12px ${DISPLAY}`,
          color: SHARE_COLORS.inkFaint,
          max: CW,
        });
      }
      y += 4;
    }

    return y + 26;
  };
}

/**
 * Карточка разделённого чека — то, что отправляют картинкой вместо скриншота.
 * Форму рваного края сеет дата чека, поэтому один и тот же чек всегда даёт
 * одну и ту же картинку.
 */
export function renderReceiptCardToCanvas(data: ReceiptShareData): HTMLCanvasElement {
  return renderCard(receiptBody(data), data.date);
}
