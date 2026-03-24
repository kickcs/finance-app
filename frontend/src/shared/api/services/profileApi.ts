import { http } from '../http';
import type { Profile, WidgetId } from '../database.types';

// Response type from NestJS backend (camelCase)
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
  };
}

export const profileApi = {
  async getById(_userId: string): Promise<Profile | null> {
    try {
      // Backend gets userId from JWT token
      const data = await http.get<ProfileResponse>('/profiles/me');
      return transformProfile(data);
    } catch {
      return null;
    }
  },

  async getOrCreate(_userId: string): Promise<Profile> {
    // Backend gets userId from JWT token
    const data = await http.post<ProfileResponse>('/profiles/get-or-create', {});
    return transformProfile(data);
  },

  async update(_userId: string, updates: Partial<Profile>): Promise<Profile> {
    // Backend gets userId from JWT token
    // Only send fields that UpdateProfileDto accepts
    const data = await http.patch<ProfileResponse>('/profiles/me', {
      name: updates.name,
      currency: updates.currency,
      hasCompletedOnboarding: updates.has_completed_onboarding,
      defaultAccountId: updates.default_account_id,
      dashboardSettings: updates.dashboard_settings
        ? {
            widgetOrder: updates.dashboard_settings.widget_order,
            hiddenWidgets: updates.dashboard_settings.hidden_widgets,
            hiddenAccountIds: updates.dashboard_settings.hidden_account_ids,
          }
        : updates.dashboard_settings,
      quickActionsHidden: updates.quick_actions_hidden,
      quickActionsHintDismissed: updates.quick_actions_hint_dismissed,
      financialMonthStartDay: updates.financial_month_start_day,
    });
    return transformProfile(data);
  },
};
