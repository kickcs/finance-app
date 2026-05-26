import { http } from '@/shared/api/http';
import type { DashboardSettings, Profile, WidgetId } from '@/shared/api/database.types';

interface ProfileResponse {
  id: string;
  name: string | null;
  email: string | null;
  currency: string;
  hasCompletedOnboarding: boolean;
  defaultAccountId: string | null;
  createdAt: string;
  isDemo: boolean;
  demoExpiresAt: string | null;
  dashboardSettings: {
    widgetOrder: string[];
    hiddenWidgets: string[];
    hiddenAccountIds: string[];
  } | null;
  quickActionsHidden: boolean;
  quickActionsHintDismissed: boolean;
  financialMonthStartDay: number;
  notificationHour: number;
}

function transformProfile(profile: ProfileResponse): Profile {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    currency: profile.currency,
    has_completed_onboarding: profile.hasCompletedOnboarding,
    default_account_id: profile.defaultAccountId,
    created_at: profile.createdAt,
    is_demo: profile.isDemo,
    demo_expires_at: profile.demoExpiresAt,
    dashboard_settings: profile.dashboardSettings
      ? {
          widget_order: profile.dashboardSettings.widgetOrder as WidgetId[],
          hidden_widgets: profile.dashboardSettings.hiddenWidgets as WidgetId[],
          hidden_account_ids: profile.dashboardSettings.hiddenAccountIds,
        }
      : null,
    quick_actions_hidden: profile.quickActionsHidden,
    quick_actions_hint_dismissed: profile.quickActionsHintDismissed,
    financial_month_start_day: profile.financialMonthStartDay,
    notification_hour: profile.notificationHour,
  };
}

function transformDashboardForBackend(settings: DashboardSettings | null | undefined) {
  if (!settings) return settings;
  return {
    widgetOrder: settings.widget_order,
    hiddenWidgets: settings.hidden_widgets,
    hiddenAccountIds: settings.hidden_account_ids,
  };
}

export const profileApi = {
  async getMe(): Promise<Profile | null> {
    try {
      const data = await http<ProfileResponse>('/api/profiles/me');
      return transformProfile(data);
    } catch {
      return null;
    }
  },

  async getOrCreate(): Promise<Profile> {
    const data = await http<ProfileResponse>('/api/profiles/get-or-create', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return transformProfile(data);
  },

  async update(updates: Partial<Profile>): Promise<Profile> {
    const data = await http<ProfileResponse>('/api/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify({
        name: updates.name,
        currency: updates.currency,
        hasCompletedOnboarding: updates.has_completed_onboarding,
        defaultAccountId: updates.default_account_id,
        dashboardSettings: transformDashboardForBackend(updates.dashboard_settings),
        quickActionsHidden: updates.quick_actions_hidden,
        quickActionsHintDismissed: updates.quick_actions_hint_dismissed,
        financialMonthStartDay: updates.financial_month_start_day,
        notificationHour: updates.notification_hour,
      }),
    });
    return transformProfile(data);
  },
};
