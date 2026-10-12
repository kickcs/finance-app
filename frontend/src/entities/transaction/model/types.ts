import type { Transaction } from '@/shared/api/database.types';

// Re-export from database types for consistency
export type { Transaction };

export interface TransactionGroup {
  date: string;
  transactions: Transaction[];
  total: number;
}

export interface Hashtag {
  tag: string;
  count: number;
}

/** Часть оплаты с двух счетов на экране: имя и цвет счёта (без цвета — нейтральная), сумма. */
export interface PaymentPartView {
  label: string;
  amount: number;
  color?: string | null;
}
