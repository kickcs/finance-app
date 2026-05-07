export * from './register-push-subscription/register-push-subscription.command';
export * from './register-push-subscription/register-push-subscription.handler';
export * from './unregister-push-subscription/unregister-push-subscription.command';
export * from './unregister-push-subscription/unregister-push-subscription.handler';
export * from './update-notification-preferences/update-notification-preferences.command';
export * from './update-notification-preferences/update-notification-preferences.handler';

import { RegisterPushSubscriptionHandler } from './register-push-subscription/register-push-subscription.handler';
import { UnregisterPushSubscriptionHandler } from './unregister-push-subscription/unregister-push-subscription.handler';
import { UpdateNotificationPreferencesHandler } from './update-notification-preferences/update-notification-preferences.handler';

export const CommandHandlers = [
  RegisterPushSubscriptionHandler,
  UnregisterPushSubscriptionHandler,
  UpdateNotificationPreferencesHandler,
];
