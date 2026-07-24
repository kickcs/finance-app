export type ImportedTransactionType =
  | 'expense'
  | 'income'
  | 'balance_change'
  | 'reversal'
  | 'unparsed';
export type ImportedTransactionStatus = 'pending' | 'confirmed' | 'dismissed';

export interface TelegramLink {
  id: string;
  userId: string;
  telegramUserId: string;
  telegramUsername: string | null;
  createdAt: Date;
}

export interface ImportedTransaction {
  id: string;
  userId: string;
  rawText: string;
  type: ImportedTransactionType;
  amount: number | null;
  currency: string;
  merchant: string | null;
  cardMask: string | null;
  occurredAt: Date | null;
  balanceAfter: number | null;
  dedupHash: string;
  status: ImportedTransactionStatus;
  transactionId: string | null;
  createdAt: Date;
}

export interface CardAccountMapping {
  userId: string;
  cardMask: string;
  accountId: string;
}

export interface CardWithMapping {
  cardMask: string;
  accountId: string | null;
  lastSeenAt: Date | null;
}
