import { describe, it, expect, afterEach } from 'vitest';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { importApi } from './importApi';
import type { ParsedTransaction } from '@/shared/lib/csv/parseMoneyLoverCsv';

// ---------------------------------------------------------------------------
// importApi — integration tests with MSW
// ---------------------------------------------------------------------------

const sampleTransactions: ParsedTransaction[] = [
  {
    note: 'Обед',
    amount: 25000,
    category_name: 'Продукты',
    account_name: 'Основной',
    currency: 'UZS',
    date: '2025-06-01T12:00:00.000Z',
  },
  {
    note: null,
    amount: 50000,
    category_name: 'Транспорт',
    account_name: 'Основной',
    currency: 'UZS',
    date: '2025-06-02T12:00:00.000Z',
  },
];

describe('importApi', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  // ── importTransactions ───────────────────────────────────────────────────

  describe('importTransactions', () => {
    it('sends correct payload to /import/transactions', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/import/transactions', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            importedCount: 2,
            categoriesCreated: [],
            accountsCreated: [],
          });
        }),
      );

      await importApi.importTransactions(sampleTransactions);

      expect(capturedPayload).not.toBeNull();
      const txs = capturedPayload!.transactions as Record<string, unknown>[];
      expect(txs).toHaveLength(2);
    });

    it('maps snake_case fields to camelCase for backend', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/import/transactions', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            importedCount: 1,
            categoriesCreated: [],
            accountsCreated: [],
          });
        }),
      );

      await importApi.importTransactions([sampleTransactions[0]]);

      const txs = capturedPayload!.transactions as Record<string, unknown>[];
      const tx = txs[0];

      expect(tx.note).toBe('Обед');
      expect(tx.amount).toBe(25000);
      expect(tx.categoryName).toBe('Продукты');
      expect(tx.accountName).toBe('Основной');
      expect(tx.currency).toBe('UZS');
      expect(tx.date).toBe('2025-06-01T12:00:00.000Z');
    });

    it('handles null note correctly', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/import/transactions', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            importedCount: 1,
            categoriesCreated: [],
            accountsCreated: [],
          });
        }),
      );

      await importApi.importTransactions([sampleTransactions[1]]);

      const txs = capturedPayload!.transactions as Record<string, unknown>[];
      expect(txs[0].note).toBeNull();
    });

    it('maps backend camelCase response to snake_case', async () => {
      server.use(
        http.post('*/api/import/transactions', () =>
          HttpResponse.json({
            importedCount: 5,
            categoriesCreated: ['Еда', 'Кафе'],
            accountsCreated: ['Карта'],
          }),
        ),
      );

      const result = await importApi.importTransactions(sampleTransactions);

      expect(result.imported_count).toBe(5);
      expect(result.categories_created).toEqual(['Еда', 'Кафе']);
      expect(result.accounts_created).toEqual(['Карта']);
    });

    it('returns zero counts when nothing was created', async () => {
      server.use(
        http.post('*/api/import/transactions', () =>
          HttpResponse.json({
            importedCount: 2,
            categoriesCreated: [],
            accountsCreated: [],
          }),
        ),
      );

      const result = await importApi.importTransactions(sampleTransactions);

      expect(result.categories_created).toEqual([]);
      expect(result.accounts_created).toEqual([]);
    });

    it('throws on API 500', async () => {
      server.use(
        http.post('*/api/import/transactions', () =>
          HttpResponse.json({ message: 'Internal server error' }, { status: 500 }),
        ),
      );

      await expect(importApi.importTransactions(sampleTransactions)).rejects.toThrow();
    });

    it('throws on network failure', async () => {
      server.use(
        http.post('*/api/import/transactions', () => {
          throw new Error('Network error');
        }),
      );

      await expect(importApi.importTransactions(sampleTransactions)).rejects.toThrow();
    });

    it('sends all transactions in a single request', async () => {
      const manyTransactions: ParsedTransaction[] = Array.from({ length: 10 }, (_, i) => ({
        note: `Note ${i}`,
        amount: (i + 1) * 1000,
        category_name: 'Продукты',
        account_name: 'Основной',
        currency: 'UZS',
        date: '2025-06-01T12:00:00.000Z',
      }));

      let capturedCount = 0;
      let requestCount = 0;
      server.use(
        http.post('*/api/import/transactions', async ({ request }) => {
          requestCount++;
          const body = (await request.json()) as { transactions: unknown[] };
          capturedCount = body.transactions.length;
          return HttpResponse.json({
            importedCount: capturedCount,
            categoriesCreated: [],
            accountsCreated: [],
          });
        }),
      );

      await importApi.importTransactions(manyTransactions);

      expect(requestCount).toBe(1); // single request
      expect(capturedCount).toBe(10);
    });
  });
});
