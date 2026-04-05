export * from './create-subscription/create-subscription.command';
export * from './create-subscription/create-subscription.handler';
export * from './update-subscription/update-subscription.command';
export * from './update-subscription/update-subscription.handler';
export * from './delete-subscription/delete-subscription.command';
export * from './delete-subscription/delete-subscription.handler';
export * from './pause-subscription/pause-subscription.command';
export * from './pause-subscription/pause-subscription.handler';
export * from './resume-subscription/resume-subscription.command';
export * from './resume-subscription/resume-subscription.handler';
export * from './process-notifications/process-notifications.command';
export * from './process-notifications/process-notifications.handler';
export * from './process-auto-charges/process-auto-charges.command';
export * from './process-auto-charges/process-auto-charges.handler';

import { CreateSubscriptionHandler } from './create-subscription/create-subscription.handler';
import { UpdateSubscriptionHandler } from './update-subscription/update-subscription.handler';
import { DeleteSubscriptionHandler } from './delete-subscription/delete-subscription.handler';
import { PauseSubscriptionHandler } from './pause-subscription/pause-subscription.handler';
import { ResumeSubscriptionHandler } from './resume-subscription/resume-subscription.handler';
import { ProcessNotificationsHandler } from './process-notifications/process-notifications.handler';
import { ProcessAutoChargesHandler } from './process-auto-charges/process-auto-charges.handler';

export const CommandHandlers = [
  CreateSubscriptionHandler,
  UpdateSubscriptionHandler,
  DeleteSubscriptionHandler,
  PauseSubscriptionHandler,
  ResumeSubscriptionHandler,
  ProcessNotificationsHandler,
  ProcessAutoChargesHandler,
];
