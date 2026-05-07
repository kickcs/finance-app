export * from './get-notification-preferences/get-notification-preferences.query';
export * from './get-notification-preferences/get-notification-preferences.handler';

import { GetNotificationPreferencesHandler } from './get-notification-preferences/get-notification-preferences.handler';

export const QueryHandlers = [GetNotificationPreferencesHandler];
