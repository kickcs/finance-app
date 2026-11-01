import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { mockProfileResponse } from '@/test/mocks/handlers/profiles';
import { profileApi } from './profileApi';

describe('profileApi', () => {
  it('отбрасывает убранные виджеты главной и дописывает новые в конец', async () => {
    server.use(
      http.get('*/api/profiles/me', () =>
        HttpResponse.json({
          ...mockProfileResponse,
          dashboardSettings: {
            widgetOrder: ['accounts', 'reminders', 'debts'],
            hiddenWidgets: ['reminders', 'budget'],
            hiddenAccountIds: ['acc-2'],
          },
        }),
      ),
    );

    const profile = await profileApi.getById('test-user-1');

    expect(profile?.dashboard_settings).toEqual({
      widget_order: [
        'accounts',
        'debts',
        'quick_actions',
        'top_expenses',
        'transactions',
        'budget',
        'subscriptions',
      ],
      hidden_widgets: ['budget'],
      hidden_account_ids: ['acc-2'],
    });
  });
});
