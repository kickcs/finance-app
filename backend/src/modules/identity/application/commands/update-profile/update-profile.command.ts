import type { DashboardSettings } from '../../../domain/entities/profile.entity';

export class UpdateProfileCommand {
  constructor(
    public readonly userId: string,
    public readonly data: {
      name?: string;
      currency?: string;
      language?: string;
      hasCompletedOnboarding?: boolean;
      defaultAccountId?: string | null;
      dashboardSettings?: DashboardSettings | null;
      quickActionsHidden?: boolean;
      quickActionsHintDismissed?: boolean;
      financialMonthStartDay?: number;
      timezone?: string;
      notificationHour?: number;
    },
  ) {}
}
