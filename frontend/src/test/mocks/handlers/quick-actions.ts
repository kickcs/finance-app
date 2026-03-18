import { http, HttpResponse } from 'msw';

export const mockQuickActionResponse = {
  id: 'qa-1',
  userId: 'test-user-1',
  categoryId: 'cat-groceries',
  accountId: 'acc-1',
  label: 'Продукты',
  position: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

export const mockSecondQuickActionResponse = {
  ...mockQuickActionResponse,
  id: 'qa-2',
  categoryId: 'cat-transport',
  label: 'Транспорт',
  position: 1,
};

export const quickActionHandlers = [
  http.get('*/api/quick-actions', () => {
    return HttpResponse.json([]);
  }),

  http.post('*/api/quick-actions', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...mockQuickActionResponse,
      id: `qa-${Date.now()}`,
      ...body,
    });
  }),

  http.patch('*/api/quick-actions/:id', async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...mockQuickActionResponse,
      id: params.id,
      ...body,
    });
  }),

  http.delete('*/api/quick-actions/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.patch('*/api/quick-actions/reorder', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
