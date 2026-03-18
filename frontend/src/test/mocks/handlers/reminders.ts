import { http, HttpResponse } from 'msw';

export const mockReminderResponse = {
  id: 'rem-1',
  userId: 'test-user-1',
  name: 'Аренда квартиры',
  amount: 500000,
  frequency: 'monthly',
  nextDate: '2026-04-01T00:00:00.000Z',
  icon: 'home',
  color: '#ef4444',
  isActive: true,
  createdAt: '2025-01-01T00:00:00.000Z',
};

export const mockSecondReminderResponse = {
  ...mockReminderResponse,
  id: 'rem-2',
  name: 'Интернет',
  amount: 100000,
  frequency: 'monthly',
  nextDate: '2026-04-05T00:00:00.000Z',
  icon: 'wifi',
  color: '#3b82f6',
};

export const reminderHandlers = [
  http.get('*/api/reminders', () => {
    return HttpResponse.json([]);
  }),

  http.get('*/api/reminders/:id', ({ params }) => {
    const id = params.id as string;
    const all = [mockReminderResponse, mockSecondReminderResponse];
    const found = all.find((r) => r.id === id);
    if (found) return HttpResponse.json(found);
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),

  http.post('*/api/reminders', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...mockReminderResponse,
      id: `rem-${Date.now()}`,
      ...body,
    });
  }),

  http.patch('*/api/reminders/:id', async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...mockReminderResponse,
      id: params.id,
      ...body,
    });
  }),

  http.delete('*/api/reminders/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
