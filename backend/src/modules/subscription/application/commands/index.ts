export * from './create-checkout/create-checkout.command';
export * from './create-checkout/create-checkout.handler';
export * from './handle-webhook/handle-webhook.command';
export * from './handle-webhook/handle-webhook.handler';
export * from './verify-iap-receipt/verify-iap-receipt.command';
export * from './verify-iap-receipt/verify-iap-receipt.handler';

import { CreateCheckoutHandler } from './create-checkout/create-checkout.handler';
import { HandleWebhookHandler } from './handle-webhook/handle-webhook.handler';
import { VerifyIapReceiptHandler } from './verify-iap-receipt/verify-iap-receipt.handler';

export const CommandHandlers = [
  CreateCheckoutHandler,
  HandleWebhookHandler,
  VerifyIapReceiptHandler,
];
