import { type ImportedTransaction } from '../models';

export const IMPORTED_TRANSACTION_REPOSITORY = Symbol('IMPORTED_TRANSACTION_REPOSITORY');

export interface InboxItem extends ImportedTransaction {
  suggestedAccountId: string | null;
}

export interface ImportedTransactionCreate {
  userId: string;
  rawText: string;
  type: ImportedTransaction['type'];
  amount: number | null;
  currency: string;
  merchant: string | null;
  cardMask: string | null;
  occurredAt: Date | null;
  balanceAfter: number | null;
  dedupHash: string;
}

export interface IImportedTransactionRepository {
  /** Возвращает null при конфликте dedup (user_id, dedup_hash) */
  insertIfNew(data: ImportedTransactionCreate): Promise<ImportedTransaction | null>;
  findById(id: string): Promise<ImportedTransaction | null>;
  findPendingWithSuggestions(userId: string): Promise<InboxItem[]>;
  countPending(userId: string): Promise<number>;
  markConfirmed(id: string, transactionId: string): Promise<void>;
  markDismissed(id: string): Promise<void>;
  /** Последний известный баланс карты до occurredAt (для дельты balance_change) */
  findLatestBalance(userId: string, cardMask: string, before: Date): Promise<number | null>;
  /** Встречное pending-сообщение для перевода: противоположный тип, та же сумма, ±15 мин, карта замаплена на counterAccountId */
  findTransferCounterpart(params: {
    userId: string;
    oppositeType: 'expense' | 'income';
    amount: number;
    occurredAt: Date;
    counterAccountId: string;
    excludeId: string;
  }): Promise<ImportedTransaction | null>;
}
