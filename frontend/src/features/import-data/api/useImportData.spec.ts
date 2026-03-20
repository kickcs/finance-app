import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useImportData } from './useImportData';
import type { ParsedTransaction } from '@/shared/lib/csv/parseMoneyLoverCsv';

// ---------------------------------------------------------------------------
// useImportData — composable tests
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
];

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable() {
  let result!: ReturnType<typeof useImportData>;
  const Stub = defineComponent({
    setup() {
      result = useImportData();
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub, { provideAuth: { user: mockUser } });
  return result;
}

describe('useImportData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('exposes importMutation', () => {
      const c = mountComposable();
      expect(c.importMutation).toBeDefined();
    });

    it('starts as idle (not pending)', () => {
      const c = mountComposable();
      expect(c.importMutation.isPending.value).toBe(false);
    });
  });

  // ── Successful import ─────────────────────────────────────────────────────

  describe('successful import', () => {
    it('calls the import API with provided transactions', async () => {
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

      const c = mountComposable();
      c.importMutation.mutate(sampleTransactions);
      await flushPromises();

      expect(capturedPayload).not.toBeNull();
      const txs = capturedPayload!.transactions as Record<string, unknown>[];
      expect(txs).toHaveLength(1);
      expect(txs[0].categoryName).toBe('Продукты');
    });

    it('mutation succeeds and is no longer pending', async () => {
      server.use(
        http.post('*/api/import/transactions', () =>
          HttpResponse.json({
            importedCount: 1,
            categoriesCreated: [],
            accountsCreated: [],
          }),
        ),
      );

      const c = mountComposable();
      c.importMutation.mutate(sampleTransactions);
      await flushPromises();

      expect(c.importMutation.isPending.value).toBe(false);
      expect(c.importMutation.isSuccess.value).toBe(true);
    });

    it('returns correct result data', async () => {
      server.use(
        http.post('*/api/import/transactions', () =>
          HttpResponse.json({
            importedCount: 3,
            categoriesCreated: ['Еда'],
            accountsCreated: ['Новый счёт'],
          }),
        ),
      );

      const c = mountComposable();
      await c.importMutation.mutateAsync(sampleTransactions);
      await flushPromises();

      expect(c.importMutation.data.value?.imported_count).toBe(3);
      expect(c.importMutation.data.value?.categories_created).toEqual(['Еда']);
      expect(c.importMutation.data.value?.accounts_created).toEqual(['Новый счёт']);
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('marks mutation as error on API 500', async () => {
      server.use(
        http.post('*/api/import/transactions', () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      c.importMutation.mutate(sampleTransactions);
      await flushPromises();

      expect(c.importMutation.isError.value).toBe(true);
      expect(c.importMutation.isPending.value).toBe(false);
    });

    it('does not crash on network failure', async () => {
      server.use(
        http.post('*/api/import/transactions', () => {
          throw new Error('Network error');
        }),
      );

      const c = mountComposable();
      c.importMutation.mutate(sampleTransactions);
      await flushPromises();

      expect(c.importMutation.isError.value).toBe(true);
    });
  });

  // ── Empty import ──────────────────────────────────────────────────────────

  describe('empty transactions array', () => {
    it('sends empty transactions array to API', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/import/transactions', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            importedCount: 0,
            categoriesCreated: [],
            accountsCreated: [],
          });
        }),
      );

      const c = mountComposable();
      c.importMutation.mutate([]);
      await flushPromises();

      expect(capturedPayload).not.toBeNull();
      const txs = capturedPayload!.transactions as Record<string, unknown>[];
      expect(txs).toHaveLength(0);
      expect(c.importMutation.isSuccess.value).toBe(true);
    });
  });
});
