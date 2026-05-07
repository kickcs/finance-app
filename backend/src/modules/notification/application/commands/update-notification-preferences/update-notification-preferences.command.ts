export interface UpdateNotificationPreferencesPayload {
  subscriptionUpcoming?: boolean;
  subscriptionCharged?: boolean;
  subscriptionFailed?: boolean;
}

export class UpdateNotificationPreferencesCommand {
  constructor(
    public readonly userId: string,
    public readonly payload: UpdateNotificationPreferencesPayload,
  ) {}
}
