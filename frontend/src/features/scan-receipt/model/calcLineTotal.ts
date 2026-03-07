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
