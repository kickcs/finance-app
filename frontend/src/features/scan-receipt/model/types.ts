export interface ReceiptItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  /** Original line total from receipt OCR. Used as source of truth to avoid rounding errors. Cleared on manual edit. */
  ocrTotalPrice: number | null;
  assignedParticipantIds: string[];
}

export interface Participant {
  id: string;
  name: string;
  isMe: boolean;
  color: string;
  paidById: string | null;
}

export interface ParticipantSummaryItem {
  id: string;
  name: string;
  lineTotal: number;
  share: number;
  sharedWith: number;
}

export interface ParticipantSummary {
  id: string;
  name: string;
  isMe: boolean;
  color: string;
  itemCount: number;
  total: number;
  items: ParticipantSummaryItem[];
  paidById?: string;
  paidByName?: string;
}

export interface ScanReceiptFormData {
  accountId: string | null;
  categoryId: string;
  description: string;
  date: number;
  createDebts: boolean;
  currency: string;
}

interface ReceiptChargeBase {
  id: string;
  label: string;
  enabled: boolean;
}

export interface PercentReceiptCharge extends ReceiptChargeBase {
  type: 'percent';
  percent: number;
}

export interface AmountReceiptCharge extends ReceiptChargeBase {
  type: 'amount';
  amount: number;
}

export type ReceiptCharge = PercentReceiptCharge | AmountReceiptCharge;

export type WizardDirection = 'forward' | 'back';
