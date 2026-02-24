import type { ReceiptItem } from './types';

/** Base line total: qty × unitPrice */
export function calcLineTotal(item: Pick<ReceiptItem, 'qty' | 'unitPrice'>): number {
  return item.qty * item.unitPrice;
}

/** Line total with proportional service charge applied */
export function calcLineTotalWithService(
  item: Pick<ReceiptItem, 'qty' | 'unitPrice'>,
  serviceChargePercent: number | null | undefined,
): number {
  const base = calcLineTotal(item);
  if (!serviceChargePercent) return base;
  return Math.round(base * (1 + serviceChargePercent / 100));
}
