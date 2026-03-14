import type { ReceiptItem, ReceiptCharge } from './types';

/** Base line total: use OCR totalPrice when available, otherwise qty × unitPrice */
export function calcLineTotal(
  item: Pick<ReceiptItem, 'qty' | 'unitPrice' | 'ocrTotalPrice'>,
): number {
  if (item.ocrTotalPrice !== null && item.ocrTotalPrice !== undefined && item.ocrTotalPrice > 0) {
    return item.ocrTotalPrice;
  }
  return item.qty * item.unitPrice;
}

/** Sum of enabled charge percentages */
export function getTotalChargePercent(charges: ReceiptCharge[]): number {
  return charges.filter((c) => c.enabled).reduce((sum, c) => sum + c.percent, 0);
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

/** Individual charge amount for a given subtotal */
export function calcChargeAmount(subtotal: number, charge: ReceiptCharge): number {
  if (!charge.enabled) return 0;
  return Math.round((subtotal * charge.percent) / 100);
}

/** Line total with proportional charges applied (additive: base × (1 + totalPercent/100)) */
export function calcLineTotalWithCharges(
  item: Pick<ReceiptItem, 'qty' | 'unitPrice' | 'ocrTotalPrice'>,
  charges: ReceiptCharge[],
): number {
  const base = calcLineTotal(item);
  const totalPercent = getTotalChargePercent(charges);
  if (!totalPercent) return base;
  return Math.round(base * (1 + totalPercent / 100));
}
