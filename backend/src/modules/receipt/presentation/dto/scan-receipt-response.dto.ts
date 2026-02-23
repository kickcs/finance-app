export class ReceiptItemDto {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export class ScanReceiptResponseDto {
  items: ReceiptItemDto[];
  totalAmount: number;
  currency: string;
  date: string | null;
  storeName: string | null;
}
