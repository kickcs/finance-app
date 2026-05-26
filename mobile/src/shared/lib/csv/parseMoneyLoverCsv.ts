import Papa from 'papaparse';

import { DEFAULT_CURRENCY } from '@/shared/config/currency';

export interface ParsedTransaction {
  note: string | null;
  amount: number;
  category_name: string;
  account_name: string;
  currency: string;
  date: string;
}

export interface ParseStats {
  total_rows: number;
  date_range: { from: string; to: string } | null;
  unique_categories: string[];
  unique_accounts: string[];
}

export interface ParseResult {
  data: ParsedTransaction[];
  stats: ParseStats;
  errors: string[];
}

interface MoneyLoverRow {
  ID: string;
  Note: string;
  Amount: string;
  Category: string;
  Account: string;
  Currency: string;
  Date: string;
  Event: string;
  'Exclude Report': string;
}

function parseDDMMYYYY(dateStr: string): string | null {
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts as [string, string, string];
  const d = new Date(
    `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00.000Z`,
  );
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * RN-friendly variant of the Vue parser — accepts a raw CSV string instead of
 * a File handle (which doesn't exist on native).
 */
export function parseMoneyLoverCsv(csv: string): ParseResult {
  const results = Papa.parse<MoneyLoverRow>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const errors: string[] = [];
  const data: ParsedTransaction[] = [];
  const categories = new Set<string>();
  const accounts = new Set<string>();
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (let i = 0; i < results.data.length; i++) {
    const row = results.data[i];
    if (!row) continue;
    const amount = parseFloat(row.Amount);
    if (Number.isNaN(amount) || amount === 0) {
      errors.push(`Row ${i + 1}: invalid amount "${row.Amount}"`);
      continue;
    }

    const isoDate = parseDDMMYYYY(row.Date);
    if (!isoDate) {
      errors.push(`Row ${i + 1}: invalid date "${row.Date}"`);
      continue;
    }

    const category = row.Category?.trim();
    const account = row.Account?.trim();
    if (!category || !account) {
      errors.push(`Row ${i + 1}: missing category or account`);
      continue;
    }

    categories.add(category);
    accounts.add(account);

    const d = new Date(isoDate);
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;

    data.push({
      note: row.Note?.trim() || null,
      amount,
      category_name: category,
      account_name: account,
      currency: row.Currency?.trim() || DEFAULT_CURRENCY,
      date: isoDate,
    });
  }

  return {
    data,
    stats: {
      total_rows: data.length,
      date_range:
        minDate && maxDate
          ? { from: minDate.toISOString(), to: maxDate.toISOString() }
          : null,
      unique_categories: [...categories].sort(),
      unique_accounts: [...accounts].sort(),
    },
    errors,
  };
}
