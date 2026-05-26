export * from './register-push-subscription/register-push-subscription.command';
export * from './register-push-subscription/register-push-subscription.handler';
export * from './unregister-push-subscription/unregister-push-subscription.command';
export * from './unregister-push-subscription/unregister-push-subscription.handler';
export * from './update-notification-preferences/update-notification-preferences.command';
export * from './update-notification-preferences/update-notification-preferences.handler';
export * from './register-push-device/register-push-device.command';
export * from './register-push-device/register-push-device.handler';
export * from './unregister-push-device/unregister-push-device.command';
export * from './unregister-push-device/unregister-push-device.handler';

import { RegisterPushSubscriptionHandler } from './register-push-subscription/register-push-subscription.handler';
import { UnregisterPushSubscriptionHandler } from './unregister-push-subscription/unregister-push-subscription.handler';
import { UpdateNotificationPreferencesHandler } from './update-notification-preferences/update-notification-preferences.handler';
import { RegisterPushDeviceHandler } from './register-push-device/register-push-device.handler';
import { UnregisterPushDeviceHandler } from './unregister-push-device/unregister-push-device.handler';

export const CommandHandlers = [
  RegisterPushSubscriptionHandler,
  UnregisterPushSubscriptionHandler,
  UpdateNotificationPreferencesHandler,
  RegisterPushDeviceHandler,
  UnregisterPushDeviceHandler,
];
