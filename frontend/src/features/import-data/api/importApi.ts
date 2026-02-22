import { http } from '@/shared/api/http';
import type { ParsedTransaction } from '@/shared/lib/csv/parseMoneyLoverCsv';

export interface ImportResult {
  imported_count: number;
  categories_created: string[];
  accounts_created: string[];
}

interface BackendImportResult {
  importedCount: number;
  categoriesCreated: string[];
  accountsCreated: string[];
}

export const importApi = {
  async importTransactions(transactions: ParsedTransaction[]): Promise<ImportResult> {
    const payload = {
      transactions: transactions.map((t) => ({
        note: t.note,
        amount: t.amount,
        categoryName: t.category_name,
        accountName: t.account_name,
        currency: t.currency,
        date: t.date,
      })),
    };

    const result = await http.post<BackendImportResult>('/import/transactions', payload);

    return {
      imported_count: result.importedCount,
      categories_created: result.categoriesCreated,
      accounts_created: result.accountsCreated,
    };
  },
};
