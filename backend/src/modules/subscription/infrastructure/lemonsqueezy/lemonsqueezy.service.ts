import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  lemonSqueezySetup,
  createCheckout,
  getSubscription,
  cancelSubscription,
} from '@lemonsqueezy/lemonsqueezy.js';

@Injectable()
export class LemonSqueezyService {
  private readonly storeId: string;
  private readonly monthlyVariantId: string;
  private readonly yearlyVariantId: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.getOrThrow<string>('LEMONSQUEEZY_API_KEY');
    this.storeId = this.configService.getOrThrow<string>(
      'LEMONSQUEEZY_STORE_ID',
    );
    this.monthlyVariantId = this.configService.getOrThrow<string>(
      'LEMONSQUEEZY_PREMIUM_MONTHLY_VARIANT_ID',
    );
    this.yearlyVariantId = this.configService.getOrThrow<string>(
      'LEMONSQUEEZY_PREMIUM_YEARLY_VARIANT_ID',
    );
    lemonSqueezySetup({ apiKey });
  }

  async createCheckoutUrl(params: {
    userId: string;
    userEmail: string;
    userName: string;
    plan: 'premium_monthly' | 'premium_yearly';
  }): Promise<string> {
    const variantId =
      params.plan === 'premium_monthly'
        ? this.monthlyVariantId
        : this.yearlyVariantId;

    const { data, error } = await createCheckout(this.storeId, variantId, {
      checkoutData: {
        email: params.userEmail,
        name: params.userName,
        custom: { user_id: params.userId },
      },
      productOptions: {
        enabledVariants: [Number(variantId)],
      },
    });

    if (error) {
      throw new Error(`LemonSqueezy checkout error: ${error.message}`);
    }

    return data.data.attributes.url;
  }

  async getSubscriptionDetails(subscriptionId: string) {
    const { data, error } = await getSubscription(subscriptionId);

    if (error) {
      throw new Error(`LemonSqueezy subscription error: ${error.message}`);
    }

    return data.data;
  }

  async cancelLemonSubscription(subscriptionId: string) {
    const { data, error } = await cancelSubscription(subscriptionId);

    if (error) {
      throw new Error(`LemonSqueezy cancel error: ${error.message}`);
    }

    return data.data;
  }
}
