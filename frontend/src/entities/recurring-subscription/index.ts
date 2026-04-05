// Model / Types
export type {
  SubscriptionFrequency,
  SubscriptionStatus,
  RecurringSubscription,
  RecurringSubscriptionInsert,
  CalendarEntry,
} from './model/types';

// Model / Constants
export {
  SERVICE_PRESETS,
  FREQUENCY_LABELS,
  SUBSCRIPTION_ICONS,
  type ServicePreset,
} from './model/constants';

// Model / Utils
export {
  daysUntilBilling,
  formatFrequencyShort,
  isSubscriptionDueSoon,
  computeBillingDatesForMonth,
  getNextBillingDate,
} from './model/utils';

// UI
export { default as SubscriptionCard } from './ui/SubscriptionCard.vue';
export { default as SubscriptionListItem } from './ui/SubscriptionListItem.vue';
export { default as SubscriptionCalendar } from './ui/SubscriptionCalendar.vue';
export { default as SubscriptionCardSkeleton } from './ui/SubscriptionCardSkeleton.vue';

// API
export * from './api';
