import { API_URL, getAccessToken, refreshTokensWithReason } from '@/shared/api/http';

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

export const receiptApi = {
  async scan(imageFile: File): Promise<ScanReceiptResponse> {
    const formData = new FormData();
    formData.append('image', imageFile);

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
