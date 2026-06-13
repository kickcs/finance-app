export type ImportedTransactionType = 'expense' | 'income' | 'balance_change';
export type ImportedTransactionStatus = 'pending' | 'confirmed' | 'dismissed';

export interface ImportedTransaction {
  id: string;
  type: ImportedTransactionType;
  amount: number | null; // для balance_change — подписанная дельта или null
  currency: string;
  merchant: string | null;
  card_mask: string;
  occurred_at: string | null; // ISO, null when backend has no parsed date
  balance_after: number | null;
  status: ImportedTransactionStatus;
  transaction_id: string | null;
  suggested_account_id: string | null;
  created_at: string;
}

export interface TelegramLinkStatus {
  linked: boolean;
  telegram_username: string | null;
}

export interface TelegramCard {
  card_mask: string;
  account_id: string | null;
  last_seen_at: string | null;
}
