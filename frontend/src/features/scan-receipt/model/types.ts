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
}

export interface ScanReceiptFormData {
  accountId: string | null;
  categoryId: string;
  description: string;
  date: number;
  createDebts: boolean;
  currency: string;
}

export interface ReceiptCharge {
  id: string;
  label: string;
  percent: number;
  enabled: boolean;
}

export type WizardDirection = 'forward' | 'back';
