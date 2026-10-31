import { describe, it, expect, afterEach, vi } from 'vitest';
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

describe('transactionsApi: bulk_locked', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('переносит bulkLocked ответа в bulk_locked', async () => {
    server.use(
      http.get('*/api/transactions/:id', () =>
        HttpResponse.json({ ...mockTransactionResponse, bulkLocked: true }),
      ),
    );

    expect((await transactionsApi.getById('tx-1')).bulk_locked).toBe(true);
  });

  it('старый ответ без поля даёт false: строка считается изменяемой, окончательно решит сервер', async () => {
    server.use(
      http.get('*/api/transactions/:id', () => HttpResponse.json(mockTransactionResponse)),
    );

    expect((await transactionsApi.getById('tx-1')).bulk_locked).toBe(false);
  });
});

describe('transactionsApi: фильтры истории', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  /** Ловит query-строку первого запроса к `path`. */
  function captureQuery(path: string, body: Record<string, unknown>) {
    const captured: { url?: URL } = {};
    server.use(
      http.get(path, ({ request }) => {
        captured.url = new URL(request.url);
        return HttpResponse.json(body);
      }),
    );
    return captured;
  }

  const emptyPage = { data: [], nextCursor: null, hasMore: false };

  it('списки уходят одним параметром через запятую, период — календарными датами', async () => {
    const captured = captureQuery('*/api/transactions', emptyPage);

    await transactionsApi.getPaginated('u', 20, undefined, {
      type: 'expense',
      category_ids: ['taxi', 'gifts_income'],
      account_ids: ['a-1', 'a-2'],
      tags: ['кафе', 'c++'],
      search: 'такси',
      start_date: '2026-10-01',
      end_date: '2026-10-31',
    });

    const q = captured.url!.searchParams;
    expect(q.get('type')).toBe('expense');
    expect(q.get('categoryIds')).toBe('taxi,gifts_income');
    expect(q.get('accountIds')).toBe('a-1,a-2');
    expect(q.get('tags')).toBe('кафе,c++');
    expect(q.get('startDate')).toBe('2026-10-01');
    expect(q.get('endDate')).toBe('2026-10-31');
    expect(q.get('search')).toBe('такси');
  });

  it('пустые списки в запрос не попадают', async () => {
    const captured = captureQuery('*/api/transactions', emptyPage);

    await transactionsApi.getPaginated('u', 20, undefined, {
      category_ids: [],
      account_ids: [],
      tags: [],
      search: '',
    });

    const q = captured.url!.searchParams;
    expect(q.has('categoryIds')).toBe(false);
    expect(q.has('accountIds')).toBe(false);
    expect(q.has('tags')).toBe(false);
    expect(q.has('search')).toBe(false);
  });
});

describe('transactionsApi.getSummary', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('шлёт те же фильтры и переводит ответ в snake_case', async () => {
    let url: URL | undefined;
    server.use(
      http.get('*/api/transactions/summary', ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json({
          count: 10,
          eligibleCount: 9,
          lockedCount: 1,
          totals: [{ currency: 'UZS', amount: 420000 }],
          asOf: '2026-10-31T10:00:00.000Z',
        });
      }),
    );

    const summary = await transactionsApi.getSummary({
      category_ids: ['taxi'],
      start_date: '2026-10-01',
      search: 'такси',
    });

    expect(url!.searchParams.get('categoryIds')).toBe('taxi');
    expect(url!.searchParams.get('startDate')).toBe('2026-10-01');
    expect(url!.searchParams.get('search')).toBe('такси');
    expect(summary).toEqual({
      count: 10,
      eligible_count: 9,
      locked_count: 1,
      totals: [{ currency: 'UZS', amount: 420000 }],
      as_of: '2026-10-31T10:00:00.000Z',
    });
  });
});

