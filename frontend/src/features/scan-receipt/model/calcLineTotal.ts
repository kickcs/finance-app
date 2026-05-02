import type { ReceiptItem, ReceiptCharge } from './types';

/** Base line total: use OCR totalPrice when available, otherwise qty × unitPrice */
export function calcLineTotal(
  item: Pick<ReceiptItem, 'qty' | 'unitPrice' | 'ocrTotalPrice'>,
): number {
  if (item.ocrTotalPrice !== null && item.ocrTotalPrice > 0) {
    return item.ocrTotalPrice;
  }
  return item.qty * item.unitPrice;
}

/** Sum of enabled percentage charges (for participant share rounding) */
export function getTotalChargePercent(charges: ReceiptCharge[]): number {
  return charges.reduce((sum, c) => (c.enabled && c.type === 'percent' ? sum + c.percent : sum), 0);
}

/** Preview amounts for splitting an item by quantity. Returns [firstAmount, secondAmount]. */
export function calcSplitAmounts(
  item: Pick<ReceiptItem, 'qty' | 'unitPrice' | 'ocrTotalPrice'>,
  firstQty: number,
): [number, number] {
  const secondQty = item.qty - firstQty;
  if (firstQty <= 0 || secondQty <= 0) return [0, 0];
  const ratio1 = firstQty / item.qty;
  if (item.ocrTotalPrice) {
    const first = Math.round(item.ocrTotalPrice * ratio1);
    return [first, item.ocrTotalPrice - first];
  }
  return [Math.round(item.unitPrice * firstQty), Math.round(item.unitPrice * secondQty)];
}

/** Concrete amount of a single charge applied to a given subtotal */
export function calcChargeAmount(subtotal: number, charge: ReceiptCharge): number {
  if (!charge.enabled) return 0;
  if (charge.type === 'amount') return charge.amount;
  return Math.round((subtotal * charge.percent) / 100);
}

/** Sum of all enabled charges (percent and amount), in receipt currency */
export function getTotalChargesAmount(subtotal: number, charges: ReceiptCharge[]): number {
  return charges.reduce((sum, c) => sum + calcChargeAmount(subtotal, c), 0);
}

/**
 * Line total with charges distributed proportionally to this line's share of subtotal.
 * Used for per-participant share calculation when splitting a receipt — NOT for the
 * visual line total in the items list (that always shows the bare item price).
 */
export function calcLineTotalWithCharges(
  item: Pick<ReceiptItem, 'qty' | 'unitPrice' | 'ocrTotalPrice'>,
  charges: ReceiptCharge[],
  subtotal: number,
): number {
  const base = calcLineTotal(item);
  if (subtotal <= 0) return base;
  const totalCharges = getTotalChargesAmount(subtotal, charges);
  if (totalCharges === 0) return base;
  return base + Math.round((totalCharges * base) / subtotal);
}
