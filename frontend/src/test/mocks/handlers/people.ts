import { http, HttpResponse } from 'msw';

export const mockPersonResponse = {
  id: 'person-1',
  userId: 'test-user-1',
  name: 'Алексей',
  color: '#3b82f6',
  createdAt: '2025-01-10T12:00:00.000Z',
  updatedAt: '2025-01-10T12:00:00.000Z',
};

export const mockSecondPersonResponse = {
  id: 'person-2',
  userId: 'test-user-1',
  name: 'Мария',
  color: '#10b981',
  createdAt: '2025-01-15T12:00:00.000Z',
  updatedAt: '2025-01-15T12:00:00.000Z',
};

export const mockThirdPersonResponse = {
  id: 'person-3',
  userId: 'test-user-1',
  name: 'Борис',
  color: '#f43f5e',
  createdAt: '2025-02-01T12:00:00.000Z',
  updatedAt: '2025-02-01T12:00:00.000Z',
};

export function buildMockPersonResponse(
  body: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `person-${Date.now()}`,
    userId: 'test-user-1',
    name: body.name,
    color: body.color ?? '#3b82f6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export const peopleHandlers = [
  http.post('*/api/people', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(buildMockPersonResponse(body));
  }),

  http.patch('*/api/people/:id', async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...mockPersonResponse,
      id: params.id,
      ...body,
      updatedAt: new Date().toISOString(),
    });
  }),

  http.delete('*/api/people/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('*/api/people', () => {
    return HttpResponse.json([]);
  }),
];
