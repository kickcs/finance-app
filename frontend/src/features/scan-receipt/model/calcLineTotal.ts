import type { ReceiptItem } from './types';

/** Base line total: use OCR totalPrice when available, otherwise qty × unitPrice */
export function calcLineTotal(item: Pick<ReceiptItem, 'qty' | 'unitPrice' | 'ocrTotalPrice'>): number {
  if (item.ocrTotalPrice != null && item.ocrTotalPrice > 0) {
    return item.ocrTotalPrice;
  }
  return item.qty * item.unitPrice;
}

/** Line total with proportional service charge applied */
export function calcLineTotalWithService(
  item: Pick<ReceiptItem, 'qty' | 'unitPrice' | 'ocrTotalPrice'>,
  serviceChargePercent: number | null | undefined,
): number {
  const base = calcLineTotal(item);
  if (!serviceChargePercent) return base;
  return Math.round(base * (1 + serviceChargePercent / 100));
}
