export class ReceiptItemDto {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export class ScanReceiptResponseDto {
  items: ReceiptItemDto[];
  totalAmount: number;
  serviceChargePercent: number | null;
  currency: string;
  date: string | null;
  storeName: string | null;
}
