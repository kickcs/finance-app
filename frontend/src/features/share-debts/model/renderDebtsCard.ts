import { formatCurrency } from '@/shared/lib/format/currency';
import { formatLocalDate } from '@/shared/lib/format/date';
import {
  SHARE_COLORS,
  SHARE_FONT_FAMILY,
  SHARE_SCALE,
  APP_NAME,
  createGoldGradient,
  drawBrandLogo,
  drawBrandWatermark,
} from '@/shared/lib/share/shareCard';
import type { SharedDebtsPayload } from '@/entities/debt';

const CARD_WIDTH = 480;
const PADDING_X = 28;
const PADDING_Y = 24;
const HEADER_HEIGHT = 190;
const SECTION_HEADER_HEIGHT = 40;
const ROW_HEIGHT = 34;
const ROW_SUB_HEIGHT = 20;
const ROW_GAP = 10;
const DIVIDER_GAP = 24;
const WATERMARK_SECTION_HEIGHT = 80;
const EMPTY_STATE_HEIGHT = 40;
const CONTENT_WIDTH = CARD_WIDTH - PADDING_X * 2;
const TITLE_MAX_WIDTH = CONTENT_WIDTH - 175;
const AMOUNT_X = CARD_WIDTH - PADDING_X;

// Доменные цвета долгов — те же токены, что и в приложении
const DEBT_GIVEN = '#F59E0B';
const DEBT_TAKEN = '#A855F7';

function directionColor(direction: 'given' | 'taken'): string {
  return direction === 'given' ? DEBT_GIVEN : DEBT_TAKEN;
}

/** Строка долга рисуется в две линии, поэтому её высота — сумма обеих. */
function rowHeight(): number {
  return ROW_HEIGHT + ROW_SUB_HEIGHT;
}

function calcDebtsHeight(payload: SharedDebtsPayload): number {
  const count = payload.debts.length;
  if (count === 0) return SECTION_HEADER_HEIGHT + EMPTY_STATE_HEIGHT;
  return SECTION_HEADER_HEIGHT + count * rowHeight() + (count - 1) * ROW_GAP;
}

function drawHeader(ctx: CanvasRenderingContext2D, payload: SharedDebtsPayload, y: number): number {
  const isPositive = payload.net >= 0;
  const netColor = directionColor(isPositive ? 'given' : 'taken');

  // Бренд с логотипом
  const logoSize = 24;
  ctx.font = `700 13px ${SHARE_FONT_FAMILY}`;
  const brandWidth = ctx.measureText(APP_NAME).width;
  const brandStartX = (CARD_WIDTH - (logoSize + 8 + brandWidth)) / 2;

  drawBrandLogo(ctx, brandStartX + logoSize / 2, y + 10, logoSize);

  ctx.fillStyle = SHARE_COLORS.brand;
  ctx.textAlign = 'left';
  ctx.fillText(APP_NAME, brandStartX + logoSize + 8, y + 15);
  y += 40;

  // Имя человека
  ctx.font = `600 16px ${SHARE_FONT_FAMILY}`;
  ctx.fillStyle = SHARE_COLORS.textTertiary;
  ctx.textAlign = 'center';
  ctx.fillText(payload.personName.toUpperCase(), CARD_WIDTH / 2, y + 16, CONTENT_WIDTH);
  y += 34;

  // Нетто-итог
  ctx.font = `900 44px ${SHARE_FONT_FAMILY}`;
  ctx.fillStyle = netColor;
  ctx.textAlign = 'center';
  const netText = `${isPositive ? '+' : '−'}${formatCurrency(Math.abs(payload.net), payload.currency)}`;
  ctx.fillText(netText, CARD_WIDTH / 2, y + 44, CONTENT_WIDTH);
  y += 62;

  // Направление словами — знак и цвет читаются не всеми
  ctx.font = `500 15px ${SHARE_FONT_FAMILY}`;
  ctx.fillStyle = SHARE_COLORS.textSecondary;
  ctx.fillText(isPositive ? 'должен вам' : 'вы должны', CARD_WIDTH / 2, y + 15);
  y += 28;

  // Дата снимка: по картинке всегда видно, на какой момент сверка
  ctx.font = `500 13px ${SHARE_FONT_FAMILY}`;
  ctx.fillStyle = SHARE_COLORS.textTertiary;
  ctx.fillText(`на ${formatLocalDate(payload.snapshotAt)}`, CARD_WIDTH / 2, y + 13);
  y += 26;

  return y;
}

