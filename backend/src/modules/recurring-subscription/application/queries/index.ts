export * from './get-subscriptions/get-subscriptions.query';
export * from './get-subscriptions/get-subscriptions.handler';
export * from './get-subscription-by-id/get-subscription-by-id.query';
export * from './get-subscription-by-id/get-subscription-by-id.handler';
export * from './get-upcoming-subscriptions/get-upcoming-subscriptions.query';
export * from './get-upcoming-subscriptions/get-upcoming-subscriptions.handler';
export * from './get-calendar-subscriptions/get-calendar-subscriptions.query';
export * from './get-calendar-subscriptions/get-calendar-subscriptions.handler';

import { GetSubscriptionsHandler } from './get-subscriptions/get-subscriptions.handler';
import { GetSubscriptionByIdHandler } from './get-subscription-by-id/get-subscription-by-id.handler';
import { GetUpcomingSubscriptionsHandler } from './get-upcoming-subscriptions/get-upcoming-subscriptions.handler';
import { GetCalendarSubscriptionsHandler } from './get-calendar-subscriptions/get-calendar-subscriptions.handler';

export const QueryHandlers = [
  GetSubscriptionsHandler,
  GetSubscriptionByIdHandler,
  GetUpcomingSubscriptionsHandler,
  GetCalendarSubscriptionsHandler,
];
