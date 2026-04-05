export * from './register-push-subscription/register-push-subscription.command';
export * from './register-push-subscription/register-push-subscription.handler';
export * from './unregister-push-subscription/unregister-push-subscription.command';
export * from './unregister-push-subscription/unregister-push-subscription.handler';

import { RegisterPushSubscriptionHandler } from './register-push-subscription/register-push-subscription.handler';
import { UnregisterPushSubscriptionHandler } from './unregister-push-subscription/unregister-push-subscription.handler';

export const CommandHandlers = [RegisterPushSubscriptionHandler, UnregisterPushSubscriptionHandler];