function drawDebts(ctx: CanvasRenderingContext2D, payload: SharedDebtsPayload, y: number): number {
  ctx.font = `600 13px ${SHARE_FONT_FAMILY}`;
  ctx.fillStyle = SHARE_COLORS.textTertiary;
  ctx.textAlign = 'left';
  ctx.fillText('ДОЛГИ', PADDING_X, y + 15);
  y += SECTION_HEADER_HEIGHT;

  if (payload.debts.length === 0) {
    ctx.font = `400 15px ${SHARE_FONT_FAMILY}`;
    ctx.fillStyle = SHARE_COLORS.textTertiary;
    ctx.textAlign = 'center';
    ctx.fillText('Открытых долгов нет', CARD_WIDTH / 2, y + 15);
    return y + EMPTY_STATE_HEIGHT;
  }

  payload.debts.forEach((debt, index) => {
    const centerY = y + ROW_HEIGHT / 2;

    // Маркер направления. Инициала здесь нет намеренно: первая буква названия
    // долга — это «Д» от «Долг», она ничего не сообщает. Направление несёт цвет.
    ctx.beginPath();
    ctx.fillStyle = directionColor(debt.direction);
    ctx.arc(PADDING_X + 5, centerY + 1, 5, 0, Math.PI * 2);
    ctx.fill();

    // Название
    ctx.font = `500 15px ${SHARE_FONT_FAMILY}`;
    ctx.fillStyle = SHARE_COLORS.textPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(debt.title, PADDING_X + 20, centerY + 5, TITLE_MAX_WIDTH);
    // Ширину названия меряем тем же шрифтом, каким оно нарисовано: с жирным
    // шрифтом суммы замер выходит шире, и пунктир стартовал бы поверх текста
    const titleWidth = Math.min(ctx.measureText(debt.title).width, TITLE_MAX_WIDTH);

    // Остаток
    const amountText = formatCurrency(debt.remainingAmount, debt.currency);
    ctx.font = `700 15px ${SHARE_FONT_FAMILY}`;
    ctx.fillStyle = SHARE_COLORS.textPrimary;
    ctx.textAlign = 'right';
    ctx.fillText(amountText, AMOUNT_X, centerY + 5);

    // Пунктир между названием и суммой
    const amountWidth = ctx.measureText(amountText).width;
    const lineStartX = PADDING_X + 20 + titleWidth + 10;
    const lineEndX = AMOUNT_X - amountWidth - 10;
    if (lineEndX > lineStartX) {
      ctx.beginPath();
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = SHARE_COLORS.divider;
      ctx.lineWidth = 2;
      ctx.moveTo(lineStartX, centerY + 1);
      ctx.lineTo(lineEndX, centerY + 1);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    y += ROW_HEIGHT;

    // Вторая строка: что уже погашено и до какого срока.
    // Прощённое называем отдельно — иначе на карточке, по которой двое
    // сверяются, «отдано 20 000 из 50 000» рядом с остатком 20 000 не сходится.
    const parts: string[] = [];
    if (debt.paidAmount > 0) {
      parts.push(
        `отдано ${formatCurrency(debt.paidAmount, debt.currency)} из ${formatCurrency(debt.totalAmount, debt.currency)}`,
      );
    }
    if (debt.forgivenAmount > 0) {
      parts.push(`прощено ${formatCurrency(debt.forgivenAmount, debt.currency)}`);
    }
    if (debt.dueDate) parts.push(`до ${formatLocalDate(debt.dueDate)}`);

    ctx.font = `400 12px ${SHARE_FONT_FAMILY}`;
    ctx.fillStyle = SHARE_COLORS.textTertiary;
    ctx.textAlign = 'left';
    ctx.fillText(
      parts.length > 0 ? parts.join(' · ') : 'без срока',
      PADDING_X + 20,
      y + 12,
      CONTENT_WIDTH - 20,
    );

    y += ROW_SUB_HEIGHT;
    if (index < payload.debts.length - 1) y += ROW_GAP;
  });

  return y;
}

/**
 * Карточка сверки по долгам одного человека — то, что пользователь отправляет
 * картинкой вместо скриншота экрана. Ширина фиксированная, высота считается
 * заранее по числу долгов: canvas нельзя перерисовать после установки размера.
 */
export function renderDebtsCardToCanvas(payload: SharedDebtsPayload): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const totalHeight =
    PADDING_Y +
    HEADER_HEIGHT +
    DIVIDER_GAP +
    calcDebtsHeight(payload) +
    PADDING_Y +
    WATERMARK_SECTION_HEIGHT;

  canvas.width = CARD_WIDTH * SHARE_SCALE;
  canvas.height = totalHeight * SHARE_SCALE;
  canvas.style.width = `${CARD_WIDTH}px`;
  canvas.style.height = `${totalHeight}px`;
  ctx.scale(SHARE_SCALE, SHARE_SCALE);

  ctx.fillStyle = SHARE_COLORS.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, totalHeight);

  ctx.fillStyle = createGoldGradient(ctx, 0, 0, CARD_WIDTH, 0);
  ctx.fillRect(0, 0, CARD_WIDTH, 8);

  let y = PADDING_Y;
  y = drawHeader(ctx, payload, y);

  // Вырезы по бокам — та же «бумажная» эстетика, что и у карточки чека
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(0, y + 4, 16, 0, Math.PI * 2);
  ctx.arc(CARD_WIDTH, y + 4, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  y += 4;
  ctx.beginPath();
  ctx.strokeStyle = SHARE_COLORS.divider;
  ctx.lineWidth = 1;
  ctx.moveTo(PADDING_X, y);
  ctx.lineTo(CARD_WIDTH - PADDING_X, y);
  ctx.stroke();
  y += DIVIDER_GAP - 4;

  drawDebts(ctx, payload, y);

  drawBrandWatermark(ctx, CARD_WIDTH, totalHeight - WATERMARK_SECTION_HEIGHT + 12);

  return canvas;
}
