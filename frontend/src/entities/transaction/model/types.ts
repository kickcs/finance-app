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
