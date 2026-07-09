import { API_URL, getAccessToken, refreshTokensWithReason, http } from '@/shared/api/http';

export interface ReceiptItemResponse {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ScanReceiptResponse {
  items: ReceiptItemResponse[];
  totalAmount: number;
  serviceChargePercent: number | null;
  serviceChargeAmount: number | null;
  currency: string;
  date: string | null;
  storeName: string | null;
  hashtags: string[];
}

export interface SharedReceiptPayload {
  storeName: string | null;
  date: number;
  currency: string;
  totalAmount: number;
  subtotal: number;
  charges: { label: string; display: string }[];
  participants: {
    name: string;
    color: string;
    isMe: boolean;
    total: number;
    paidByName: string | null;
    items: { name: string; share: number; sharedWith: number; lineTotal: number }[];
  }[];
  paymentMethods: { label: string; value: string }[];
  ownerName: string | null;
}

export const receiptApi = {
  /** Публичная ссылка на чек: бэкенд сохраняет снапшот и возвращает URL вида /r/<token> */
  async share(payload: SharedReceiptPayload): Promise<{ token: string; url: string }> {
    return http.post<{ token: string; url: string }>('/receipts/share', payload);
  },

  /** До 3 кадров одного чека — бэкенд склеивает сегменты в один список позиций */
  async scan(imageFiles: File[]): Promise<ScanReceiptResponse> {
    const formData = new FormData();
    for (const file of imageFiles) {
      formData.append('image', file);
    }

    const doFetch = (token: string | null) =>
      fetch(`${API_URL}/receipts/scan`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: formData,
      });

    let response = await doFetch(getAccessToken());

    if (response.status === 401) {
      const result = await refreshTokensWithReason();
      if (result === 'success') {
        response = await doFetch(getAccessToken());
      }
      // network_error — proceed with original 401 response (will throw below)
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Scan failed: ${response.status}`);
    }

    return response.json();
  },
};
