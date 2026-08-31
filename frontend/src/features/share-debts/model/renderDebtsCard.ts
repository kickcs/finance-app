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
import type { SharedDebtsPayload } from '@/entities/debt';

const ROW_SUB = 20;
const ROW_GAP = 30;

/** Если хоть один долг в чужой валюте — валюта пишется в каждой строке. */
export function usesMixedCurrency(payload: SharedDebtsPayload): boolean {
  return payload.debts.some((debt) => debt.currency !== payload.currency);
}

/**
 * Строка под суммой. При встречных долгах нетто — разность двух сторон, и по
 * списку её не проверить, поэтому показываем обе стороны. Она же объясняет
 * цвета рельсов ниже, так что отдельная легенда не нужна.
 */
export function buildReconciliation(payload: SharedDebtsPayload): {
  mutual: boolean;
  given: string;
  taken: string;
  caption: string;
} {
  return {
    mutual: payload.totalGiven > 0 && payload.totalTaken > 0,
    given: `вам должны ${bareAmount(payload.totalGiven)}`,
    taken: `вы должны ${bareAmount(payload.totalTaken)}`,
    caption: payload.net >= 0 ? 'должен вам' : 'вы должны',
  };
}

function debtsBody(payload: SharedDebtsPayload): CardBody {
  const { CX, CR, CW, GUTTER } = CARD;
  const mixed = usesMixedCurrency(payload);
  const positive = payload.net >= 0;

  return (ctx, draw) => {
    let y = eyebrow(ctx, draw, shortDate(payload.snapshotAt));

    y += 24;
    if (draw) {
      text(ctx, payload.personName, CX, y, {
        font: `600 15px ${DISPLAY}`,
        color: SHARE_COLORS.ink,
        max: CW,
      });
    }

    y += 44;
    hero(
      ctx,
      draw,
      y,
      `${positive ? '+' : '−'}${bareAmount(Math.abs(payload.net))}`,
      payload.currency,
      positive ? SHARE_COLORS.givenText : SHARE_COLORS.takenText,
    );

    y += 25;
    if (draw) {
      const reconciliation = buildReconciliation(payload);
      if (reconciliation.mutual) {
        const font = `500 13px ${DISPLAY}`;
        const separator = '  ·  ';
        text(ctx, reconciliation.given, CX, y, { font, color: SHARE_COLORS.givenText });
        const afterGiven = CX + measure(ctx, reconciliation.given, font);
        text(ctx, separator, afterGiven, y, { font, color: SHARE_COLORS.inkFaint });
        text(ctx, reconciliation.taken, afterGiven + measure(ctx, separator, font), y, {
          font,
          color: SHARE_COLORS.takenText,
        });
      } else {
        text(ctx, reconciliation.caption, CX, y, {
          font: `500 14px ${DISPLAY}`,
          color: SHARE_COLORS.inkSoft,
        });
      }
    }

    // Отрыв делит корешок и список — он же и есть разделитель секций
    y += 26;
    if (draw) drawTear(ctx, y);
    y += 28;

    if (payload.debts.length === 0) {
      if (draw) {
        text(ctx, 'Открытых долгов нет', CX, y, {
          font: `500 14px ${DISPLAY}`,
          color: SHARE_COLORS.inkFaint,
        });
      }
      return y + 24;
    }

    payload.debts.forEach((debt, index) => {
      if (draw) {
        rail(
          ctx,
          CX,
          y - 13,
          ROW_SUB + 17,
          debt.direction === 'given' ? SHARE_COLORS.givenRail : SHARE_COLORS.takenRail,
        );

        const amount = mixed
          ? `${bareAmount(debt.remainingAmount)} ${debt.currency}`
          : bareAmount(debt.remainingAmount);
        const amountFont = `600 15px ${MONO}`;
        const amountWidth = measure(ctx, amount, amountFont);

        text(ctx, debt.title, CX + GUTTER, y, {
          font: `500 15px ${DISPLAY}`,
          color: SHARE_COLORS.ink,
          max: CW - GUTTER - amountWidth - 16,
        });
        text(ctx, amount, CR, y, {
          font: amountFont,
          color: SHARE_COLORS.ink,
          align: 'right',
        });

        // Прощённое называем отдельно: иначе «отдано 20 000 из 50 000» рядом с
        // остатком 20 000 не сходится у тех, кто по карточке сверяется.
        const parts: string[] = [];
        if (debt.paidAmount > 0) {
          parts.push(`отдано ${bareAmount(debt.paidAmount)} из ${bareAmount(debt.totalAmount)}`);
        }
        if (debt.forgivenAmount > 0) parts.push(`прощено ${bareAmount(debt.forgivenAmount)}`);
        if (debt.dueDate) parts.push(`до ${shortDate(debt.dueDate)}`);

        text(ctx, parts.join('  ·  ') || 'без срока', CX + GUTTER, y + ROW_SUB, {
          font: `500 12px ${DISPLAY}`,
          color: SHARE_COLORS.inkFaint,
          max: CW - GUTTER,
        });
      }

      y += ROW_SUB + (index < payload.debts.length - 1 ? ROW_GAP : 0);
    });

    return y + 26;
  };
}

/**
 * Карточка сверки по долгам одного человека — то, что отправляют картинкой
 * вместо скриншота. Форму рваного края сеет дата снимка, поэтому один и тот же
 * снимок всегда даёт одну и ту же картинку.
 */
export function renderDebtsCardToCanvas(payload: SharedDebtsPayload): HTMLCanvasElement {
  return renderCard(debtsBody(payload), payload.snapshotAt);
}
