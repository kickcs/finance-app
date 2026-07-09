import { API_URL } from '@/shared/api/http';

export interface SharedReceiptItem {
  name: string;
  share: number;
  sharedWith: number;
  lineTotal: number;
}

export interface SharedReceiptParticipant {
  name: string;
  color: string;
  isMe: boolean;
  total: number;
  paidByName: string | null;
  items: SharedReceiptItem[];
}

export interface SharedReceipt {
  storeName: string | null;
  date: number;
  currency: string;
  totalAmount: number;
  subtotal: number;
  charges: { label: string; display: string }[];
  participants: SharedReceiptParticipant[];
  paymentMethods: { label: string; value: string }[];
  ownerName: string | null;
}

export class SharedReceiptNotFoundError extends Error {
  constructor() {
    super('Shared receipt not found');
  }
}

export const sharedReceiptApi = {
  /** Публичный эндпоинт — без авторизации */
  async get(token: string): Promise<SharedReceipt> {
    const response = await fetch(`${API_URL}/receipts/shared/${encodeURIComponent(token)}`);
    if (response.status === 404) throw new SharedReceiptNotFoundError();
    if (!response.ok) throw new Error(`Failed to load shared receipt: ${response.status}`);
    return response.json();
  },
};
