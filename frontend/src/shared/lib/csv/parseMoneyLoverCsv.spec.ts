import { describe, it, expect } from 'vitest';
import { parseMoneyLoverCsv } from './parseMoneyLoverCsv';

// ---------------------------------------------------------------------------
// parseMoneyLoverCsv — pure unit tests
// ---------------------------------------------------------------------------

/** Build a minimal Money Lover CSV file content */
function makeCsv(rows: string[]): File {
  const header = 'ID,Note,Amount,Category,Account,Currency,Date,Event,Exclude Report';
  const content = [header, ...rows].join('\n');
  return new File([content], 'export.csv', { type: 'text/csv' });
}

/** Standard valid CSV row */
function validRow(overrides: Partial<Record<string, string>> = {}) {
  const defaults = {
    ID: '1',
    Note: 'Обед',
    Amount: '25000',
    Category: 'Продукты',
    Account: 'Основной',
    Currency: 'UZS',
    Date: '01/06/2025',
    Event: '',
    'Exclude Report': '0',
  };
  const row = { ...defaults, ...overrides };
  return Object.values(row).join(',');
}

describe('parseMoneyLoverCsv', () => {
  // ── Happy path ────────────────────────────────────────────────────────────

  describe('valid CSV', () => {
    it('parses a single row correctly', async () => {
      const file = makeCsv([validRow()]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.errors).toHaveLength(0);
      expect(result.data).toHaveLength(1);

      const tx = result.data[0];
      expect(tx.note).toBe('Обед');
      expect(tx.amount).toBe(25000);
      expect(tx.category_name).toBe('Продукты');
      expect(tx.account_name).toBe('Основной');
      expect(tx.currency).toBe('UZS');
    });

    it('parses date in DD/MM/YYYY format to ISO string', async () => {
      const file = makeCsv([validRow({ Date: '15/03/2025' })]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.data[0].date).toMatch(/^2025-03-15T/);
    });

    it('parses multiple rows', async () => {
      const file = makeCsv([
        validRow({ ID: '1', Amount: '10000' }),
        validRow({ ID: '2', Amount: '5000', Category: 'Транспорт' }),
        validRow({ ID: '3', Amount: '20000', Category: 'Кафе' }),
      ]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.errors).toHaveLength(0);
      expect(result.data).toHaveLength(3);
      expect(result.data[0].amount).toBe(10000);
      expect(result.data[1].amount).toBe(5000);
      expect(result.data[2].amount).toBe(20000);
    });

    it('treats empty Note as null', async () => {
      const file = makeCsv([validRow({ Note: '' })]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.data[0].note).toBeNull();
    });

    it('uses DEFAULT_CURRENCY when currency is missing', async () => {
      const file = makeCsv([validRow({ Currency: '' })]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.data[0].currency).toBe('UZS'); // DEFAULT_CURRENCY
    });

    it('preserves decimal amounts', async () => {
      const file = makeCsv([validRow({ Amount: '12345.67' })]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.data[0].amount).toBeCloseTo(12345.67);
    });
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  describe('parse stats', () => {
    it('counts total_rows correctly', async () => {
      const file = makeCsv([validRow({ ID: '1' }), validRow({ ID: '2' })]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.stats.total_rows).toBe(2);
    });

    it('collects unique_categories', async () => {
      const file = makeCsv([
        validRow({ Category: 'Продукты' }),
        validRow({ Category: 'Транспорт' }),
        validRow({ Category: 'Продукты' }), // duplicate
      ]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.stats.unique_categories).toHaveLength(2);
      expect(result.stats.unique_categories).toContain('Продукты');
      expect(result.stats.unique_categories).toContain('Транспорт');
    });

    it('collects unique_accounts', async () => {
      const file = makeCsv([
        validRow({ Account: 'Основной' }),
        validRow({ Account: 'Накопления' }),
      ]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.stats.unique_accounts).toHaveLength(2);
    });

    it('computes date_range from min/max dates', async () => {
      const file = makeCsv([
        validRow({ Date: '01/01/2025' }),
        validRow({ Date: '15/06/2025' }),
        validRow({ Date: '01/03/2025' }),
      ]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.stats.date_range).not.toBeNull();
      expect(result.stats.date_range!.from).toMatch(/^2025-01-01T/);
      expect(result.stats.date_range!.to).toMatch(/^2025-06-15T/);
    });

    it('returns null date_range for empty data', async () => {
      const file = makeCsv([]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.stats.date_range).toBeNull();
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('reports error for row with invalid amount', async () => {
      const file = makeCsv([validRow({ Amount: 'abc' })]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.data).toHaveLength(0);
    });

    it('reports error for row with zero amount', async () => {
      const file = makeCsv([validRow({ Amount: '0' })]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('reports error for row with invalid date format', async () => {
      const file = makeCsv([validRow({ Date: '2025-06-01' })]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('reports error for row with missing category', async () => {
      const file = makeCsv([validRow({ Category: '' })]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('reports error for row with missing account', async () => {
      const file = makeCsv([validRow({ Account: '' })]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('skips invalid rows but keeps valid ones', async () => {
      const file = makeCsv([
        validRow({ ID: '1', Amount: '10000' }),
        validRow({ ID: '2', Amount: 'invalid' }),
        validRow({ ID: '3', Amount: '5000' }),
      ]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.errors).toHaveLength(1);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].amount).toBe(10000);
      expect(result.data[1].amount).toBe(5000);
    });

    it('handles completely empty CSV (headers only)', async () => {
      const file = makeCsv([]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.data).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.total_rows).toBe(0);
    });

    it('includes row number in error message', async () => {
      const file = makeCsv([validRow({ Amount: 'invalid' })]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.errors[0]).toContain('Row 1');
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('trims whitespace from category and account names', async () => {
      const file = makeCsv([validRow({ Category: '  Продукты  ', Account: '  Основной  ' })]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.data[0].category_name).toBe('Продукты');
      expect(result.data[0].account_name).toBe('Основной');
    });

    it('trims whitespace from note', async () => {
      const file = makeCsv([validRow({ Note: '  Обед  ' })]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.data[0].note).toBe('Обед');
    });

    it('trims whitespace from currency', async () => {
      const file = makeCsv([validRow({ Currency: '  USD  ' })]);
      const result = await parseMoneyLoverCsv(file);

      expect(result.data[0].currency).toBe('USD');
    });
  });
});
