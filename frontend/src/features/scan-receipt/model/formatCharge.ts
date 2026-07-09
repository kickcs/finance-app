import { formatCurrency } from '@/shared/lib/format/currency';
import type { ReceiptCharge } from './types';

/** «10%» или «5 000 UZS» — короткое отображение значения сбора */
export function formatChargeDisplay(charge: ReceiptCharge, currency: string): string {
  return charge.type === 'percent' ? `${charge.percent}%` : formatCurrency(charge.amount, currency);
}
