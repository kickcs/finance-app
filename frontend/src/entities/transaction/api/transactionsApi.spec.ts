import { describe, it, expect, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { mockTransactionResponse } from '@/test/mocks/handlers/transactions';
import { transactionsApi } from './transactionsApi';

describe('transactionsApi: settlement_id', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('переносит settlementId ответа в settlement_id', async () => {
    server.use(
      http.get('*/api/transactions/:id', () =>
        HttpResponse.json({ ...mockTransactionResponse, settlementId: 'set-1' }),
      ),
    );

    const tx = await transactionsApi.getById('tx-1');

    expect(tx.settlement_id).toBe('set-1');
  });

  it('запись вне расчёта получает settlement_id null', async () => {
    server.use(
      http.get('*/api/transactions/:id', () =>
        HttpResponse.json({ ...mockTransactionResponse, settlementId: null }),
      ),
    );

    const tx = await transactionsApi.getById('tx-1');

    expect(tx.settlement_id).toBeNull();
  });

  it('старый ответ без поля даёт null, а не undefined', async () => {
    const { settlementId: _omitted, ...legacyResponse } = mockTransactionResponse;
    server.use(http.get('*/api/transactions/:id', () => HttpResponse.json(legacyResponse)));

    const tx = await transactionsApi.getById('tx-1');

    expect(tx.settlement_id).toBeNull();
  });
});
