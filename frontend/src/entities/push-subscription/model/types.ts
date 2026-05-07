export interface PushSubscriptionData {
  id: string;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  subscriptionUpcoming: boolean;
  subscriptionCharged: boolean;
  subscriptionFailed: boolean;
}