describe('transactionsApi.bulkUpdate', () => {
  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  const response = {
    changed: 9,
    skipped: [{ reason: 'wrong_type', count: 1 }],
    balanceDeltas: [{ accountId: 'a-1', currency: 'UZS', delta: -5000 }],
    undoToken: 'token-1',
  };

  function captureBody() {
    const captured: { body?: Record<string, unknown> } = {};
    server.use(
      http.post('*/api/transactions/bulk', async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(response);
      }),
    );
    return captured;
  }

  it('выборка по фильтру: фильтр со сверкой, списки массивами, ответ в snake_case', async () => {
    const captured = captureBody();

    const result = await transactionsApi.bulkUpdate({
      selection: {
        filter: {
          type: 'expense',
          category_ids: ['taxi'],
          account_ids: ['a-1'],
          tags: [],
          search: 'такси',
          start_date: '2026-10-01',
          end_date: '2026-10-31',
        },
        as_of: '2026-10-31T10:00:00.000Z',
        expected_count: 9,
      },
      action: { kind: 'category', category_id: 'transport' },
      dryRun: true,
    });

    expect(captured.body).toEqual({
      selection: {
        filter: {
          type: 'expense',
          categoryIds: ['taxi'],
          accountIds: ['a-1'],
          search: 'такси',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
        },
        asOf: '2026-10-31T10:00:00.000Z',
        expectedCount: 9,
      },
      action: { kind: 'category', categoryId: 'transport' },
      dryRun: true,
    });
    expect(result).toEqual({
      changed: 9,
      skipped: [{ reason: 'wrong_type', count: 1 }],
      balance_deltas: [{ account_id: 'a-1', currency: 'UZS', delta: -5000 }],
      undo_token: 'token-1',
    });
  });

  it('ручной выбор уходит списком id, действие несёт только поля своего вида', async () => {
    const captured = captureBody();

    await transactionsApi.bulkUpdate({
      selection: { ids: ['t-1', 't-2'] },
      action: { kind: 'transfer', to_account_id: 'a-2' },
    });

    expect(captured.body).toEqual({
      selection: { ids: ['t-1', 't-2'] },
      action: { kind: 'transfer', toAccountId: 'a-2' },
    });
  });

  it.each([
    [
      { kind: 'account', account_id: 'a-3' },
      { kind: 'account', accountId: 'a-3' },
    ],
    [
      { kind: 'tag', tag: 'кафе' },
      { kind: 'tag', tag: 'кафе' },
    ],
    [{ kind: 'delete' }, { kind: 'delete' }],
  ] as const)('действие %o уходит в camelCase', async (action, sent) => {
    const captured = captureBody();

    await transactionsApi.bulkUpdate({ selection: { ids: ['t-1'] }, action });

    expect(captured.body?.action).toEqual(sent);
  });

  it('ответ без токена (удаление, предпросмотр) даёт undo_token null', async () => {
    server.use(
      http.post('*/api/transactions/bulk', () =>
        HttpResponse.json({ changed: 2, skipped: [], balanceDeltas: [] }),
      ),
    );

    const result = await transactionsApi.bulkUpdate({
      selection: { ids: ['t-1'] },
      action: { kind: 'delete' },
    });

    expect(result.undo_token).toBeNull();
  });

  it('keepalive доходит до fetch: запрос переживает закрытие страницы', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await transactionsApi.bulkUpdate(
      { selection: { ids: ['t-1'] }, action: { kind: 'delete' } },
      { keepalive: true },
    );

    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ keepalive: true, method: 'POST' });
  });
});

describe('transactionsApi.undoBulk', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('шлёт токен и возвращает число восстановленных строк', async () => {
    let body: unknown;
    server.use(
      http.post('*/api/transactions/bulk/undo', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ restored: 9 });
      }),
    );

    const result = await transactionsApi.undoBulk('token-1');

    expect(body).toEqual({ undoToken: 'token-1' });
    expect(result).toEqual({ restored: 9 });
  });
});
