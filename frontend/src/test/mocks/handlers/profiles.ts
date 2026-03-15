import { http, HttpResponse } from 'msw';

export const mockProfileResponse = {
  id: 'test-user-1',
  name: 'Test User',
  email: 'test@example.com',
  currency: 'UZS',
  hasCompletedOnboarding: true,
  defaultAccountId: 'acc-1',
  createdAt: '2025-01-01T00:00:00.000Z',
  isDemo: false,
  demoExpiresAt: null,
  dashboardSettings: null,
  quickActionsHidden: false,
  quickActionsHintDismissed: false,
};

export const profileHandlers = [
  http.post('*/api/profiles/get-or-create', () => {
    return HttpResponse.json(mockProfileResponse);
  }),

  http.get('*/api/profiles/me', () => {
    return HttpResponse.json(mockProfileResponse);
  }),
];
