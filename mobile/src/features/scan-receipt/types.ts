export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ScanReceiptResponse {
  items: ReceiptItem[];
  totalAmount: number;
  serviceChargePercent: number | null;
  serviceChargeAmount: number | null;
  currency: string;
  date: string | null;
  storeName: string | null;
  hashtags: string[];
}
