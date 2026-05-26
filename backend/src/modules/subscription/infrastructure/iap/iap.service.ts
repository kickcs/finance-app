import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PRODUCT_TO_PLAN: Record<string, string> = {
  finance_premium_monthly: 'premium_monthly',
  finance_premium_yearly: 'premium_yearly',
};

export interface IapVerifyInput {
  platform: 'ios' | 'android';
  productId: string;
  transactionId: string;
  receipt: string;
}

export interface IapVerifyResult {
  plan: 'premium_monthly' | 'premium_yearly';
  source: 'apple_iap' | 'google_iap';
  originalTransactionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  /** Server-trusted productId returned from the store (never trust the client). */
  trustedProductId: string;
}

/**
 * Real implementation requires:
 *
 * iOS — Apple App Store Server API
 *   https://developer.apple.com/documentation/appstoreserverapi
 *   Either StoreKit2 transaction JWS validation (offline) or signed-request
 *   to /inApps/v1/transactions/{transactionId}. Needs the App-Specific
 *   Shared Secret (legacy receipt-validation) OR the App Store Connect API
 *   key (StoreKit2 server API).
 *
 * Android — Google Play Developer API
 *   purchases.subscriptionsv2.get(packageName, token)
 *   Needs a Google Cloud service-account JSON with Play Developer scope.
 *
 * Until those secrets are wired we refuse the request rather than activate
 * premium on an unverified client payload — the worst case is "purchase
 * succeeded but premium didn't unlock", which the user can retry/restore;
 * the security-worst case (no validation, attacker forges a purchase)
 * is unacceptable.
 */
@Injectable()
export class IapService {
  private readonly logger = new Logger(IapService.name);

  constructor(private readonly config: ConfigService) {}

  verifyReceipt(input: IapVerifyInput): Promise<IapVerifyResult> {
    if (input.platform === 'ios') {
      return this.verifyApple(input);
    }
    return this.verifyGoogle(input);
  }

  private verifyApple(_input: IapVerifyInput): Promise<IapVerifyResult> {
    const sharedSecret = this.config.get<string>('APPLE_IAP_SHARED_SECRET');
    if (!sharedSecret) {
      this.logger.warn(
        `Apple IAP verification attempted without APPLE_IAP_SHARED_SECRET configured`,
      );
      return Promise.reject(
        new BadRequestException('Apple IAP validation is not configured on this server'),
      );
    }
    // TODO(Task 59 follow-up): Implement App Store Server API call.
    // Pseudocode:
    //   1. POST receipt to https://buy.itunes.apple.com/verifyReceipt
    //      with password = sharedSecret. Fall back to sandbox URL on 21007.
    //   2. From response take latest_receipt_info[0]: product_id,
    //      original_transaction_id, expires_date_ms, purchase_date_ms.
    //   3. Build IapVerifyResult — ALWAYS use product_id from the store,
    //      never input.productId.
    this.logger.error('Apple IAP verifyReceipt path not yet implemented');
    return Promise.reject(
      new BadRequestException(
        'Apple IAP server-side validation is not implemented yet (Task 59 follow-up)',
      ),
    );
  }

  private verifyGoogle(_input: IapVerifyInput): Promise<IapVerifyResult> {
    const serviceAccountJson = this.config.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
    if (!serviceAccountJson) {
      this.logger.warn(
        `Google IAP verification attempted without GOOGLE_PLAY_SERVICE_ACCOUNT_JSON configured`,
      );
      return Promise.reject(
        new BadRequestException('Google IAP validation is not configured on this server'),
      );
    }
    // TODO(Task 59 follow-up): Implement Google Play Developer API call.
    // Pseudocode:
    //   1. Auth = googleapis JWT from service-account JSON,
    //      scope https://www.googleapis.com/auth/androidpublisher.
    //   2. GET .../packages/{pkg}/purchases/subscriptionsv2/tokens/{purchaseToken}
    //   3. From response take productId, expiryTime, startTime, paymentState.
    //   4. Build IapVerifyResult.
    this.logger.error('Google IAP verifyReceipt path not yet implemented');
    return Promise.reject(
      new BadRequestException(
        'Google IAP server-side validation is not implemented yet (Task 59 follow-up)',
      ),
    );
  }

  productIdToPlan(productId: string): 'premium_monthly' | 'premium_yearly' {
    const plan = PRODUCT_TO_PLAN[productId];
    if (plan !== 'premium_monthly' && plan !== 'premium_yearly') {
      throw new BadRequestException(`Unknown product id: ${productId}`);
    }
    return plan;
  }
}
